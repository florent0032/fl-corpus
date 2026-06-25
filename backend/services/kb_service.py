"""知识库搜索服务"""

import os
import re
import sqlite3
from pathlib import Path
from typing import Optional
from loguru import logger


class KBService:
    """知识库搜索服务"""

    def __init__(self):
        self.kb_root = Path(os.getenv("CORPUS_KB_ROOT", str(Path(__file__).parent.parent.parent / "kb")))

    def _clean_ass_formatting(self, text: str) -> str:
        """清理 ASS 字幕格式代码，提取纯文本"""
        lines = text.split('\n')
        cleaned_lines = []

        for line in lines:
            # 跳过 ASS 元数据行
            if line.startswith('[') and line.endswith(']'):
                continue
            if line.startswith(';'):
                continue
            if line.startswith('Script'):
                continue
            if line.startswith('Title:'):
                continue
            if line.startswith('WrapStyle:'):
                continue
            if line.startswith('PlayRes'):
                continue
            if line.startswith('ScaledBorder'):
                continue
            if line.startswith('Video'):
                continue
            if line.startswith('Audio'):
                continue
            if line.startswith('Last Style'):
                continue
            if line.startswith('Active Line'):
                continue
            if line.startswith('Scroll Position'):
                continue
            if line.startswith('Video AR'):
                continue
            if line.startswith('Video Zoom'):
                continue
            if line.startswith('Format:') and 'Name, Fontname' in line:
                continue
            if line.startswith('Style:'):
                continue

            # 跳过 Drawing 命令（包含 m 和 l 命令）
            if re.match(r'^[ml\s\d.-]+$', line.strip()) and ('m ' in line or 'l ' in line):
                continue

            # 处理 Dialogue 行
            if line.startswith('Dialogue:'):
                # 提取文本部分（最后一个逗号之后的内容）
                parts = line.split(',', 9)
                if len(parts) >= 10:
                    text_part = parts[9]
                    # 去除 ASS 格式代码 {...}
                    text_part = re.sub(r'\{[^}]*\}', '', text_part)
                    # 去除 \N, \n 等换行符
                    text_part = text_part.replace('\\N', ' ').replace('\\n', ' ')
                    # 去除多余空白
                    text_part = re.sub(r'\s+', ' ', text_part).strip()
                    if text_part and len(text_part) > 2:
                        cleaned_lines.append(text_part)

        return '\n'.join(cleaned_lines)

    def search(
        self,
        kb_name: str,
        keywords: list[str],
        page: int = 1,
        page_size: int = 20,
        min_snippet_len: int = 15,
    ) -> dict:
        """在指定知识库中搜索"""
        db_path = self.kb_root / kb_name / "kb.db"

        if not db_path.exists():
            return {"data": [], "total": 0, "error": f"知识库不存在: {kb_name}"}

        conn = sqlite3.connect(str(db_path))

        results = []
        seen = set()
        seen_snippets = set()  # 用于去重 snippet

        for kw in keywords:
            if not kw or not kw.strip():
                continue

            rows = self._search_one_keyword(conn, kw.strip(), limit=page_size * 10)

            for filename, chunk_id, content, source in rows:
                key = (filename, chunk_id)
                if key in seen:
                    continue
                seen.add(key)

                # 数据库中的内容已经清理过，直接使用
                # 如果包含 Dialogue 行，说明是未清理的内容，需要清理
                if 'Dialogue:' in content:
                    content = self._clean_ass_formatting(content)
                    if not content or len(content) < min_snippet_len:
                        continue

                snippet = self._build_snippet(content, keywords)
                if len(snippet) < min_snippet_len:
                    continue

                # 去重 snippet（避免返回大量重复内容）
                snippet_key = snippet[:100]  # 使用前100字符作为去重键
                if snippet_key in seen_snippets:
                    continue
                seen_snippets.add(snippet_key)

                score = self._score(content, keywords, source)

                results.append({
                    "file": filename,
                    "chunk": chunk_id,
                    "snippet": snippet,
                    "score": score,
                    "source": source,
                    "kb_name": kb_name,
                })

        conn.close()

        # 按分数排序
        results.sort(key=lambda x: x["score"], reverse=True)

        # 分页
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size

        return {
            "data": results[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def search_across_kbs(
        self,
        kb_names: list[str],
        keywords: list[str],
        target_count: int = 50,
        min_snippet_len: int = 15,
    ) -> list[dict]:
        """跨多个知识库搜索"""
        results = []
        seen = set()

        for kb_name in kb_names:
            if len(results) >= target_count:
                break

            data = self.search(
                kb_name=kb_name,
                keywords=keywords,
                page_size=target_count - len(results),
                min_snippet_len=min_snippet_len,
            )

            for item in data.get("data", []):
                key = (item.get("file"), item.get("chunk"))
                if key not in seen:
                    seen.add(key)
                    results.append(item)

        return results[:target_count]

    def _search_one_keyword(
        self,
        conn: sqlite3.Connection,
        keyword: str,
        limit: int,
    ) -> list[tuple]:
        """
        双通道搜索：
        1. FTS5 MATCH
        2. LIKE 兜底
        """
        rows = []

        # FTS 搜索
        try:
            fts_rows = conn.execute(
                """
                SELECT filename, chunk_id, content
                FROM docs
                WHERE docs MATCH ?
                LIMIT ?
                """,
                (self._escape_fts_query(keyword), limit),
            ).fetchall()

            rows.extend([(f, c, content, "fts") for f, c, content in fts_rows])
        except sqlite3.OperationalError as e:
            logger.warning(f"FTS 查询失败: {keyword}, error={e}")

        # LIKE 搜索
        try:
            like_rows = conn.execute(
                """
                SELECT filename, chunk_id, content
                FROM docs
                WHERE content LIKE ?
                LIMIT ?
                """,
                (f"%{keyword}%", limit),
            ).fetchall()

            rows.extend([(f, c, content, "like") for f, c, content in like_rows])
        except sqlite3.OperationalError as e:
            logger.warning(f"LIKE 查询失败: {keyword}, error={e}")

        return rows

    def _escape_fts_query(self, keyword: str) -> str:
        """转义 FTS 查询"""
        keyword = keyword.replace('"', '""')
        return f'"{keyword}"'

    def _build_snippet(
        self,
        text: str,
        keywords: list[str],
        min_len: int = 80,
        max_len: int = 300,
    ) -> str:
        """构建上下文感知的摘要"""
        # 注意：text 已经在调用前被清理过，这里不再重复清理
        lines = text.split("\n")

        # 过滤掉 Drawing 命令和空行
        lines = [line for line in lines if line.strip() and not (re.match(r'^[ml\s\d.-]+$', line.strip()) and ('m ' in line or 'l ' in line))]

        if not lines:
            return ""

        # 找到第一个命中行
        hit_idx = -1
        for i, line in enumerate(lines):
            if any(kw in line for kw in keywords):
                hit_idx = i
                break

        if hit_idx == -1:
            return self._highlight("\n".join(lines)[:max_len], keywords)

        # 如果命中行足够长，直接返回
        if len(lines[hit_idx]) >= max_len:
            return self._highlight(lines[hit_idx][:max_len], keywords)

        # 向前后扩展
        left = hit_idx
        right = hit_idx
        total_len = len(lines[hit_idx])

        while total_len < min_len:
            expand_left = left > 0
            expand_right = right < len(lines) - 1

            if not expand_left and not expand_right:
                break

            if expand_left:
                left -= 1
                total_len += len(lines[left])

            if total_len >= min_len:
                break

            if expand_right:
                right += 1
                total_len += len(lines[right])

        chunk = "\n".join(lines[left:right + 1])

        # 如果太长，截取
        if len(chunk) > max_len:
            chunk = self._trim_around_keyword(chunk, keywords, max_len)

        return self._highlight(chunk, keywords)

    def _trim_around_keyword(self, text: str, keywords: list[str], max_len: int) -> str:
        """围绕关键词截取"""
        positions = [text.find(kw) for kw in keywords if kw in text]
        if not positions:
            return text[:max_len]

        pos = min(positions)
        start = max(pos - max_len // 3, 0)
        end = start + max_len

        chunk = text[start:end]

        if start > 0:
            chunk = "..." + chunk

        if end < len(text):
            chunk = chunk + "..."

        return chunk

    def _highlight(self, text: str, keywords: list[str]) -> str:
        """高亮关键词"""
        for kw in sorted(keywords, key=len, reverse=True):
            text = text.replace(kw, f"【{kw}】")
        return text

    def _score(self, content: str, keywords: list[str], source: str) -> int:
        """计算分数"""
        base = 0

        for kw in keywords:
            base += content.count(kw) * 10

        # FTS 结果额外加分
        if source == "fts":
            base += 5

        return base


# 全局实例
kb_service = KBService()
