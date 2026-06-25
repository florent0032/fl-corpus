"""词语处理 API

处理流程：
1. 用户选择供应商、模型、提示词、输出格式、知识库
2. 系统读取待处理词语（包含用户填写的所有字段）
3. 对每个词语：知识库检索 → 注入 JSON + 用例 → LLM 生成 → 输出格式验证 → 保存
"""

from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException
from backend.config import (
    load_pending_words, save_pending_words,
    load_processed_entries, save_processed_entries,
    get_vendor_by_id, get_prompt_by_id, load_languages,
    load_json, save_json, DATA_DIR,
)
from backend.models import ProcessStartRequest, ApiResponse
from backend.services.process_service import process_service

router = APIRouter(prefix="/api/process", tags=["process"])

# 任务历史持久化文件
TASKS_FILE = DATA_DIR / "tasks.json"

# 最多保留的历史任务数
MAX_HISTORY = 50


def load_task_history() -> list:
    """从磁盘加载任务历史"""
    data = load_json(TASKS_FILE, {"history": []})
    return data.get("history", [])


def save_task_history(history: list):
    """保存任务历史到磁盘"""
    save_json(TASKS_FILE, {"history": history})


# 当前任务状态
_current_task = {
    "task_id": None,
    "running": False,
    "total": 0,
    "processed": 0,
    "success": 0,
    "failed": 0,
    "current_word": "",
    "errors": [],
    "started_at": None,
    "ended_at": None,
}

# 已完成的任务历史（从磁盘加载）
_task_history: list = load_task_history()

# 当前任务处理的词语详情
_current_task_words: list = []


@router.post("/start")
async def start_processing(
    req: ProcessStartRequest,
    background_tasks: BackgroundTasks,
):
    """启动处理任务"""
    if _current_task["running"]:
        return ApiResponse(success=False, message="已有任务在运行")

    # 验证供应商
    vendor = get_vendor_by_id(req.vendor_id)
    if not vendor:
        return ApiResponse(success=False, message=f"供应商不存在: {req.vendor_id}")

    # 验证模型
    if req.model not in vendor.get("models", []):
        return ApiResponse(success=False, message=f"模型不存在: {req.model}")

    # 获取提示词
    prompt_template = ""
    if req.system_prompt_id:
        prompt = get_prompt_by_id(req.system_prompt_id)
        if prompt:
            prompt_template = prompt.get("template", "")

    # 如果没有指定提示词，使用语言默认提示词
    if not prompt_template and req.lang:
        languages = load_languages()
        lang_config = languages.get("languages", {}).get(req.lang, {})
        prompt_template_name = lang_config.get("prompt_template", "")
        if prompt_template_name:
            prompt = get_prompt_by_id(f"{req.lang}_basic")
            if prompt:
                prompt_template = prompt.get("template", "")

    # 获取输出格式
    output_format = {}
    output_format_name = ""
    if req.output_format_id:
        formats = load_json(DATA_DIR / "output_formats.json", {"formats": []})
        output_format = next(
            (f for f in formats.get("formats", []) if f["id"] == req.output_format_id),
            {}
        )
        output_format_name = output_format.get("name", req.output_format_id)

    # 获取提示词名称
    prompt_name = ""
    if req.system_prompt_id:
        prompt = get_prompt_by_id(req.system_prompt_id)
        if prompt:
            prompt_name = prompt.get("name", req.system_prompt_id)

    # 收集目标词库信息
    target_collections = []
    if req.lang:
        languages = load_languages()
        lang_config = languages.get("languages", {}).get(req.lang, {})
        lang_name = lang_config.get("name", req.lang)
        for col in lang_config.get("collections", []):
            target_collections.append({"id": col["id"], "name": col.get("name", col["id"])})
    else:
        lang_name = "全部"

    # 启动后台任务
    background_tasks.add_task(
        run_processing,
        vendor_id=req.vendor_id,
        vendor_name=vendor.get("name", req.vendor_id),
        model=req.model,
        prompt_template=prompt_template,
        prompt_name=prompt_name,
        output_format=output_format,
        output_format_name=output_format_name,
        lang=req.lang or "",
        lang_name=lang_name,
        target_collections=target_collections,
        config=req,
    )

    return ApiResponse(message="处理任务已启动")


@router.get("/status")
def get_process_status():
    """获取处理状态（兼容旧接口）"""
    return _current_task


@router.get("/tasks")
def get_tasks():
    """获取任务列表（当前任务 + 历史任务）"""
    return {
        "current": _current_task,
        "history": list(_task_history),
    }


@router.get("/tasks/current")
def get_current_task():
    """获取当前任务详情（含词语列表）"""
    return {
        "task": _current_task,
        "words": _current_task_words,
    }


@router.get("/tasks/{task_id}")
def get_task_by_id(task_id: str):
    """获取指定任务详情"""
    if _current_task.get("task_id") == task_id:
        return {
            "task": _current_task,
            "words": _current_task_words,
        }
    for task in _task_history:
        if task.get("task_id") == task_id:
            return {"task": task, "words": task.get("words", [])}
    raise HTTPException(404, f"任务不存在: {task_id}")


