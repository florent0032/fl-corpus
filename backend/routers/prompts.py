"""提示词管理 API"""

from fastapi import APIRouter, HTTPException
from backend.config import load_prompts, get_prompt_by_id, load_json, save_json, DATA_DIR
from backend.models import ApiResponse

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("")
def list_prompts(lang: str = None, task_type: str = None):
    """获取提示词列表"""
    prompts = load_prompts(lang=lang)

    # 任务类型筛选
    if task_type:
        prompts = [p for p in prompts if p.get("task_type") == task_type]

    return {"items": prompts, "total": len(prompts)}


@router.get("/{prompt_id}")
def get_prompt(prompt_id: str):
    """获取提示词详情"""
    prompt = get_prompt_by_id(prompt_id)

    if not prompt:
        raise HTTPException(404, f"提示词不存在: {prompt_id}")

    return prompt


@router.post("")
def add_prompt(prompt: dict):
    """添加提示词"""
    prompt_id = prompt.get("id")
    if not prompt_id:
        raise HTTPException(400, "提示词 ID 不能为空")

    # 检查是否已存在
    existing = get_prompt_by_id(prompt_id)
    if existing:
        raise HTTPException(409, f"提示词已存在: {prompt_id}")

    # 加载并保存
    prompts_data = load_json(DATA_DIR / "prompts.json", {"prompts": {}})
    prompts_data["prompts"][prompt_id] = prompt
    save_json(DATA_DIR / "prompts.json", prompts_data)

    return ApiResponse(message="提示词添加成功", data=prompt)


@router.put("/{prompt_id}")
def update_prompt(prompt_id: str, prompt: dict):
    """更新提示词"""
    existing = get_prompt_by_id(prompt_id)
    if not existing:
        raise HTTPException(404, f"提示词不存在: {prompt_id}")

    # 更新字段
    for key in ["name", "lang", "task_type", "description", "template"]:
        if key in prompt:
            existing[key] = prompt[key]

    # 保存
    prompts_data = load_json(DATA_DIR / "prompts.json", {"prompts": {}})
    prompts_data["prompts"][prompt_id] = existing
    save_json(DATA_DIR / "prompts.json", prompts_data)

    return ApiResponse(message="提示词更新成功", data=existing)


@router.delete("/{prompt_id}")
def delete_prompt(prompt_id: str):
    """删除提示词"""
    existing = get_prompt_by_id(prompt_id)
    if not existing:
        raise HTTPException(404, f"提示词不存在: {prompt_id}")

    # 删除
    prompts_data = load_json(DATA_DIR / "prompts.json", {"prompts": {}})
    del prompts_data["prompts"][prompt_id]
    save_json(DATA_DIR / "prompts.json", prompts_data)

    return ApiResponse(message="提示词删除成功")
