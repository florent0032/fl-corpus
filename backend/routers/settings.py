"""系统设置 API"""

from fastapi import APIRouter
from backend.config import load_json, save_json, DATA_DIR
from backend.models import ApiResponse

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_FILE = DATA_DIR / "settings.json"

DEFAULT_SETTINGS = {
    "max_usages": 25,
    "min_snippet_len": 15,
}


@router.get("")
def get_settings():
    """获取系统设置"""
    settings = load_json(SETTINGS_FILE, DEFAULT_SETTINGS)
    # 合并默认值（确保新字段始终存在）
    merged = {**DEFAULT_SETTINGS, **settings}
    return merged


@router.put("")
def update_settings(settings: dict):
    """更新系统设置"""
    current = load_json(SETTINGS_FILE, DEFAULT_SETTINGS)
    merged = {**DEFAULT_SETTINGS, **current}

    # 更新提供的字段
    for key in DEFAULT_SETTINGS:
        if key in settings:
            merged[key] = settings[key]

    save_json(SETTINGS_FILE, merged)
    return ApiResponse(message="设置已保存", data=merged)
