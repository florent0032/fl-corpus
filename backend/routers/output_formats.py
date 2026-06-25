"""输出格式管理 API"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from backend.config import load_json, save_json, DATA_DIR
from backend.models import (
    AddOutputFormatRequest, UpdateOutputFormatRequest, ApiResponse,
)

router = APIRouter(prefix="/api/output-formats", tags=["output_formats"])

OUTPUT_FORMATS_FILE = DATA_DIR / "output_formats.json"


def _load_formats() -> list:
    data = load_json(OUTPUT_FORMATS_FILE, {"formats": []})
    return data.get("formats", [])


def _save_formats(formats: list):
    save_json(OUTPUT_FORMATS_FILE, {"formats": formats})


def _get_format_by_id(format_id: str) -> dict | None:
    formats = _load_formats()
    return next((f for f in formats if f["id"] == format_id), None)


@router.get("")
def list_formats():
    """获取输出格式列表"""
    formats = _load_formats()
    return {"items": formats, "total": len(formats)}


@router.get("/{format_id}")
def get_format(format_id: str):
    """获取输出格式详情"""
    fmt = _get_format_by_id(format_id)
    if not fmt:
        raise HTTPException(404, f"输出格式不存在: {format_id}")
    return fmt


@router.post("")
def add_format(req: AddOutputFormatRequest):
    """添加输出格式"""
    formats = _load_formats()

    if any(f["id"] == req.id for f in formats):
        raise HTTPException(409, f"输出格式已存在: {req.id}")

    now = datetime.now().isoformat()
    new_format = {
        "id": req.id,
        "name": req.name,
        "description": req.description,
        "schema": req.json_schema,
        "sample_output": req.sample_output,
        "retry_prompt": req.retry_prompt,
        "created_at": now,
        "updated_at": now,
    }

    formats.append(new_format)
    _save_formats(formats)

    return ApiResponse(message="输出格式添加成功", data=new_format)


@router.put("/{format_id}")
def update_format(format_id: str, req: UpdateOutputFormatRequest):
    """更新输出格式"""
    formats = _load_formats()
    idx = next((i for i, f in enumerate(formats) if f["id"] == format_id), None)

    if idx is None:
        raise HTTPException(404, f"输出格式不存在: {format_id}")

    fmt = formats[idx]

    if req.name:
        fmt["name"] = req.name
    if req.description:
        fmt["description"] = req.description
    if req.json_schema:
        fmt["schema"] = req.json_schema
    if req.sample_output:
        fmt["sample_output"] = req.sample_output
    if req.retry_prompt:
        fmt["retry_prompt"] = req.retry_prompt

    fmt["updated_at"] = datetime.now().isoformat()
    formats[idx] = fmt
    _save_formats(formats)

    return ApiResponse(message="输出格式更新成功", data=fmt)


@router.delete("/{format_id}")
def delete_format(format_id: str):
    """删除输出格式"""
    formats = _load_formats()
    idx = next((i for i, f in enumerate(formats) if f["id"] == format_id), None)

    if idx is None:
        raise HTTPException(404, f"输出格式不存在: {format_id}")

    formats.pop(idx)
    _save_formats(formats)

    return ApiResponse(message="输出格式删除成功")
