"""知识库管理 API - 完整 CRUD

参照 FlAgent 和 corpus 项目的知识库逻辑实现：
- 创建知识库：选择目录 → 输入名称/描述/语种 → 构建 FTS5 索引
- 删除知识库：删除目录和索引
- 列出/搜索知识库
- 启用/禁用知识库
- 目录浏览
"""

import os
import re
import json
import shutil
import sqlite3
from pathlib import Path
from fastapi import APIRouter, HTTPException
from backend.config import load_json, save_json, DATA_DIR
from backend.models import ApiResponse
from backend.services.subtitle_cleaner import subtitle_cleaner

router = APIRouter(prefix="/api/kb", tags=["knowledge_bases"])

# 知识库存储根目录
KB_ROOT = DATA_DIR.parent / "kb"
KB_ROOT.mkdir(parents=True, exist_ok=True)

KB_REGISTRY_FILE = DATA_DIR / "kb_registry.json"

SUPPORTED_EXTS = {
    ".txt", ".md", ".markdown",
    ".json", ".jsonl",
    ".csv", ".tsv",
    ".html", ".htm",
    ".srt", ".vtt",
    ".ass", ".ssa",
}


def _load_registry() -> dict:
    return load_json(KB_REGISTRY_FILE, {"knowledge_bases": {}})


def _save_registry(registry: dict):
    save_json(KB_REGISTRY_FILE, registry)


def safe_read_text(path: str) -> str | None:
    """安全读取文本文件，自动检测编码"""
    encodings = ["utf-8", "utf-8-sig", "gb18030", "shift_jis", "cp932"]
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
        except Exception:
            return None
    return None


def split_chunks(text: str, max_chars: int = 1200) -> list[str]:
    """将文本分割为块"""
    raw_parts = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    for part in raw_parts:
        if len(part) <= max_chars:
            chunks.append(part)
        else:
            for i in range(0, len(part), max_chars):
                sub = part[i:i + max_chars].strip()
                if sub:
                    chunks.append(sub)
    return chunks


def _create_fts_table(conn: sqlite3.Connection) -> str:
    """创建 FTS5 虚拟表，优先使用 trigram tokenizer"""
    conn.execute("DROP TABLE IF EXISTS docs")
    try:
        conn.execute("""
            CREATE VIRTUAL TABLE docs USING fts5(
                filename UNINDEXED,
                chunk_id UNINDEXED,
                content,
                tokenize='trigram'
            )
        """)
        return "trigram"
    except sqlite3.OperationalError:
        conn.execute("DROP TABLE IF EXISTS docs")
        conn.execute("""
            CREATE VIRTUAL TABLE docs USING fts5(
                filename UNINDEXED,
                chunk_id UNINDEXED,
                content
            )
        """)
        return "default"


def _ingest_files(conn: sqlite3.Connection, folder: str) -> dict:
    """将目录中的文件导入知识库"""
    file_count = 0
    chunk_count = 0
    skipped_ext = 0
    skipped_empty = 0
    failed = 0

    # 字幕格式扩展名
    subtitle_exts = {".ass", ".ssa", ".srt", ".vtt"}

    for root, _, files in os.walk(folder):
        for filename in files:
            full = os.path.join(root, filename)
            ext = Path(filename).suffix.lower()

            if ext not in SUPPORTED_EXTS:
                skipped_ext += 1
                continue

            text = safe_read_text(full)
            if text is None:
                failed += 1
                continue

            text = text.strip()
            if not text:
                skipped_empty += 1
                continue

            # 检测并清理字幕格式
            # 1. 根据扩展名
            # 2. 根据内容检测（文件扩展名可能是 .md 但内容是 ASS 格式）
            should_clean = ext in subtitle_exts
            if not should_clean and ext in {".md", ".txt"}:
                # 检测内容是否是 ASS 格式
                if '[Script Info]' in text or '[V4+ Styles]' in text or '[Events]' in text:
                    should_clean = True
                # 检测内容是否是 SRT 格式
                elif re.search(r'\d+\r?\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}', text):
                    should_clean = True
                # 检测内容是否是 VTT 格式
                elif text.strip().startswith('WEBVTT'):
                    should_clean = True

            if should_clean:
                text = subtitle_cleaner.clean(text)
                if not text:
                    skipped_empty += 1
                    continue

            chunks = split_chunks(text)
            inserted = 0
            for i, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                conn.execute(
                    "INSERT INTO docs(filename, chunk_id, content) VALUES (?, ?, ?)",
                    (full, str(i), chunk)
                )
                inserted += 1

            if inserted:
                file_count += 1
                chunk_count += inserted

    return {
        "files": file_count,
        "chunks": chunk_count,
        "skipped_ext": skipped_ext,
        "skipped_empty": skipped_empty,
        "failed": failed,
    }


