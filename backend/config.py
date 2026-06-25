"""配置管理"""

import json
import os
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

# 确保数据目录存在
DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_json(file_path: Path, default=None):
    """加载 JSON 文件"""
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"加载 {file_path} 失败: {e}")
    return default if default is not None else {}


def save_json(file_path: Path, data):
    """保存 JSON 文件"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_languages() -> dict:
    """加载语言配置"""
    return load_json(DATA_DIR / "languages.json", {"languages": {}})


def get_language_config(lang_code: str) -> dict:
    """获取指定语言的配置"""
    languages = load_languages()
    return languages.get("languages", {}).get(lang_code, {})


def get_all_languages() -> list:
    """获取所有语言列表"""
    languages = load_languages()
    return [
        {"code": code, **config}
        for code, config in languages.get("languages", {}).items()
    ]


def load_prompts(lang: str = None) -> list:
    """加载提示词列表"""
    prompts_data = load_json(DATA_DIR / "prompts.json", {"prompts": {}})
    prompts = list(prompts_data.get("prompts", {}).values())

    if lang:
        prompts = [p for p in prompts if p.get("lang") == lang]

    return prompts


def get_prompt_by_id(prompt_id: str) -> Optional[dict]:
    """根据 ID 获取提示词"""
    prompts_data = load_json(DATA_DIR / "prompts.json", {"prompts": {}})
    return prompts_data.get("prompts", {}).get(prompt_id)


def load_vendors() -> list:
    """加载供应商列表"""
    vendors_data = load_json(DATA_DIR / "vendors.json", {"vendors": []})
    return vendors_data.get("vendors", [])


def get_vendor_by_id(vendor_id: str) -> Optional[dict]:
    """根据 ID 获取供应商"""
    vendors = load_vendors()
    return next((v for v in vendors if v["id"] == vendor_id), None)


def load_kb_registry() -> dict:
    """加载知识库注册表"""
    return load_json(DATA_DIR / "kb_registry.json", {"knowledge_bases": {}})


def get_knowledge_bases(lang: str = None, q: str = None) -> list:
    """获取知识库列表（支持筛选）"""
    registry = load_kb_registry()
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

    return kbs


def load_pending_words(lang: str = None) -> list:
    """加载待处理词语"""
    pending = load_json(DATA_DIR / "pending.json", [])
    if lang:
        pending = [w for w in pending if w.get("lang") == lang]
    return pending


def save_pending_words(words: list):
    """保存待处理词语"""
    save_json(DATA_DIR / "pending.json", words)


def load_processed_entries(collection_id: str) -> list:
    """加载已处理的词条"""
    output_dir = DATA_DIR / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    return load_json(output_dir / f"{collection_id}.json", [])


def save_processed_entries(collection_id: str, entries: list):
    """保存已处理的词条"""
    output_dir = DATA_DIR / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    save_json(output_dir / f"{collection_id}.json", entries)


# ── 字段配置管理 ──────────────────────────────────

# 预设字段列表
PRESET_FIELDS = [
    {
        "id": "hanja",
        "name": "汉字/词根",
        "name_en": "Hanja/Root",
        "field_type": "text",
        "languages": [],
        "default_enabled": False,
        "default_value": "",
        "is_preset": True,
        "placeholder": "汉字或词根",
        "description": "日语汉字、阿拉伯语/波斯语词根"
    },
    {
        "id": "accent",
        "name": "音调/重音",
        "name_en": "Accent",
        "field_type": "text",
        "languages": ["ja"],
        "default_enabled": False,
        "default_value": "",
        "is_preset": True,
        "placeholder": "如 ⓪、①、②",
        "description": "日语声调标记"
    },
    {
        "id": "pos",
        "name": "词性",
        "name_en": "Part of Speech",
        "field_type": "text",
        "languages": [],
        "default_enabled": False,
        "default_value": "",
        "is_preset": True,
        "placeholder": "如 名、动、形、副",
        "description": "词性标注"
    },
    {
        "id": "meaning_zh",
        "name": "中文释义",
        "name_en": "Chinese Meaning",
        "field_type": "text",
        "languages": [],
        "default_enabled": True,
        "default_value": "",
        "is_preset": True,
        "placeholder": "简洁的中文释义",
        "description": "中文翻译/释义"
    },
    {
        "id": "conjugations",
        "name": "动词变位",
        "name_en": "Conjugations",
        "field_type": "json",
        "languages": [],
        "default_enabled": False,
        "default_value": "{}",
        "is_preset": True,
        "placeholder": "{}",
        "description": "动词/形容词的活用形"
    },
    {
        "id": "notes",
        "name": "注解",
        "name_en": "Notes",
        "field_type": "textarea",
        "languages": [],
        "default_enabled": False,
        "default_value": "",
        "is_preset": True,
        "placeholder": "补充说明...",
        "description": "额外的注释和说明"
    },
    {
        "id": "gender",
        "name": "名词性别",
        "name_en": "Gender",
        "field_type": "select",
        "languages": ["es", "fr", "de", "it"],
        "default_enabled": False,
        "default_value": "",
        "is_preset": True,
        "placeholder": "masculino/feminino",
        "description": "名词的语法性别"
    },
    {
        "id": "root",
        "name": "词根",
        "name_en": "Root",
        "field_type": "text",
        "languages": ["ar", "fa"],
        "default_enabled": False,
        "default_value": "",
        "is_preset": True,
        "placeholder": "如 د-ر-س",
        "description": "阿拉伯语/波斯语三字母词根"
    }
]


def load_field_configs() -> list:
    """加载字段配置（预设 + 自定义）"""
    custom_fields = load_json(DATA_DIR / "fields.json", {"fields": []}).get("fields", [])

    # 合并预设字段和自定义字段
    preset_ids = {f["id"] for f in PRESET_FIELDS}
    result = list(PRESET_FIELDS)

    for field in custom_fields:
        if field.get("id") not in preset_ids:
            result.append(field)

    return result


def save_field_configs(fields: list):
    """保存自定义字段配置（不包含预设字段）"""
    custom_fields = [f for f in fields if not f.get("is_preset", False)]
    save_json(DATA_DIR / "fields.json", {"fields": custom_fields})


def get_field_by_id(field_id: str) -> dict:
    """根据 ID 获取字段配置"""
    fields = load_field_configs()
    return next((f for f in fields if f["id"] == field_id), None)
