"""语言管理 API"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.config import get_all_languages, get_language_config, load_json, save_json, DATA_DIR
from backend.models import ApiResponse

router = APIRouter(prefix="/api/languages", tags=["languages"])


class AddCollectionRequest(BaseModel):
    """添加词库请求"""
    lang: str
    id: str
    name: str
    desc: str = ""
    output_format: str = "entry_json"
    usage_field: str = "usages"  # 用例字段名


class UpdateCollectionRequest(BaseModel):
    """更新词库请求"""
    name: Optional[str] = None
    desc: Optional[str] = None
    output_format: Optional[str] = None
    usage_field: Optional[str] = None


@router.get("")
def list_languages():
    """获取所有支持的语言"""
    languages = get_all_languages()
    return {"items": languages, "total": len(languages)}


@router.get("/{lang_code}")
def get_language(lang_code: str):
    """获取指定语言的配置"""
    config = get_language_config(lang_code)
    if not config:
        return ApiResponse(success=False, message=f"不支持的语言: {lang_code}")
    return ApiResponse(data={"code": lang_code, **config})


@router.post("/collections")
def add_collection(req: AddCollectionRequest):
    """添加词库"""
    languages_data = load_json(DATA_DIR / "languages.json", {"languages": {}})
    languages = languages_data.get("languages", {})

    if req.lang not in languages:
        raise HTTPException(status_code=404, detail=f"不支持的语言: {req.lang}")

    lang_config = languages[req.lang]
    collections = lang_config.get("collections", [])

    # 检查 ID 是否已存在
    if any(c["id"] == req.id for c in collections):
        raise HTTPException(status_code=400, detail=f"词库 ID 已存在: {req.id}")

    # 添加词库
    new_collection = {
        "id": req.id,
        "name": req.name,
        "desc": req.desc,
        "output_format": req.output_format,
        "usage_field": req.usage_field,
        "created_at": datetime.now().isoformat()
    }
    collections.append(new_collection)
    lang_config["collections"] = collections
    languages[req.lang] = lang_config
    languages_data["languages"] = languages

    save_json(DATA_DIR / "languages.json", languages_data)

    return ApiResponse(message="词库添加成功", data=new_collection)


@router.put("/collections/{lang_code}/{collection_id}")
def update_collection(lang_code: str, collection_id: str, req: UpdateCollectionRequest):
    """更新词库"""
    languages_data = load_json(DATA_DIR / "languages.json", {"languages": {}})
    languages = languages_data.get("languages", {})

    if lang_code not in languages:
        raise HTTPException(status_code=404, detail=f"不支持的语言: {lang_code}")

    lang_config = languages[lang_code]
    collections = lang_config.get("collections", [])

    # 查找词库
    collection = None
    for c in collections:
        if c["id"] == collection_id:
            collection = c
            break

    if not collection:
        raise HTTPException(status_code=404, detail=f"词库不存在: {collection_id}")

    # 更新字段
    if req.name is not None:
        collection["name"] = req.name
    if req.desc is not None:
        collection["desc"] = req.desc
    if req.output_format is not None:
        collection["output_format"] = req.output_format
    if req.usage_field is not None:
        collection["usage_field"] = req.usage_field

    collection["updated_at"] = datetime.now().isoformat()

    lang_config["collections"] = collections
    languages[lang_code] = lang_config
    languages_data["languages"] = languages

    save_json(DATA_DIR / "languages.json", languages_data)

    return ApiResponse(message="词库更新成功", data=collection)


@router.delete("/collections/{lang_code}/{collection_id}")
def delete_collection(lang_code: str, collection_id: str):
    """删除词库"""
    languages_data = load_json(DATA_DIR / "languages.json", {"languages": {}})
    languages = languages_data.get("languages", {})

    if lang_code not in languages:
        raise HTTPException(status_code=404, detail=f"不支持的语言: {lang_code}")

    lang_config = languages[lang_code]
    collections = lang_config.get("collections", [])

    # 查找并删除词库
    new_collections = [c for c in collections if c["id"] != collection_id]
    if len(new_collections) == len(collections):
        raise HTTPException(status_code=404, detail=f"词库不存在: {collection_id}")

    lang_config["collections"] = new_collections
    languages[lang_code] = lang_config
    languages_data["languages"] = languages

    save_json(DATA_DIR / "languages.json", languages_data)

    return ApiResponse(message="词库删除成功")
