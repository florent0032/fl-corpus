"""字段管理 API"""

from fastapi import APIRouter, HTTPException
from backend.config import (
    load_field_configs, save_field_configs, get_field_by_id,
    PRESET_FIELDS, save_json, DATA_DIR,
)
from backend.models import AddFieldRequest, UpdateFieldRequest, ApiResponse

router = APIRouter(prefix="/api/fields", tags=["fields"])


@router.get("")
def list_fields(lang: str = None):
    """获取字段列表（预设 + 自定义）"""
    fields = load_field_configs()

    # 语言筛选
    if lang:
        fields = [
            f for f in fields
            if not f.get("languages") or lang in f.get("languages", [])
        ]

    return {"items": fields, "total": len(fields)}


@router.get("/{field_id}")
def get_field(field_id: str):
    """获取字段详情"""
    field = get_field_by_id(field_id)

    if not field:
        raise HTTPException(404, f"字段不存在: {field_id}")

    return field


@router.post("")
def add_field(req: AddFieldRequest):
    """添加自定义字段"""
    # 检查 ID 是否与预设字段冲突
    preset_ids = {f["id"] for f in PRESET_FIELDS}
    if req.id in preset_ids:
        raise HTTPException(409, f"字段 ID 与预设字段冲突: {req.id}")

    # 检查 ID 是否已存在
    existing = get_field_by_id(req.id)
    if existing:
        raise HTTPException(409, f"字段已存在: {req.id}")

    # 创建新字段
    new_field = {
        "id": req.id,
        "name": req.name,
        "name_en": req.name_en,
        "field_type": req.field_type,
        "languages": req.languages,
        "default_enabled": req.default_enabled,
        "is_preset": False,
        "placeholder": req.placeholder,
        "description": req.description,
    }

    # 加载现有自定义字段并添加
    custom_fields = load_field_configs()
    custom_fields = [f for f in custom_fields if not f.get("is_preset", False)]
    custom_fields.append(new_field)
    save_json(DATA_DIR / "fields.json", {"fields": custom_fields})

    return ApiResponse(message="字段添加成功", data=new_field)


@router.put("/{field_id}")
def update_field(field_id: str, req: UpdateFieldRequest):
    """更新字段配置"""
    field = get_field_by_id(field_id)

    if not field:
        raise HTTPException(404, f"字段不存在: {field_id}")

    # 更新字段
    if req.name:
        field["name"] = req.name
    if req.name_en:
        field["name_en"] = req.name_en
    if req.field_type:
        field["field_type"] = req.field_type
    if req.languages is not None:
        field["languages"] = req.languages
    if req.default_enabled is not None:
        field["default_enabled"] = req.default_enabled
    if req.placeholder:
        field["placeholder"] = req.placeholder
    if req.description:
        field["description"] = req.description

    # 保存
    if field.get("is_preset"):
        # 预设字段只更新允许的属性
        preset_index = next(
            (i for i, f in enumerate(PRESET_FIELDS) if f["id"] == field_id),
            None
        )
        if preset_index is not None:
            PRESET_FIELDS[preset_index] = field
    else:
        # 自定义字段更新所有属性
        custom_fields = load_field_configs()
        custom_fields = [f for f in custom_fields if not f.get("is_preset", False)]
        custom_fields = [f if f["id"] != field_id else field for f in custom_fields]
        save_json(DATA_DIR / "fields.json", {"fields": custom_fields})

    return ApiResponse(message="字段更新成功", data=field)


@router.delete("/{field_id}")
def delete_field(field_id: str):
    """删除自定义字段（预设字段不可删除）"""
    field = get_field_by_id(field_id)

    if not field:
        raise HTTPException(404, f"字段不存在: {field_id}")

    if field.get("is_preset"):
        raise HTTPException(403, "预设字段不可删除")

    # 删除自定义字段
    custom_fields = load_field_configs()
    custom_fields = [f for f in custom_fields if not f.get("is_preset", False)]
    custom_fields = [f for f in custom_fields if f["id"] != field_id]
    save_json(DATA_DIR / "fields.json", {"fields": custom_fields})

    return ApiResponse(message="字段删除成功")


@router.post("/init-presets")
def init_preset_fields():
    """初始化预设字段配置文件"""
    # 确保 fields.json 存在
    fields_file = DATA_DIR / "fields.json"
    if not fields_file.exists():
        save_json(fields_file, {"fields": []})

    return ApiResponse(message="预设字段已初始化", data={"preset_count": len(PRESET_FIELDS)})
