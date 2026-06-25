"""插件管理 API

提供后处理插件的管理、执行和状态查询接口。
"""

from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException
from backend.config import load_processed_entries, save_processed_entries, DATA_DIR
from backend.models import ApiResponse
from backend.plugins import plugin_registry, run_plugin

router = APIRouter(prefix="/api/plugins", tags=["plugins"])

# 全局插件执行状态
_plugin_status = {
    "running": False,
    "plugin_id": "",
    "total": 0,
    "processed": 0,
    "success": 0,
    "failed": 0,
    "skipped": 0,
    "current_word": "",
    "errors": [],
    "started_at": None,
    "finished_at": None,
}


@router.get("")
def list_plugins():
    """获取所有可用插件"""
    plugins = plugin_registry.list_plugins()
    return {"items": plugins, "total": len(plugins)}


@router.get("/status")
def get_plugin_status():
    """获取插件执行状态"""
    return _plugin_status


@router.post("/{plugin_id}/run")
async def run_plugin_endpoint(
    plugin_id: str,
    background_tasks: BackgroundTasks,
    collection_id: str = "",
    lang: str = "",
    delay: float = 0.3,
    use_cache: bool = True,
    force: bool = False,
):
    """运行指定插件

    Args:
        plugin_id: 插件 ID
        collection_id: 词语库 ID（为空则处理所有）
        lang: 语言筛选（为空则处理所有）
        delay: 请求延迟（声调插件专用）
        use_cache: 是否使用缓存
        force: 是否强制覆盖已有数据
    """
    if _plugin_status["running"]:
        return ApiResponse(success=False, message="已有插件任务在运行")

    plugin = plugin_registry.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(404, f"插件不存在: {plugin_id}")

    background_tasks.add_task(
        _run_plugin_task,
        plugin_id=plugin_id,
        collection_id=collection_id,
        lang=lang,
        delay=delay,
        use_cache=use_cache,
        force=force,
    )

    return ApiResponse(message=f"插件 {plugin.name} 已启动")


@router.post("/stop")
def stop_plugin():
    """停止插件执行"""
    _plugin_status["running"] = False
    return ApiResponse(message="已发送停止信号")


async def _run_plugin_task(
    plugin_id: str,
    collection_id: str,
    lang: str,
    delay: float,
    use_cache: bool,
    force: bool,
):
    """后台运行插件任务"""
    global _plugin_status

    _plugin_status.update({
        "running": True,
        "plugin_id": plugin_id,
        "total": 0,
        "processed": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "current_word": "",
        "errors": [],
        "started_at": datetime.now().isoformat(),
        "finished_at": None,
    })

    try:
        plugin = plugin_registry.get_plugin(plugin_id)
        if not plugin:
            _plugin_status["errors"].append(f"插件不存在: {plugin_id}")
            return

        # 收集所有需要处理的词条
        all_entries = []

        if collection_id:
            # 处理指定词语库
            entries = load_processed_entries(collection_id)
            for entry in entries:
                entry["_collection"] = collection_id
            all_entries.extend(entries)
        else:
            # 处理所有词语库
            output_dir = DATA_DIR / "output"
            if output_dir.exists():
                for json_file in output_dir.glob("*.json"):
                    if json_file.name.startswith("_"):
                        continue
                    col_id = json_file.stem
                    entries = load_processed_entries(col_id)
                    for entry in entries:
                        entry["_collection"] = col_id
                    all_entries.extend(entries)

        # 语言筛选
        if lang:
            all_entries = [e for e in all_entries if e.get("lang") == lang]

        # 如果不强制覆盖，只处理需要处理的词条
        if not force:
            entries_to_process = [e for e in all_entries if plugin.should_process(e)]
        else:
            entries_to_process = all_entries

        _plugin_status["total"] = len(entries_to_process)

        # 按词语库分组处理
        collections: dict[str, list[dict]] = {}
        for entry in entries_to_process:
            col = entry.get("_collection", "default")
            if col not in collections:
                collections[col] = []
            collections[col].append(entry)

        config = {
            "delay": delay,
            "use_cache": use_cache,
            "force": force,
        }

        # 逐个处理
        for col_id, entries in collections.items():
            if not _plugin_status["running"]:
                break

            for entry in entries:
                if not _plugin_status["running"]:
                    break

                _plugin_status["current_word"] = entry.get("word", "")

                try:
                    if plugin.should_process(entry) or force:
                        result = await plugin.process_entry(entry, config)
                        if result:
                            entry.update(result)
                            _plugin_status["success"] += 1
                        else:
                            _plugin_status["skipped"] += 1
                    else:
                        _plugin_status["skipped"] += 1

                except Exception as e:
                    error_msg = f"{entry.get('word', '?')}: {e}"
                    _plugin_status["errors"].append(error_msg)
                    _plugin_status["failed"] += 1

                _plugin_status["processed"] += 1

            # 保存更新后的词条
            # 移除临时的 _collection 字段
            original_entries = load_processed_entries(col_id)
            updated_map = {e["word"]: e for e in entries}

            for orig in original_entries:
                if orig["word"] in updated_map:
                    updated = updated_map[orig["word"]]
                    # 只更新目标字段
                    plugin_obj = plugin_registry.get_plugin(plugin_id)
                    if plugin_obj and plugin_obj.target_field:
                        orig[plugin_obj.target_field] = updated.get(
                            plugin_obj.target_field, orig.get(plugin_obj.target_field, "")
                        )

            save_processed_entries(col_id, original_entries)

    except Exception as e:
        _plugin_status["errors"].append(f"任务异常: {e}")

    finally:
        _plugin_status["running"] = False
        _plugin_status["finished_at"] = datetime.now().isoformat()
