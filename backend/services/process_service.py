"""处理流程服务

设计流程：
1. 读取用户的词语数据（JSON 格式，包含用户选择填写的所有字段）
2. 从知识库检索用例
3. 将词语 JSON + 知识库用例 + 输出格式 → 注入提示词 → 调用 LLM
4. 解析 LLM 输出，根据输出格式进行验证
5. 如果验证失败，携带错误信息重试（最多 N 次）
6. 返回最终的词条 JSON
"""

import re
import json
from typing import Optional
from loguru import logger


def remove_arabic_vowels(text: str) -> str:
    """去掉阿拉伯语音标符号（tashkeel），用于搜索"""
    if not text:
        return text
    return re.sub(r'[ً-ٰٟ]', '', text)

from backend.services.llm_service import llm_service
from backend.services.kb_service import kb_service


class ProcessService:
    """处理流程服务"""

    def __init__(self):
        self.max_retries = 3  # 最大重试次数

    async def process_single_word(
        self,
        word_entry: dict,
        vendor: dict,
        model: str,
        prompt_template: str,
        output_format: dict,
        config: dict,
    ) -> dict:
        """处理单个词语

        Args:
            word_entry: 用户输入的词语数据（完整 JSON）
            vendor: 供应商配置
            model: 模型名称
            prompt_template: 系统提示词模板
            output_format: 输出格式定义
            config: 处理配置
        """
        # 从 json_input 或 word_entry 获取 word
        json_input = word_entry.get("json_input", {})
        if json_input and isinstance(json_input, dict):
            word = json_input.get("word", "") or word_entry.get("word", "")
        else:
            word = word_entry.get("word", "")
        reading = word_entry.get("reading", "")
        lang = word_entry.get("lang", "ja")

        # 搜索用的关键词：去掉阿拉伯语音标
        search_word = remove_arabic_vowels(word) if lang == "ar" else word

        # 1. 从知识库检索语料
        kb_results = []
        kb_names = config.get("knowledge_bases", [])
        target_count = config.get("max_usages", 25)
        min_snippet_len = config.get("min_snippet_len", 15)

        if kb_names:
            # 用去掉音标的词搜索
            kb_results = kb_service.search_across_kbs(
                kb_names=kb_names,
                keywords=[search_word],
                target_count=target_count * 2,
                min_snippet_len=min_snippet_len,
            )

            logger.info(f"知识库检索完成: {word} (搜索: {search_word}) -> {len(kb_results)} 条结果")

            # 如果有读音且与原词不同，单独搜索读音
            search_reading = remove_arabic_vowels(reading) if lang == "ar" else reading
            if search_reading and search_reading != search_word and len(kb_results) < target_count:
                reading_results = kb_service.search_across_kbs(
                    kb_names=kb_names,
                    keywords=[search_reading],
                    target_count=target_count - len(kb_results),
                    min_snippet_len=min_snippet_len,
                )
                # 去重后添加
                existing_keys = {(r.get("file"), r.get("chunk")) for r in kb_results}
                for r in reading_results:
                    key = (r.get("file"), r.get("chunk"))
                    if key not in existing_keys:
                        kb_results.append(r)
                        existing_keys.add(key)
                logger.info(f"读音 '{reading}' 检索: +{len(reading_results)} 条，当前总计 {len(kb_results)} 条")

            # 如果结果不足，逐个使用兜底词搜索（每个兜底词单独搜索）
            fallback_words = word_entry.get("fallback_words", [])
            if len(kb_results) < target_count and fallback_words:
                logger.info(f"结果不足 {target_count} 条，逐个使用兜底词搜索: {fallback_words}")

                existing_keys = {(r.get("file"), r.get("chunk")) for r in kb_results}

                for fallback in fallback_words:
                    if len(kb_results) >= target_count:
                        break

                    # 兜底词也去掉音标后搜索
                    search_fallback = remove_arabic_vowels(fallback) if lang == "ar" else fallback
                    fallback_results = kb_service.search_across_kbs(
                        kb_names=kb_names,
                        keywords=[search_fallback],
                        target_count=target_count - len(kb_results),
                        min_snippet_len=min_snippet_len,
                    )

                    # 去重后添加
                    for r in fallback_results:
                        key = (r.get("file"), r.get("chunk"))
                        if key not in existing_keys:
                            kb_results.append(r)
                            existing_keys.add(key)

                    logger.info(f"兜底词 '{fallback}' 单独检索: +{len(fallback_results)} 条，当前总计 {len(kb_results)} 条")

        # 2. 获取输出格式的 schema
        schema = output_format.get("json_schema", {}) if output_format else {}

        # 3. 带重试的 LLM 调用
        last_error = ""
        entry = None

        for attempt in range(1, self.max_retries + 1):
            try:
                # 调用 LLM 生成词条（传入完整的用户 JSON + 知识库结果）
                entry = await llm_service.generate_entry(
                    word_entry=word_entry,
                    kb_results=kb_results,
                    prompt_template=prompt_template,
                    output_format=output_format,
                    vendor=vendor,
                    model=model,
                    max_usages=config.get("max_usages", 25),
                    last_error=last_error,
                )

                # 4. 根据输出格式验证
                if schema:
                    is_valid, error_msg = llm_service.validate_against_schema(entry, schema)
                    if not is_valid:
                        last_error = error_msg
                        logger.warning(f"词条 {word} 第 {attempt} 次验证失败: {error_msg}")
                        continue

                # 5. 基础验证
                is_valid, error_msg = self.validate_entry(entry, word)
                if not is_valid:
                    last_error = error_msg
                    logger.warning(f"词条 {word} 第 {attempt} 次基础验证失败: {error_msg}")
                    continue

                # 验证通过
                break

            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
                logger.warning(f"词条 {word} 第 {attempt} 次处理异常: {last_error}")

                if attempt == self.max_retries:
                    raise ValueError(f"词条 {word} 处理失败，已重试 {self.max_retries} 次: {last_error}")

        if entry is None:
            raise ValueError(f"词条 {word} 处理失败: {last_error}")

        # 6. 标准化词条（根据输出格式过滤字段）
        entry = self.normalize_entry(entry, output_format)

        return entry

    def validate_entry(self, entry: dict, original_word: str) -> tuple[bool, str]:
        """基础验证 - 只验证 word 字段"""
        if not isinstance(entry, dict):
            return False, "LLM 返回的不是 JSON object"

        if "word" not in entry:
            return False, "缺少 word 字段"

        if not entry["word"] or not str(entry["word"]).strip():
            return False, "word 不能为空"

        # 清理高亮符号后检查
        word_clean = str(entry["word"]).replace("【", "").replace("】", "").strip()
        original_clean = original_word.replace("【", "").replace("】", "").strip()
        if word_clean != original_clean:
            return False, f"word 不一致: expected={original_word}, got={entry['word']}"

        return True, ""

    def normalize_entry(self, entry: dict, output_format: dict = None) -> dict:
        """标准化词条 - 根据输出格式 schema 过滤字段，其余原样保留"""
        # 获取输出格式中定义的字段
        schema = {}
        if output_format:
            schema = output_format.get("json_schema") or output_format.get("schema") or {}
        properties = schema.get("properties", {})
        allowed_fields = set(properties.keys()) if properties else None

        if allowed_fields:
            # 只保留 schema 中定义的字段
            normalized = {}
            for field in allowed_fields:
                if field in entry:
                    normalized[field] = entry[field]
        else:
            # 没有输出格式定义，原样保留 LLM 返回的所有字段
            normalized = dict(entry)

        return normalized


# 全局实例
process_service = ProcessService()
