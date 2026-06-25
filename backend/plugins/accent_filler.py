"""OJAD 声调填充插件

从 OJAD (Online Japanese Accent Dictionary) 查询日语单词的声调信息，
填充到已处理词条的 accent 字段。

来源: https://www.gavo.t.u-tokyo.ac.jp/ojad/
参考: /home/florent/projects/anki-maker/ankimaker/accent.py
"""

from __future__ import annotations

import asyncio
import re
import time
from pathlib import Path
from typing import Optional

import httpx
from loguru import logger

from backend.plugins import BasePlugin

# ── OJAD 查询 URL ────────────────────────────────────────────
OJAD_BASE_URL = (
    "https://www.gavo.t.u-tokyo.ac.jp/ojad/search/index/display:print"
    "/sortprefix:accent/narabi1:kata_asc/narabi2:accent_desc/narabi3:mola_asc"
    "/yure:invisible/curve:invisible/details:invisible/limit:100/word:"
)

# ── 缓存目录 ──────────────────────────────────────────────────
CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "cache" / "ojad"

# ── 数字 → 带圈数字映射 ──────────────────────────────────────
_CIRCLED = "⓪①②③④⑤⑥⑦⑧⑨"


def accent_to_circled(n: int | None) -> str:
    """将声调数字转换为带圈符号"""
    if n is None:
        return ""
    if 0 <= n < len(_CIRCLED):
        return _CIRCLED[n]
    return f"({n})"


def _extract_accent_from_html(html: str) -> tuple[int | None, str]:
    """从 OJAD 返回的 HTML 中提取声调数值

    Returns:
        (accent_number, info) 或 (None, error_msg)
    """
    # 查找第一个结果行
    row_match = re.search(r'<tr id="word_\d+">(.*?)</tr>', html, re.S)
    if not row_match:
        return None, "no word row found"

    row_html = row_match.group(1)

    # 查找第一个活用形单元格（辞书形）
    cell_match = re.search(r'<td class="katsuyo[^"]*">(.*?)</td>', row_html, re.S)
    if not cell_match:
        return None, "no katsuyo cell found"

    cell_html = cell_match.group(1)

    # 提取所有 mora 标记
    mora_pattern = re.findall(
        r'<span class="([^"]*mola_-(\d+)[^"]*)"[^>]*>',
        cell_html,
    )

    if not mora_pattern:
        return None, "no mora spans found"

    total_moras = len(mora_pattern)
    accent_from_end = None

    for class_str, mola_num in mora_pattern:
        if "accent_top" in class_str:
            accent_from_end = int(mola_num)
            break

    if accent_from_end is None:
        # 无 accent_top → 平板型 (0)
        return 0, "heiban"

    # 声调 = 总音拍数 - 倒数位置 + 1
    accent = total_moras - accent_from_end + 1
    return accent, "kifuku"


async def get_accent_async(word: str, use_cache: bool = True, delay: float = 0.3) -> int | None:
    """异步查询单个日语单词的声调类型

    Args:
        word: 日语单词（汉字或假名）
        use_cache: 是否使用本地缓存
        delay: 请求延迟（秒）

    Returns:
        声调数字（0, 1, 2, …），查询失败返回 None
    """
    if not word or re.search(r"[\(\（\～\~]", word):
        return None

    # 检查缓存
    cache_file = None
    if use_cache:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_key = re.sub(r"[^\w]", "_", word)
        cache_file = CACHE_DIR / f"{cache_key}.html"

        if cache_file.exists():
            html = cache_file.read_text(encoding="utf-8")
            if html:
                accent, _ = _extract_accent_from_html(html)
                if accent is not None:
                    return accent

    # 网络请求（使用线程池避免阻塞事件循环）
    url = OJAD_BASE_URL + word

    def _fetch():
        import requests
        try:
            r = requests.get(url, timeout=30)
            return r.text
        except Exception as e:
            logger.warning(f"OJAD 请求失败: {word} - {e}")
            return None

    loop = asyncio.get_event_loop()
    html = await loop.run_in_executor(None, _fetch)

    if html is None:
        return None

    # 写入缓存
    if cache_file:
        cache_file.write_text(html, encoding="utf-8")

    if "search_result_message" in html:
        # OJAD 中没有该词
        return None

    accent, info = _extract_accent_from_html(html)

    # 礼貌延迟
    if delay > 0:
        await asyncio.sleep(delay)

    return accent


class AccentFillerPlugin(BasePlugin):
    """OJAD 声调填充插件"""

    @property
    def id(self) -> str:
        return "accent_filler"

    @property
    def name(self) -> str:
        return "声调填充 (OJAD)"

    @property
    def description(self) -> str:
        return "从 OJAD 查询日语单词的声调信息，填充缺失的 accent 字段。支持缓存以避免重复请求。"

    @property
    def supported_languages(self) -> list[str]:
        return ["ja"]

    @property
    def target_field(self) -> str:
        return "accent"

    def should_process(self, entry: dict) -> bool:
        """只处理日语且 accent 为空的词条"""
        if entry.get("lang") != "ja":
            return False
        accent = entry.get("accent", "")
        return not accent or not str(accent).strip()

    async def process_entry(self, entry: dict, config: dict) -> dict:
        """查询并填充声调

        Args:
            entry: 词条数据
            config: 配置项
                - delay: 请求延迟（秒，默认 0.3）
                - use_cache: 是否使用缓存（默认 True）

        Returns:
            更新后的词条数据
        """
        word = entry.get("word", "")
        delay = config.get("delay", 0.3)
        use_cache = config.get("use_cache", True)

        accent_num = await get_accent_async(word, use_cache=use_cache, delay=delay)

        if accent_num is not None:
            return {"accent": accent_to_circled(accent_num)}

        return {}
