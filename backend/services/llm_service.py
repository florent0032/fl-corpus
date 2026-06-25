"""LLM 调用服务

负责与 LLM API 交互，生成词条 JSON。

设计流程：
1. 接收用户的词语数据（JSON 格式）+ 知识库检索结果
2. 注入到提示词模板中
3. 调用 LLM 生成完整词条
4. 解析并返回 JSON
"""

import json
import re
import httpx
from typing import Optional
from loguru import logger


class LLMService:
    """LLM 调用服务"""

    async def chat(
        self,
        messages: list[dict],
        vendor: dict,
        model: str,
        temperature: float = 0.8,
        max_tokens: int = 4096,
    ) -> str:
        """调用 LLM"""
        base_url = vendor.get("base_url", "").rstrip("/")
        api_key = vendor.get("api_key", "")

        if not base_url:
            raise ValueError("供应商 base_url 不能为空")

        headers = {
            "Content-Type": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            try:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                # 提取回复内容
                choices = data.get("choices", [])
                if not choices:
                    raise ValueError("LLM 返回空 choices")

                content = choices[0].get("message", {}).get("content", "")
                return content

            except httpx.HTTPStatusError as e:
                logger.error(f"LLM API 错误: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"LLM 调用失败: {e}")
                raise

    async def generate_entry(
        self,
        word_entry: dict,
        kb_results: list[dict],
        prompt_template: str,
        output_format: dict,
        vendor: dict,
        model: str,
        max_usages: int = 25,
        last_error: str = "",
    ) -> dict:
        """生成词条

        Args:
            word_entry: 用户输入的词语数据（JSON 格式，包含所有用户填写的字段）
            kb_results: 知识库检索结果
            prompt_template: 系统提示词模板
            output_format: 输出格式定义（包含 schema 和 retry_prompt）
            vendor: 供应商配置
            model: 模型名称
            max_usages: 最大用例数
            last_error: 上一次错误信息（用于重试）
        """
        # 构建知识库检索结果文本
        kb_text = ""
        if kb_results:
            kb_items = []
            for i, r in enumerate(kb_results[:max_usages], 1):
                snippet = r.get("snippet", "").replace("【", "").replace("】", "")
                # 使用相对路径作为来源（如：日常/Nichijou）
                file_path = r.get("file", "")
                if file_path:
                    # 提取相对路径（去掉知识库根目录前缀）
                    # 例如：/home/florent/static/corpus/阿拉伯语/语料堆/动画/日常/Nichijou - 23.md
                    # 变为：日常/Nichijou - 23
                    import os
                    # 找到 "语料堆" 后面的部分
                    parts = file_path.split("/")
                    try:
                        # 找到 "语料堆" 的位置
                        idx = next(i for i, p in enumerate(parts) if p == "语料堆")
                        # 取 "语料堆" 后面的部分
                        relative_parts = parts[idx+1:]
                        # 去掉文件扩展名
                        if relative_parts:
                            last = relative_parts[-1]
                            if "." in last:
                                relative_parts[-1] = last.rsplit(".", 1)[0]
                        source = "/".join(relative_parts)
                    except StopIteration:
                        # 如果没有找到 "语料堆"，使用文件名
                        source = os.path.splitext(os.path.basename(file_path))[0]
                else:
                    source = r.get("source", "未知来源")
                kb_items.append(f"{i}. [{source}] {snippet}")
            kb_text = "\n".join(kb_items)

        # 构建词条信息文本
        # 优先从 json_input 中提取用户填写的字段
        json_input = word_entry.get("json_input", {})
        word_info_lines = []
        if json_input and isinstance(json_input, dict):
            for key, value in json_input.items():
                if value is not None and str(value).strip() and str(value).strip() not in ("{}", "[]", ""):
                    word_info_lines.append(f"- {key}：{json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value}")
        # 如果 json_input 为空，回退到从 word_entry 提取
        if not word_info_lines:
            for key, value in word_entry.items():
                if key in ("id", "lang", "collection_id", "added_at", "updated_at", "status", "error",
                           "knowledge_bases", "fallback_words", "json_input", "word"):
                    continue
                if value is not None and str(value).strip():
                    word_info_lines.append(f"- {key}：{value}")
        # 确保 word 字段在最前面
        word_val = (json_input.get("word") if json_input else None) or word_entry.get("word", "")
        if word_val:
            word_info_lines.insert(0, f"- word：{word_val}")
        word_info = "\n".join(word_info_lines)

        # 构建输出格式说明
        format_desc = ""
        if output_format:
            schema = output_format.get("json_schema") or output_format.get("schema") or {}
            sample = output_format.get("sample_output", "")
            if schema:
                format_desc = f"\n输出格式要求：\n{json.dumps(schema, ensure_ascii=False, indent=2)}"
            if sample:
                format_desc += f"\n\n输出示例：\n{sample}"

        # 构建重试提示
        retry_note = ""
        if last_error:
            retry_prompt = output_format.get("retry_prompt", "") if output_format else ""
            retry_note = f"\n\n⚠️ 上一次输出不合格，原因：{last_error}"
            if retry_prompt:
                retry_note += f"\n{retry_prompt}"
            retry_note += "\n请修正后重新输出严格 JSON object。"

        # 构建用户提示词
        user_prompt = f"""请根据下面信息生成一个词条 JSON object。只输出 JSON，不要 markdown。

词条信息：
{word_info}

知识库检索结果：
{kb_text if kb_text else "无检索结果"}
{format_desc}
{retry_note}"""

        messages = [
            {"role": "system", "content": prompt_template},
            {"role": "user", "content": user_prompt},
        ]

        # 调用 LLM
        text = await self.chat(messages, vendor, model)

        # 解析 JSON
        entry = self._parse_json_response(text)

        # 只确保 word 字段存在，其余由 LLM 根据输出格式生成
        word_val = (json_input.get("word") if json_input else None) or word_entry.get("word", "")
        entry.setdefault("word", word_val)

        return entry

    def _parse_json_response(self, text: str) -> dict:
        """解析 LLM 返回的 JSON"""
        text = text.strip()

        # 移除 markdown 代码块标记
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()

        # 尝试直接解析
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 尝试提取 JSON 对象
        match = re.search(r"\{.*\}", text, flags=re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        raise ValueError(f"无法解析 LLM 输出为 JSON: {text[:200]}")

    def validate_against_schema(self, entry: dict, schema: dict) -> tuple[bool, str]:
        """根据 JSON Schema 验证词条

        Args:
            entry: 词条数据
            schema: JSON Schema 定义

        Returns:
            (是否有效, 错误信息)
        """
        if not schema:
            return True, ""

        # 检查必需字段
        required = schema.get("required", [])
        for field in required:
            if field not in entry:
                return False, f"缺少必需字段: {field}"

        # 检查字段类型
        properties = schema.get("properties", {})
        for field, field_schema in properties.items():
            if field not in entry:
                continue

            expected_type = field_schema.get("type")
            value = entry[field]

            if expected_type == "string" and not isinstance(value, str):
                return False, f"字段 {field} 应为字符串"
            elif expected_type == "array" and not isinstance(value, list):
                return False, f"字段 {field} 应为数组"
            elif expected_type == "object" and not isinstance(value, dict):
                return False, f"字段 {field} 应为对象"
            elif expected_type == "number" and not isinstance(value, (int, float)):
                return False, f"字段 {field} 应为数字"
            elif expected_type == "boolean" and not isinstance(value, bool):
                return False, f"字段 {field} 应为布尔值"

            # 检查数组元素
            if expected_type == "array" and isinstance(value, list):
                items_schema = field_schema.get("items", {})
                if items_schema.get("type") == "object":
                    item_properties = items_schema.get("properties", {})
                    item_required = items_schema.get("required", [])
                    for i, item in enumerate(value):
                        if not isinstance(item, dict):
                            return False, f"{field}[{i}] 应为对象"
                        for req in item_required:
                            if req not in item:
                                return False, f"{field}[{i}] 缺少字段: {req}"

        return True, ""

    async def test_connection(self, vendor: dict) -> float:
        """测试连接，返回延迟（毫秒）"""
        import time

        base_url = vendor.get("base_url", "").rstrip("/")
        api_key = vendor.get("api_key", "")

        if not base_url:
            raise ValueError("供应商 base_url 不能为空")

        headers = {
            "Content-Type": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": vendor.get("models", ["gpt-3.5-turbo"])[0] if vendor.get("models") else "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }

        start = time.time()

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()

        elapsed = (time.time() - start) * 1000
        return round(elapsed, 2)


# 全局实例
llm_service = LLMService()
