"""词语管理 API"""

from datetime import datetime
from typing import Any
from fastapi import APIRouter, HTTPException
from backend.config import (
    load_pending_words, save_pending_words,
    load_processed_entries, save_processed_entries,
    get_language_config,
)
from backend.models import (
    AddWordRequest, AddWordBatchRequest, UpdateWordRequest,
    PendingWord, ProcessedEntry, ApiResponse,
)

router = APIRouter(prefix="/api/words", tags=["words"])


@router.get("")
def list_words(
    lang: str = None,
    collection_id: str = None,
    status: str = None,
    q: str = "",
    page: int = 1,
    size: int = 50,
):
    """获取待处理词语列表"""
    words = load_pending_words(lang)

    # 词语库筛选
    if collection_id:
        words = [w for w in words if w.get("collection_id") == collection_id]

    # 状态筛选
    if status:
        words = [w for w in words if w.get("status") == status]

    # 搜索
    if q:
        q_lower = q.lower()
        words = [
            w for w in words
            if q_lower in w.get("word", "").lower()
            or q_lower in str(w.get("json_input", {})).lower()
        ]

    # 分页
    total = len(words)
    start = (page - 1) * size
    end = start + size
    items = words[start:end]

    return {"items": items, "total": total, "page": page, "size": size}


@router.post("")
def add_word(req: AddWordRequest):
    """添加单个词语"""
    if not req.word.strip():
        raise HTTPException(400, "词语不能为空")

    if not req.collection_id:
        raise HTTPException(400, "请选择词语库")

    # 加载现有词语
    words = load_pending_words()

    # 检查重复
    existing = next(
        (w for w in words
         if w["word"] == req.word and w["collection_id"] == req.collection_id),
        None
    )
    if existing:
        raise HTTPException(409, f"词语已存在: {req.word}")

    # 创建新词语
    new_word = PendingWord(
        lang=req.lang,
        collection_id=req.collection_id,
        word=req.word.strip(),
        json_input=req.json_input,
        knowledge_bases=req.knowledge_bases,
        fallback_words=[w.strip() for w in req.fallback_words if w.strip()],
    )

    words.append(new_word.model_dump())
    save_pending_words(words)

    return ApiResponse(message="添加成功", data=new_word.model_dump())


@router.put("/{word_id}")
def update_word(word_id: str, req: UpdateWordRequest):
    """更新待处理词语"""
    words = load_pending_words()
    word = next((w for w in words if w["id"] == word_id), None)

    if not word:
        raise HTTPException(404, "词语不存在")

    # 更新字段
    if req.word:
        word["word"] = req.word.strip()
    if req.json_input:
        word["json_input"] = req.json_input
    if req.knowledge_bases is not None:
        word["knowledge_bases"] = req.knowledge_bases
    if req.fallback_words is not None:
        word["fallback_words"] = req.fallback_words

    word["updated_at"] = datetime.now().isoformat()

    save_pending_words(words)

    return ApiResponse(message="更新成功", data=word)


@router.post("/batch")
def add_words_batch(req: AddWordBatchRequest):
    """批量添加词语"""
    if not req.collection_id:
        raise HTTPException(400, "请选择词语库")

    words = load_pending_words()
    existing_words = {w["word"] for w in words if w["collection_id"] == req.collection_id}
    added = []

    for item in req.words:
        word = item.get("word", "").strip()
        if not word or word in existing_words:
            continue

        new_word = PendingWord(
            lang=req.lang,
            collection_id=req.collection_id,
            word=word,
            json_input=item.get("json_input", {}),
            knowledge_bases=item.get("knowledge_bases", []),
            fallback_words=item.get("fallback_words", []),
        )

        words.append(new_word.model_dump())
        existing_words.add(word)
        added.append(new_word.model_dump())

    save_pending_words(words)

    return ApiResponse(message=f"添加了 {len(added)} 个词语", data=added)


@router.get("/processed")
def list_processed_words(
    lang: str = None,
    collection_id: str = None,
    q: str = "",
    page: int = 1,
    size: int = 50,
):
    """获取已处理词语列表"""
    # 加载所有已处理词语
    all_entries = []

    # 如果指定了词语库，只加载该词语库
    if collection_id:
        entries = load_processed_entries(collection_id)
        for entry in entries:
            entry["_collection"] = collection_id
        all_entries.extend(entries)
    else:
        # 加载所有词语库
        from backend.config import DATA_DIR
        output_dir = DATA_DIR / "output"
        if output_dir.exists():
            for json_file in output_dir.glob("*.json"):
                if json_file.name.startswith("_"):
                    continue
                collection = json_file.stem
                entries = load_processed_entries(collection)
                for entry in entries:
                    entry["_collection"] = collection
                all_entries.extend(entries)

    # 语言筛选
    if lang:
        all_entries = [e for e in all_entries if e.get("lang") == lang]

    # 搜索
    if q:
        q_lower = q.lower()
        all_entries = [
            e for e in all_entries
            if q_lower in e.get("word", "").lower()
            or q_lower in e.get("pron", "").lower()
            or q_lower in e.get("meaning_zh", "").lower()
        ]

    # 分页
    total = len(all_entries)
    start = (page - 1) * size
    end = start + size
    items = all_entries[start:end]

    return {"items": items, "total": total, "page": page, "size": size}