# ── API 端点 ──────────────────────────────────────────────────

@router.get("")
def list_knowledge_bases(
    lang: str = None,
    q: str = None,
    tags: str = None,
    page: int = 1,
    size: int = 50,
):
    """列出所有知识库（自动发现已有数据库）"""
    registry = _load_registry()

    # 自动发现 kb 目录下的已有数据库
    if KB_ROOT.exists():
        for d in KB_ROOT.iterdir():
            if d.is_dir() and (d / "kb.db").exists():
                kb_name = d.name
                if kb_name not in registry.get("knowledge_bases", {}):
                    # 读取 meta.json
                    meta_path = d / "meta.json"
                    meta = {}
                    if meta_path.exists():
                        try:
                            meta = json.loads(meta_path.read_text(encoding="utf-8"))
                        except Exception:
                            pass

                    # 获取数据库统计
                    stats = meta.get("stats", {"files": 0, "chunks": 0})
                    if not stats.get("chunks"):
                        try:
                            conn = sqlite3.connect(str(d / "kb.db"))
                            count = conn.execute("SELECT COUNT(*) FROM docs").fetchone()[0]
                            stats["chunks"] = count
                            conn.close()
                        except Exception:
                            pass

                    kb_meta = {
                        "name": kb_name,
                        "description": meta.get("description", meta.get("desc", "")),
                        "lang": meta.get("lang", ""),
                        "tags": meta.get("tags", []),
                        "source_path": meta.get("source_path", meta.get("path", "")),
                        "db_path": str(d / "kb.db"),
                        "tokenizer": meta.get("tokenizer", ""),
                        "stats": stats,
                        "enabled": True,
                    }
                    registry.setdefault("knowledge_bases", {})[kb_name] = kb_meta

        _save_registry(registry)

    kbs = list(registry.get("knowledge_bases", {}).values())

    # 语言筛选
    if lang:
        kbs = [kb for kb in kbs if kb.get("lang") == lang]

    # 搜索
    if q:
        q_lower = q.lower()
        kbs = [
            kb for kb in kbs
            if q_lower in kb.get("name", "").lower()
            or q_lower in kb.get("description", "").lower()
        ]

    # 标签筛选
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        kbs = [
            kb for kb in kbs
            if any(tag in kb.get("tags", []) for tag in tag_list)
        ]

    # 分页
    total = len(kbs)
    start = (page - 1) * size
    end = start + size
    items = kbs[start:end]

    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/browse/dirs")
def browse_directories(path: str = "/"):
    """浏览目录（用于前端选择知识库源目录）"""
    if not os.path.exists(path):
        raise HTTPException(400, "路径不存在")

    if not os.path.isdir(path):
        raise HTTPException(400, "路径不是目录")

    dirs = []
    try:
        for entry in sorted(os.listdir(path)):
            full = os.path.join(path, entry)
            if os.path.isdir(full) and not entry.startswith("."):
                dirs.append({"name": entry, "path": full})
    except PermissionError:
        raise HTTPException(403, "无权限访问")

    return {"path": path, "dirs": dirs}


@router.get("/{kb_name}")
def get_knowledge_base(kb_name: str):
    """获取知识库详情"""
    registry = _load_registry()
    kb = registry.get("knowledge_bases", {}).get(kb_name)

    if not kb:
        raise HTTPException(404, f"知识库不存在: {kb_name}")

    return kb


