"""数据模型"""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class Language(BaseModel):
    """语言配置"""
    code: str
    name: str
    name_en: str
    rtl: bool = False
    collections: list[dict] = []
    accent_service: Optional[str] = None
    tokenizer: Optional[str] = None
    prompt_template: str = "default"


class WordCollection(BaseModel):
    """词语库"""
    id: str
    name: str
    desc: str = ""
    lang: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class PendingWord(BaseModel):
    """待处理词语"""
    id: str = Field(default_factory=lambda: datetime.now().strftime("%Y%m%d%H%M%S%f"))
    lang: str
    collection_id: str
    word: str
    json_input: Any = {}  # 用户输入的完整 JSON（包含所有字段）
    knowledge_bases: list[str] = []  # 选择的知识库（按优先级排序）
    fallback_words: list[str] = []  # 兜底词（词的变位、变形，性数格的各种形态）
    added_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: str = "pending"  # pending | processing | done | failed
    error: str = ""


class ProcessedEntry(BaseModel):
    """已处理的词条"""
    word: str
    pron: str = ""
    hanja: str = ""
    accent: str = ""
    pos: str = ""
    meaning_zh: str = ""
    lang: str
    root: str = ""  # 词根（阿拉伯语/波斯语）
    conjugations: Any = {}  # 动词变位/活用形（支持 dict 或 list）
    notes: str = ""  # 注解/笔记
    tags: list[str] = []  # 标签
    usages: list[dict] = []


class Usage(BaseModel):
    """用例"""
    source: str = ""
    sentence: str = ""
    chinese: str = ""


class Vendor(BaseModel):
    """供应商"""
    id: str
    name: str
    provider_type: str = "openai_compatible"
    base_url: str
    api_key: str
    models: list[str] = []
    enabled: bool = True


class Prompt(BaseModel):
    """提示词"""
    id: str
    name: str
    lang: str
    task_type: str
    description: str
    template: str


class KB(BaseModel):
    """知识库"""
    name: str
    lang: str
    description: str = ""
    tags: list[str] = []
    path: str
    enabled: bool = True
    stats: dict = Field(default_factory=lambda: {"files": 0, "chunks": 0})


class FieldConfig(BaseModel):
    """字段配置"""
    id: str
    name: str
    name_en: str
    field_type: str = "text"  # text, textarea, select, json
    languages: list[str] = []  # 适用语言，空表示全部
    default_enabled: bool = False
    default_value: str = ""  # 默认值
    is_preset: bool = False  # 是否为预设字段（预设字段不可删除）
    placeholder: str = ""
    description: str = ""


# ── API 请求模型 ──────────────────────────────────

class AddWordRequest(BaseModel):
    """添加词语请求"""
    lang: str = "ja"
    collection_id: str
    word: str
    json_input: Any = {}  # 用户输入的完整 JSON
    knowledge_bases: list[str] = []
    fallback_words: list[str] = []  # 兜底词（词的变位、变形）


class UpdateWordRequest(BaseModel):
    """更新词语请求"""
    word: str = ""
    json_input: Any = {}  # 用户输入的完整 JSON
    knowledge_bases: list[str] = []
    fallback_words: list[str] = []


class AddWordBatchRequest(BaseModel):
    """批量添加词语请求"""
    lang: str = "ja"
    collection_id: str
    words: list[dict]


class ProcessStartRequest(BaseModel):
    """启动处理任务请求"""
    vendor_id: str
    model: str
    lang: str = ""
    system_prompt_id: str = ""
    output_format_id: str = ""
    max_usages: int = 25
    min_snippet_len: int = 15
    knowledge_bases: list[str] = []
    word_ids: list[str] = []  # 指定要处理的词语ID列表，为空则处理所有
    generate_accent: bool = True
    generate_conjugations: bool = True
    generate_meaning: bool = True
    generate_pos: bool = True


class AddFieldRequest(BaseModel):
    """添加字段请求"""
    id: str
    name: str
    name_en: str
    field_type: str = "text"
    languages: list[str] = []
    default_enabled: bool = False
    placeholder: str = ""
    description: str = ""


class AddVendorRequest(BaseModel):
    """添加供应商请求"""
    id: str
    name: str
    provider_type: str = "openai_compatible"
    base_url: str
    api_key: str = ""
    models: list[str] = []
    enabled: bool = True


class UpdateVendorRequest(BaseModel):
    """更新供应商请求"""
    name: str = ""
    provider_type: str = ""
    base_url: str = ""
    api_key: str = ""
    models: list[str] = []
    enabled: bool | None = None


class UpdateFieldRequest(BaseModel):
    """更新字段请求"""
    name: str = ""
    name_en: str = ""
    field_type: str = ""
    languages: list[str] = []
    default_enabled: bool = False
    placeholder: str = ""
    description: str = ""


# ── 输出格式模型 ──────────────────────────────────

class OutputFormat(BaseModel):
    """输出格式"""
    id: str
    name: str
    description: str = ""
    json_schema: dict[str, Any] = Field(default_factory=dict, alias="schema")  # JSON Schema 定义
    sample_output: str = ""  # 示例输出（JSON 字符串）
    retry_prompt: str = ""  # 格式不符时的重试提示词
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())

    model_config = {"populate_by_name": True}


class AddOutputFormatRequest(BaseModel):
    """添加输出格式请求"""
    id: str
    name: str
    description: str = ""
    json_schema: dict[str, Any] = Field(default_factory=dict, alias="schema")
    sample_output: str = ""
    retry_prompt: str = ""

    model_config = {"populate_by_name": True}


class UpdateOutputFormatRequest(BaseModel):
    """更新输出格式请求"""
    name: str = ""
    description: str = ""
    json_schema: dict[str, Any] = Field(default_factory=dict, alias="schema")
    sample_output: str = ""
    retry_prompt: str = ""

    model_config = {"populate_by_name": True}


# ── API 响应模型 ──────────────────────────────────

class ApiResponse(BaseModel):
    """API 响应"""
    success: bool = True
    message: str = ""
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    """分页响应"""
    items: list[Any]
    total: int
    page: int = 1
    size: int = 50