@router.delete("/{word_id}")
def delete_word(word_id: str):
    """删除待处理词语"""
    words = load_pending_words()
    word = next((w for w in words if w["id"] == word_id), None)

    if not word:
        raise HTTPException(404, "词语不存在")

    words = [w for w in words if w["id"] != word_id]
    save_pending_words(words)

    return ApiResponse(message="删除成功")


@router.post("/batch-delete")
def batch_delete_words(body: dict):
    """批量删除待处理词语"""
    word_ids = body.get("word_ids", [])
    if not word_ids:
        raise HTTPException(400, "请选择要删除的词语")

    words = load_pending_words()
    id_set = set(word_ids)
    before = len(words)
    words = [w for w in words if w["id"] not in id_set]
    deleted = before - len(words)

    save_pending_words(words)

    return ApiResponse(message=f"成功删除 {deleted} 个词语")


@router.post("/processed/batch-delete")
def batch_delete_processed_words(body: dict):
    """批量删除已处理词语"""
    collection_id = body.get("collection_id")
    word_list = body.get("words", [])

    if not collection_id:
        raise HTTPException(400, "请指定词语库")
    if not word_list:
        raise HTTPException(400, "请选择要删除的词语")

    entries = load_processed_entries(collection_id)
    word_set = set(word_list)
    before = len(entries)
    entries = [e for e in entries if e.get("word") not in word_set]
    deleted = before - len(entries)

    save_processed_entries(collection_id, entries)

    return ApiResponse(message=f"成功从 {collection_id} 删除 {deleted} 个词语")


@router.delete("/processed/{collection_id}/{word}")
def delete_processed_word(collection_id: str, word: str):
    """删除已处理词语"""
    entries = load_processed_entries(collection_id)
    before = len(entries)
    entries = [e for e in entries if e.get("word") != word]

    if len(entries) == before:
        raise HTTPException(404, "词语不存在")

    save_processed_entries(collection_id, entries)

    return ApiResponse(message=f"已从 {collection_id} 删除: {word}")


@router.put("/processed/{collection_id}/{word}")
def update_processed_word(collection_id: str, word: str, body: dict[str, Any]):
    """更新已处理词语"""
    entries = load_processed_entries(collection_id)
    idx = next((i for i, e in enumerate(entries) if e.get("word") == word), None)

    if idx is None:
        raise HTTPException(404, f"词语不存在: {word}")

    # 去掉前端注入的 _collection 字段，不持久化
    body.pop("_collection", None)
    entries[idx] = body
    save_processed_entries(collection_id, entries)

    return ApiResponse(message="更新成功", data=body)


