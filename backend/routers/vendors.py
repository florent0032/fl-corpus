"""供应商管理 API"""

from fastapi import APIRouter, HTTPException
from backend.config import load_json, save_json, DATA_DIR, get_vendor_by_id
from backend.models import AddVendorRequest, UpdateVendorRequest, ApiResponse

router = APIRouter(prefix="/api/vendors", tags=["vendors"])

VENDORS_FILE = DATA_DIR / "vendors.json"


def _load_vendors_data() -> dict:
    return load_json(VENDORS_FILE, {"vendors": []})


def _save_vendors_data(data: dict):
    save_json(VENDORS_FILE, data)


def _mask_vendor(vendor: dict) -> dict:
    """隐藏 API 密钥"""
    safe = {**vendor}
    if "api_key" in safe:
        safe["api_key"] = "***" if safe["api_key"] else ""
    return safe


@router.get("")
def list_vendors():
    """获取供应商列表"""
    data = _load_vendors_data()
    vendors = data.get("vendors", [])
    return {"items": [_mask_vendor(v) for v in vendors], "total": len(vendors)}


@router.get("/{vendor_id}")
def get_vendor(vendor_id: str):
    """获取供应商详情"""
    vendor = get_vendor_by_id(vendor_id)
    if not vendor:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")
    return _mask_vendor(vendor)


@router.post("")
def add_vendor(req: AddVendorRequest):
    """添加供应商"""
    data = _load_vendors_data()
    vendors = data.get("vendors", [])

    # 检查 ID 是否已存在
    if any(v["id"] == req.id for v in vendors):
        raise HTTPException(409, f"供应商已存在: {req.id}")

    new_vendor = {
        "id": req.id,
        "name": req.name,
        "provider_type": req.provider_type,
        "base_url": req.base_url,
        "api_key": req.api_key,
        "models": req.models,
        "enabled": req.enabled,
    }

    vendors.append(new_vendor)
    data["vendors"] = vendors
    _save_vendors_data(data)

    return ApiResponse(message="供应商添加成功", data=_mask_vendor(new_vendor))


@router.put("/{vendor_id}")
def update_vendor(vendor_id: str, req: UpdateVendorRequest):
    """更新供应商"""
    data = _load_vendors_data()
    vendors = data.get("vendors", [])

    idx = next((i for i, v in enumerate(vendors) if v["id"] == vendor_id), None)
    if idx is None:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")

    vendor = vendors[idx]

    # 更新字段
    if req.name:
        vendor["name"] = req.name
    if req.provider_type:
        vendor["provider_type"] = req.provider_type
    if req.base_url:
        vendor["base_url"] = req.base_url
    if req.api_key:
        vendor["api_key"] = req.api_key
    if req.models:
        vendor["models"] = req.models
    if req.enabled is not None:
        vendor["enabled"] = req.enabled

    vendors[idx] = vendor
    data["vendors"] = vendors
    _save_vendors_data(data)

    return ApiResponse(message="供应商更新成功", data=_mask_vendor(vendor))


@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: str):
    """删除供应商"""
    data = _load_vendors_data()
    vendors = data.get("vendors", [])

    idx = next((i for i, v in enumerate(vendors) if v["id"] == vendor_id), None)
    if idx is None:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")

    vendors.pop(idx)
    data["vendors"] = vendors
    _save_vendors_data(data)

    return ApiResponse(message="供应商删除成功")


@router.get("/{vendor_id}/models")
def get_vendor_models(vendor_id: str):
    """获取供应商的模型列表"""
    vendor = get_vendor_by_id(vendor_id)
    if not vendor:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")
    return {"vendor_id": vendor_id, "models": vendor.get("models", [])}


@router.post("/{vendor_id}/models")
def add_model_to_vendor(vendor_id: str, body: dict):
    """向供应商添加单个模型"""
    data = _load_vendors_data()
    vendors = data.get("vendors", [])

    idx = next((i for i, v in enumerate(vendors) if v["id"] == vendor_id), None)
    if idx is None:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")

    model_name = body.get("model", "").strip()
    if not model_name:
        raise HTTPException(400, "模型名称不能为空")

    vendor = vendors[idx]
    models = vendor.get("models", [])

    if model_name in models:
        raise HTTPException(409, f"模型已存在: {model_name}")

    models.append(model_name)
    vendor["models"] = models
    vendors[idx] = vendor
    _save_vendors_data(data)

    return ApiResponse(message=f"模型 {model_name} 添加成功", data={"models": models})


@router.delete("/{vendor_id}/models/{model}")
def remove_model_from_vendor(vendor_id: str, model: str):
    """从供应商删除单个模型"""
    data = _load_vendors_data()
    vendors = data.get("vendors", [])

    idx = next((i for i, v in enumerate(vendors) if v["id"] == vendor_id), None)
    if idx is None:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")

    vendor = vendors[idx]
    models = vendor.get("models", [])

    if model not in models:
        raise HTTPException(404, f"模型不存在: {model}")

    models.remove(model)
    vendor["models"] = models
    vendors[idx] = vendor
    _save_vendors_data(data)

    return ApiResponse(message=f"模型 {model} 删除成功", data={"models": models})


@router.post("/{vendor_id}/test")
async def test_vendor_connection(vendor_id: str):
    """测试供应商连接（使用第一个模型）"""
    vendor = get_vendor_by_id(vendor_id)
    if not vendor:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")

    from backend.services.llm_service import llm_service

    try:
        latency = await llm_service.test_connection(vendor)
        return ApiResponse(message=f"连接成功，延迟 {latency}ms", data={"latency": latency})
    except Exception as e:
        return ApiResponse(success=False, message=f"连接失败: {str(e)}")


@router.post("/{vendor_id}/models/{model}/test")
async def test_vendor_model(vendor_id: str, model: str):
    """测试供应商指定模型的连接"""
    import time
    import httpx

    vendor = get_vendor_by_id(vendor_id)
    if not vendor:
        raise HTTPException(404, f"供应商不存在: {vendor_id}")

    if model not in vendor.get("models", []):
        raise HTTPException(404, f"模型不存在: {model}")

    base_url = vendor.get("base_url", "").rstrip("/")
    api_key = vendor.get("api_key", "")

    if not base_url:
        return ApiResponse(success=False, message="供应商 base_url 不能为空")

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 5,
    }

    try:
        start = time.time()
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
        elapsed = round((time.time() - start) * 1000, 2)
        return ApiResponse(
            message=f"模型 {model} 连接成功，延迟 {elapsed}ms",
            data={"model": model, "latency": elapsed},
        )
    except httpx.HTTPStatusError as e:
        return ApiResponse(
            success=False,
            message=f"模型 {model} 连接失败: HTTP {e.response.status_code}",
        )
    except Exception as e:
        return ApiResponse(success=False, message=f"模型 {model} 连接失败: {str(e)}")