@router.post("/stop")
def stop_processing():
    """停止处理"""
    _current_task["running"] = False
    # 立即保存当前待处理词语状态，确保已处理的词不会丢失
    if _current_task_words:
        all_pending = load_pending_words()
        pending_index = {w["id"]: w for w in all_pending}
        for tw in _current_task_words:
            word_id = tw.get("id")
            status = tw.get("status")
            if word_id in pending_index and status in ("done", "failed"):
                pending_index[word_id]["status"] = status
                pending_index[word_id]["error"] = tw.get("error", "")
        save_pending_words(all_pending)
    return ApiResponse(message="已发送停止信号")


@router.post("/retry-failed")
async def retry_failed_words(
    req: ProcessStartRequest,
    background_tasks: BackgroundTasks,
):
    """重试当前任务中失败的词语"""
    if _current_task["running"]:
        return ApiResponse(success=False, message="已有任务在运行")

    # 找出失败的词语
    failed_words = [w for w in _current_task_words if w.get("status") == "failed"]
    if not failed_words:
        return ApiResponse(success=False, message="没有失败的词语需要重试")

    # 将失败词语的状态重置为 pending
    all_pending = load_pending_words()
    pending_index = {w["id"]: w for w in all_pending}
    failed_ids = []
    for fw in failed_words:
        word_id = fw.get("id")
        if word_id in pending_index:
            pending_index[word_id]["status"] = "pending"
            pending_index[word_id]["error"] = ""
            failed_ids.append(word_id)
    save_pending_words(all_pending)

    if not failed_ids:
        return ApiResponse(success=False, message="在待处理列表中未找到对应的失败词语")

    # 验证供应商和模型
    vendor = get_vendor_by_id(req.vendor_id)
    if not vendor:
        return ApiResponse(success=False, message=f"供应商不存在: {req.vendor_id}")
    if req.model not in vendor.get("models", []):
        return ApiResponse(success=False, message=f"模型不存在: {req.model}")

    # 获取提示词
    prompt_template = ""
    if req.system_prompt_id:
        prompt = get_prompt_by_id(req.system_prompt_id)
        if prompt:
            prompt_template = prompt.get("template", "")
    if not prompt_template and req.lang:
        languages = load_languages()
        lang_config = languages.get("languages", {}).get(req.lang, {})
        prompt_template_name = lang_config.get("prompt_template", "")
        if prompt_template_name:
            prompt = get_prompt_by_id(f"{req.lang}_basic")
            if prompt:
                prompt_template = prompt.get("template", "")

    # 获取输出格式
    output_format = {}
    if req.output_format_id:
        formats = load_json(DATA_DIR / "output_formats.json", {"formats": []})
        output_format = next(
            (f for f in formats.get("formats", []) if f["id"] == req.output_format_id),
            {}
        )

    # 用 word_ids 限定只重试失败的词语
    req.word_ids = failed_ids

    background_tasks.add_task(
        run_processing,
        vendor_id=req.vendor_id,
        vendor_name=vendor.get("name", req.vendor_id),
        model=req.model,
        prompt_template=prompt_template,
        prompt_name=prompt.get("name", req.system_prompt_id) if req.system_prompt_id else "",
        output_format=output_format,
        output_format_name=output_format.get("name", req.output_format_id) if req.output_format_id else "",
        lang=req.lang or "",
        lang_name=req.lang or "全部",
        target_collections=[],
        config=req,
    )

    return ApiResponse(message=f"已启动重试任务，将重试 {len(failed_ids)} 个失败词语")


@router.post("/reset-failed")
def reset_failed_to_pending():
    """将当前任务中失败/未处理的词语重置为待处理状态（不启动新任务）"""
    # 失败的词
    failed_words = [w for w in _current_task_words if w.get("status") == "failed"]
    # 未处理的词（任务被停止时，status 仍为 "processing" 的词）
    unprocessed_words = [w for w in _current_task_words if w.get("status") == "processing"]

    target_words = failed_words + unprocessed_words
    if not target_words:
        return ApiResponse(success=False, message="没有需要重置的词语")

    all_pending = load_pending_words()
    pending_index = {w["id"]: w for w in all_pending}
    reset_count = 0

    for tw in target_words:
        word_id = tw.get("id")
        if word_id in pending_index:
            pending_index[word_id]["status"] = "pending"
            pending_index[word_id]["error"] = ""
            reset_count += 1

    if reset_count > 0:
        save_pending_words(all_pending)

    failed_count = len(failed_words)
    unprocessed_count = len(unprocessed_words)
    parts = []
    if failed_count:
        parts.append(f"{failed_count} 个失败")
    if unprocessed_count:
        parts.append(f"{unprocessed_count} 个未处理")
    return ApiResponse(message=f"已将 {'、'.join(parts)} 词语重置为待处理")