@router.post("")
def create_knowledge_base(req: dict):
    """创建知识库

    请求体：
    {
        "name": "anime",           // 知识库名称（唯一）
        "source_path": "/path/to", // 源文件目录
        "description": "动画字幕",  // 描述
        "lang": "ja",              // 语言
        "tags": ["动画", "字幕"]    // 标签
    }
    """
    kb_name = req.get("name", "").strip()
    source_path = req.get("source_path", "").strip()
    description = req.get("description", "")
    lang = req.get("lang", "")
    tags = req.get("tags", [])

    if not kb_name:
        raise HTTPException(400, "知识库名称不能为空")

    if not source_path:
        raise HTTPException(400, "源文件目录不能为空")

    if not os.path.exists(source_path):
        raise HTTPException(400, f"源路径不存在: {source_path}")

    if not os.path.isdir(source_path):
        raise HTTPException(400, f"路径不是目录: {source_path}")

    # 检查是否已存在
    registry = _load_registry()
    if kb_name in registry.get("knowledge_bases", {}):
        raise HTTPException(409, f"知识库已存在: {kb_name}")

    # 创建知识库目录
    kb_dir = KB_ROOT / kb_name
    kb_dir.mkdir(parents=True, exist_ok=True)
    db_path = kb_dir / "kb.db"

    # 创建 FTS5 数据库
    conn = sqlite3.connect(str(db_path))
    tokenizer = _create_fts_table(conn)

    # 导入文件
    stats = _ingest_files(conn, source_path)

    conn.commit()
    conn.close()

    # 保存元数据
    kb_meta = {
        "name": kb_name,
        "description": description,
        "lang": lang,
        "tags": tags if isinstance(tags, list) else [],
        "source_path": source_path,
        "db_path": str(db_path),
        "tokenizer": tokenizer,
        "stats": stats,
        "enabled": True,
    }

    meta_path = kb_dir / "meta.json"
    meta_path.write_text(json.dumps(kb_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # 更新注册表
    registry.setdefault("knowledge_bases", {})[kb_name] = kb_meta
    _save_registry(registry)

    return ApiResponse(message=f"知识库 {kb_name} 创建成功", data=kb_meta)


@router.put("/{kb_name}")
def update_knowledge_base(kb_name: str, req: dict):
    """更新知识库信息（描述、语言、标签）"""
    registry = _load_registry()
    kb = registry.get("knowledge_bases", {}).get(kb_name)

    if not kb:
        raise HTTPException(404, f"知识库不存在: {kb_name}")

    # 更新字段
    if "description" in req:
        kb["description"] = req["description"]
    if "lang" in req:
        kb["lang"] = req["lang"]
    if "tags" in req:
        kb["tags"] = req["tags"] if isinstance(req["tags"], list) else []
    if "enabled" in req:
        kb["enabled"] = req["enabled"]

    # 保存到注册表
    registry["knowledge_bases"][kb_name] = kb
    _save_registry(registry)

    # 同步更新 meta.json
    kb_dir = KB_ROOT / kb_name
    meta_path = kb_dir / "meta.json"
    if meta_path.exists():
        meta_path.write_text(json.dumps(kb, ensure_ascii=False, indent=2), encoding="utf-8")

    return ApiResponse(message=f"知识库 {kb_name} 更新成功", data=kb)


@router.delete("/{kb_name}")
def delete_knowledge_base(kb_name: str):
    """删除知识库"""
    registry = _load_registry()
    if kb_name not in registry.get("knowledge_bases", {}):
        raise HTTPException(404, f"知识库不存在: {kb_name}")

    # 删除知识库目录
    kb_dir = KB_ROOT / kb_name
    if kb_dir.exists():
        shutil.rmtree(kb_dir)

    # 从注册表移除
    del registry["knowledge_bases"][kb_name]
    _save_registry(registry)

    return ApiResponse(message=f"知识库 {kb_name} 已删除")


@router.post("/{kb_name}/toggle")
def toggle_knowledge_base(kb_name: str):
    """启用/禁用知识库"""
    registry = _load_registry()
    kb = registry.get("knowledge_bases", {}).get(kb_name)

    if not kb:
        raise HTTPException(404, f"知识库不存在: {kb_name}")

    kb["enabled"] = not kb.get("enabled", True)
    registry["knowledge_bases"][kb_name] = kb
    _save_registry(registry)

    # 同步更新 meta.json
    kb_dir = KB_ROOT / kb_name
    meta_path = kb_dir / "meta.json"
    if meta_path.exists():
        meta_path.write_text(json.dumps(kb, ensure_ascii=False, indent=2), encoding="utf-8")

    status = "启用" if kb["enabled"] else "禁用"
    return ApiResponse(message=f"知识库 {kb_name} 已{status}", data={"enabled": kb["enabled"]})


@router.get("/{kb_name}/search")
def search_in_knowledge_base(
    kb_name: str,
    q: str,
    page: int = 1,
    size: int = 20,
    min_len: int = 15,
):
    """在指定知识库中搜索"""
    registry = _load_registry()
    kb = registry.get("knowledge_bases", {}).get(kb_name)

    if not kb:
        raise HTTPException(404, f"知识库不存在: {kb_name}")

    db_path = kb.get("db_path", "")
    if not db_path or not os.path.exists(db_path):
        raise HTTPException(500, "知识库数据库文件不存在")

    keywords = [kw.strip() for kw in q.split(",") if kw.strip()]
    if not keywords:
        keywords = [q]

    # 搜索
    conn = sqlite3.connect(db_path)
    results = []
    seen = set()
    seen_snippets = set()  # 用于去重 snippet

    for kw in keywords:
        rows = _search_one_keyword(conn, kw, limit=size * 10)
        for filename, chunk_id, content, source in rows:
            key = (filename, chunk_id)
            if key in seen:
                continue
            seen.add(key)

            snippet = _build_snippet(content, keywords)
            if len(snippet) < min_len:
                continue

            # 去重 snippet（避免返回大量重复内容）
            snippet_key = snippet[:100]  # 使用前100字符作为去重键
            if snippet_key in seen_snippets:
                continue
            seen_snippets.add(snippet_key)

            score = _score_result(content, keywords, source)
            results.append({
                "file": filename,
                "chunk": chunk_id,
                "snippet": snippet,
                "score": score,
                "source": source,
                "kb_name": kb_name,
            })

    conn.close()

    # 排序和分页
    results.sort(key=lambda x: x["score"], reverse=True)
    total = len(results)
    start = (page - 1) * size
    end = start + size

    return {
        "items": results[start:end],
        "total": total,
        "kb_name": kb_name,
        "query": q,
    }


def _search_one_keyword(conn: sqlite3.Connection, kw: str, limit: int) -> list:
    """双通道搜索：FTS5 MATCH + LIKE 兜底"""
    rows = []

    # FTS 搜索
    try:
        fts_rows = conn.execute(
            "SELECT filename, chunk_id, content FROM docs WHERE docs MATCH ? LIMIT ?",
            (f'"{kw}"', limit)
        ).fetchall()
        rows.extend([(f, c, content, "fts") for f, c, content in fts_rows])
    except sqlite3.OperationalError:
        pass

    # LIKE 搜索
    try:
        like_rows = conn.execute(
            "SELECT filename, chunk_id, content FROM docs WHERE content LIKE ? LIMIT ?",
            (f"%{kw}%", limit)
        ).fetchall()
        rows.extend([(f, c, content, "like") for f, c, content in like_rows])
    except sqlite3.OperationalError:
        pass

    return rows


def _build_snippet(text: str, keywords: list[str], min_len: int = 80, max_len: int = 300) -> str:
    """构建上下文感知的摘要"""
    # 清理格式代码
    text = _clean_formatting(text)
    lines = text.split("\n")

    # 过滤掉 Drawing 命令和空行
    lines = [line for line in lines if line.strip() and not re.match(r'^[ml\s\d.-]+$', line.strip())]

    if not lines:
        return ""

    # 找到第一个命中行
    hit_idx = -1
    for i, line in enumerate(lines):
        if any(kw in line for kw in keywords):
            hit_idx = i
            break

    if hit_idx == -1:
        return _highlight("\n".join(lines)[:max_len], keywords)

    if len(lines[hit_idx]) >= max_len:
        return _highlight(lines[hit_idx][:max_len], keywords)

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

    if len(chunk) > max_len:
        chunk = _trim_around_keyword(chunk, keywords, max_len)

    return _highlight(chunk, keywords)


def _clean_formatting(text: str) -> str:
    """清理格式代码"""
    lines = text.split('\n')
    cleaned_lines = []

    for line in lines:
        line = line.strip()

        # 跳过 Drawing 命令
        if re.match(r'^[ml\s\d.-]+$', line) and ('m ' in line or 'l ' in line):
            continue

        # 跳过 Dialogue 行前缀
        if line.startswith('Dialogue:'):
            parts = line.split(',', 9)
            if len(parts) >= 10:
                line = parts[9]
                # 去除 ASS 格式代码
                line = re.sub(r'\{[^}]*\}', '', line)
                line = line.replace('\\N', ' ').replace('\\n', ' ')

        # 去除多余空白
        line = re.sub(r'\s+', ' ', line).strip()

        if line and len(line) > 1:
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines)


def _trim_around_keyword(text: str, keywords: list[str], max_len: int) -> str:
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


def _highlight(text: str, keywords: list[str]) -> str:
    """高亮关键词"""
    for kw in sorted(keywords, key=len, reverse=True):
        text = text.replace(kw, f"【{kw}】")
    return text


def _score_result(content: str, keywords: list[str], source: str) -> int:
    """计算搜索结果分数"""
    base = 0
    for kw in keywords:
        base += content.count(kw) * 10
    if source == "fts":
        base += 5
    return base