@router.post("/processed/{collection_id}/{word}/reprocess")
def reprocess_processed_word(collection_id: str, word: str, body: dict[str, Any] = {}):
    """将已处理词语从词库删除并重新加入待处理队列

    Args:
        collection_id: 词库 ID
        word: 词语
        body: 可选参数，包含 lang, json_input, knowledge_bases, fallback_words 等
    """
    # 1. 从输出词库删除
    entries = load_processed_entries(collection_id)
    entry_to_reprocess = next((e for e in entries if e.get("word") == word), None)

    if not entry_to_reprocess:
        raise HTTPException(404, f"词语不存在于词库 {collection_id}: {word}")

    # 从词库中删除
    entries = [e for e in entries if e.get("word") != word]
    save_processed_entries(collection_id, entries)

    # 2. 重新加入待处理队列
    # 获取语言信息（从 body 或根据 collection_id 推断）
    lang = body.get("lang", "")
    if not lang:
        # 尝试从 languages.json 推断语言
        from backend.config import load_languages
        languages = load_languages()
        for lang_code, lang_config in languages.get("languages", {}).items():
            for col in lang_config.get("collections", []):
                if col["id"] == collection_id:
                    lang = lang_code
                    break
            if lang:
                break

    # 构建 json_input（保留原有词条信息）
    json_input = body.get("json_input", {})
    if not json_input:
        # 从已处理词条中提取基本信息
        json_input = {
            "word": entry_to_reprocess.get("word", ""),
            "pron": entry_to_reprocess.get("pron", ""),
            "pos": entry_to_reprocess.get("pos", ""),
            "meaning_zh": entry_to_reprocess.get("meaning_zh") or entry_to_reprocess.get("meaning", ""),
        }

    # 获取知识库和兜底词
    knowledge_bases = body.get("knowledge_bases", [])
    fallback_words = body.get("fallback_words", [])

    # 创建新的待处理词语
    new_pending_word = {
        "id": f"{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "lang": lang,
        "collection_id": collection_id,
        "word": word,
        "json_input": json_input,
        "knowledge_bases": knowledge_bases,
        "fallback_words": fallback_words,
        "status": "pending",
        "error": "",
        "added_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }

    # 加载现有待处理词语并添加
    pending_words = load_pending_words()

    # 检查是否已存在
    existing = next(
        (w for w in pending_words
         if w["word"] == word and w["collection_id"] == collection_id and w["status"] == "pending"),
        None
    )
    if existing:
        # 如果已存在待处理的相同词语，更新它
        existing.update({
            "json_input": json_input,
            "knowledge_bases": knowledge_bases,
            "fallback_words": fallback_words,
            "updated_at": datetime.now().isoformat(),
        })
    else:
        pending_words.append(new_pending_word)

    save_pending_words(pending_words)

    return ApiResponse(
        message=f"已将 {word} 从词库 {collection_id} 删除并重新加入待处理队列",
        data=new_pending_word
    )


@router.post("/processed/batch-reprocess")
def batch_reprocess_words(body: dict):
    """批量将已处理词语重新加入待处理队列

    Body:
        collection_id: 词库 ID
        words: 词语列表
        lang: 语言代码（可选）
        knowledge_bases: 知识库列表（可选）
        fallback_words_map: 兜底词映射（可选，格式: {word: [fallback1, fallback2]}）
    """
    collection_id = body.get("collection_id")
    word_list = body.get("words", [])
    lang = body.get("lang", "")
    knowledge_bases = body.get("knowledge_bases", [])
    fallback_words_map = body.get("fallback_words_map", {})

    if not collection_id:
        raise HTTPException(400, "请指定词语库")
    if not word_list:
        raise HTTPException(400, "请选择要处理的词语")

    # 尝试推断语言
    if not lang:
        from backend.config import load_languages
        languages = load_languages()
        for lang_code, lang_config in languages.get("languages", {}).items():
            for col in lang_config.get("collections", []):
                if col["id"] == collection_id:
                    lang = lang_code
                    break
            if lang:
                break

    # 1. 从输出词库删除
    entries = load_processed_entries(collection_id)
    word_set = set(word_list)
    removed_entries = [e for e in entries if e.get("word") in word_set]
    remaining_entries = [e for e in entries if e.get("word") not in word_set]

    if len(removed_entries) == 0:
        raise HTTPException(404, "未找到指定词语")

    save_processed_entries(collection_id, remaining_entries)

    # 2. 重新加入待处理队列
    pending_words = load_pending_words()
    existing_pending = {
        (w["word"], w["collection_id"]): w
        for w in pending_words
        if w["status"] == "pending"
    }

    added_count = 0
    updated_count = 0
    now = datetime.now().isoformat()

    for entry in removed_entries:
        word = entry.get("word", "")
        if not word:
            continue

        # 构建 json_input
        json_input = {
            "word": word,
            "pron": entry.get("pron", ""),
            "pos": entry.get("pos", ""),
            "meaning_zh": entry.get("meaning_zh") or entry.get("meaning", ""),
        }

        # 获取兜底词
        fallback_words = fallback_words_map.get(word, [])

        key = (word, collection_id)
        if key in existing_pending:
            # 更新已存在的待处理词语
            existing_pending[key].update({
                "json_input": json_input,
                "knowledge_bases": knowledge_bases,
                "fallback_words": fallback_words,
                "updated_at": now,
            })
            updated_count += 1
        else:
            # 创建新的待处理词语
            new_word = {
                "id": f"{datetime.now().strftime('%Y%m%d%H%M%S%f')}{added_count:04d}",
                "lang": lang,
                "collection_id": collection_id,
                "word": word,
                "json_input": json_input,
                "knowledge_bases": knowledge_bases,
                "fallback_words": fallback_words,
                "status": "pending",
                "error": "",
                "added_at": now,
                "updated_at": now,
            }
            pending_words.append(new_word)
            added_count += 1

    save_pending_words(pending_words)

    return ApiResponse(
        message=f"已将 {len(removed_entries)} 个词语从词库 {collection_id} 删除并重新加入待处理队列（新增 {added_count}，更新 {updated_count}）",
        data={
            "removed": len(removed_entries),
            "added": added_count,
            "updated": updated_count,
        }
    )