async def run_processing(
    vendor_id: str,
    vendor_name: str,
    model: str,
    prompt_template: str,
    prompt_name: str,
    output_format: dict,
    output_format_name: str,
    lang: str,
    lang_name: str,
    target_collections: list,
    config: ProcessStartRequest,
):
    """后台运行处理任务"""
    global _current_task, _current_task_words

    # 生成任务 ID
    task_id = f"task_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

    # 完全重置当前任务状态
    _current_task = {
        "task_id": task_id,
        "running": True,
        "total": 0,
        "processed": 0,
        "success": 0,
        "failed": 0,
        "current_word": "",
        "errors": [],
        "started_at": datetime.now().isoformat(),
        "ended_at": None,
        "config": {
            "vendor_id": vendor_id,
            "vendor_name": vendor_name,
            "model": model,
            "prompt_name": prompt_name,
            "output_format_id": output_format.get("id", ""),
            "output_format_name": output_format_name,
            "lang": lang,
            "lang_name": lang_name,
            "target_collections": target_collections,
        },
    }

    # 重置词语列表
    _current_task_words = []

    try:
        # 加载所有待处理词语
        all_pending_words = load_pending_words()

        # 按语言筛选
        if config.lang:
            filtered_words = [w for w in all_pending_words if w.get("lang") == config.lang]
        else:
            filtered_words = list(all_pending_words)

        # 只处理 pending 状态的词语
        filtered_words = [w for w in filtered_words if w.get("status") == "pending"]

        # 如果指定了 word_ids，只处理这些词语
        if config.word_ids:
            word_id_set = set(config.word_ids)
            filtered_words = [w for w in filtered_words if w.get("id") in word_id_set]

        _current_task["total"] = len(filtered_words)

        # 获取供应商配置
        vendor = get_vendor_by_id(vendor_id)
        if not vendor:
            _current_task["errors"].append("供应商不存在")
            return

        # 创建待处理词语的索引（用于快速查找和更新）
        word_index = {w["id"]: w for w in all_pending_words}

        # 逐个处理
        for word_entry in filtered_words:
            if not _current_task["running"]:
                break

            _current_task["current_word"] = word_entry.get("word", "")

            # 记录词语处理开始
            word_record = {
                "id": word_entry.get("id"),
                "word": word_entry.get("word", ""),
                "collection_id": word_entry.get("collection_id", "default"),
                "status": "processing",
                "error": "",
                "started_at": datetime.now().isoformat(),
                "ended_at": None,
            }
            _current_task_words.append(word_record)

            try:
                # 获取该词语选择的知识库
                word_kb_names = word_entry.get("knowledge_bases", [])
                if not word_kb_names and config.knowledge_bases:
                    word_kb_names = config.knowledge_bases

                # 调用处理服务（传入完整的词语 JSON）
                result = await process_service.process_single_word(
                    word_entry=word_entry,
                    vendor=vendor,
                    model=model,
                    prompt_template=prompt_template,
                    output_format=output_format,
                    config={
                        "max_usages": config.max_usages,
                        "min_snippet_len": config.min_snippet_len,
                        "knowledge_bases": word_kb_names,
                    },
                )

                # 保存结果
                collection_id = word_entry.get("collection_id", "default")
                entries = load_processed_entries(collection_id)

                # 去重
                entries = [e for e in entries if e.get("word") != word_entry.get("word")]
                entries.append(result)

                save_processed_entries(collection_id, entries)

                # 更新待处理词语状态
                word_entry["status"] = "done"
                word_entry["error"] = ""

                # 更新词语记录
                word_record["status"] = "done"
                word_record["ended_at"] = datetime.now().isoformat()

                _current_task["success"] += 1

            except Exception as e:
                error_msg = f"{word_entry.get('word')}: {type(e).__name__}: {e}"
                _current_task["errors"].append(error_msg)
                _current_task["failed"] += 1

                # 更新待处理词语状态
                word_entry["status"] = "failed"
                word_entry["error"] = str(e)

                # 更新词语记录
                word_record["status"] = "failed"
                word_record["error"] = str(e)
                word_record["ended_at"] = datetime.now().isoformat()

            _current_task["processed"] += 1

        # 保存所有词语（包括未处理的），而不是只保存处理过的
        save_pending_words(all_pending_words)

        # 将当前任务保存到历史并持久化
        _current_task["ended_at"] = datetime.now().isoformat()
        _current_task["current_word"] = ""
        _task_history.insert(0, {
            **_current_task,
            "words": list(_current_task_words),
        })
        # 超出上限的截断
        if len(_task_history) > MAX_HISTORY:
            del _task_history[MAX_HISTORY:]
        save_task_history(_task_history)

    except Exception as e:
        _current_task["errors"].append(f"任务异常: {e}")
        _current_task["ended_at"] = datetime.now().isoformat()

    finally:
        _current_task["running"] = False
