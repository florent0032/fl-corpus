# 多语种语料管理系统扩展方案

## 📋 目录

1. [系统概述](#系统概述)
2. [架构设计](#架构设计)
3. [实施步骤](#实施步骤)
4. [技术细节](#技术细节)
5. [注意事项](#注意事项)

---

## 系概述

### 设计理念

本系统采用**配置驱动**的设计理念，支持任意语言的语料管理：

- **语言配置化** -- 通过 `data/languages.json` 定义语言特性，无需修改代码
- **字段可扩展** -- 预设常用字段 + 用户自定义字段，适应不同语言需求
- **服务可插拔** -- 音调服务、分词器、提示词模板按语言配置
- **数据结构统一** -- 所有语言使用相同的 JSON 结构，便于前端渲染

### 默认预配置语言

| 语言 | 代码 | 等级体系 | 分词器 | 特殊需求 |
|------|------|---------|--------|---------|
| 日语 | `ja` | JLPT N1-N5 | mecab | 音调、假名读音 |
| 阿拉伯语 | `ar` | 基础/中级/高级 | camel | 词根、RTL显示 |
| 韩语 | `ko` | TOPIK I/II | mecab-ko | 汉字、罗马音 |
| 波斯语 | `fa` | 基础/中级/高级 | hazm | 词根、RTL显示 |
| 西班牙语 | `es` | DELE A1-C1 | spacy | 名词性别、变位 |

### 添加新语言

只需在 `data/languages.json` 中添加配置，无需修改任何代码：

```json
{
  "languages": {
    "zh": {
      "name": "中文",
      "name_en": "Chinese",
      "rtl": false,
      "collections": [
        {"id": "hsk1", "name": "HSK 1", "desc": "汉语水平考试 1 级"},
        {"id": "hsk2", "name": "HSK 2", "desc": "汉语水平考试 2 级"}
      ],
      "accent_service": null,
      "tokenizer": "jieba",
      "prompt_template": "chinese"
    }
  }
}
```

### 数据结构（统一设计）

所有语言使用相同的 JSON 结构：

```json
{
  "word": "...",                    // 必填：单词原文
  "pron": "...",                    // 必填：读音/转写（可为空）
  "hanja": "...",                   // 可选：汉字/词根
  "accent": "...",                  // 可选：音调/重音
  "pos": "...",                     // 可选：词性
  "meaning_zh": "...",              // 可选：中文释义
  "lang": "...",                    // 必填：语言代码
  "conjugations": {},               // 可选：变位/活用形
  "notes": "...",                   // 可选：注解
  "usages": []                      // 必填：用例列表
}
```

### 多语种数据结构（统一兜底设计）

**设计原则**：
- 所有字段必须存在（可为空字符串或空对象）
- 确保数据结构统一，便于前端渲染和后端处理
- 语言特有字段用于特定功能（如日语音调、阿拉伯语词根）

```json
// 统一数据结构（所有语言通用）
{
  "word": "...",                    // 必填：单词原文
  "pron": "...",                    // 必填：读音/转写（可为空）
  "hanja": "...",                   // 必填：汉字/词根（可为空）
  "accent": "...",                  // 必填：音调/重音（可为空）
  "pos": "...",                     // 必填：词性
  "meaning_zh": "...",              // 必填：中文释义
  "lang": "...",                    // 必填：语言代码
  "conjugations": {},               // 必填：变位/活用形（可为空对象）
  "usages": []                      // 必填：用例列表
}
```

**各语言示例**：

```json
// 日语
{
  "word": "勉強",
  "pron": "べんきょう",
  "hanja": "",
  "accent": "⓪",
  "pos": "名/动",
  "meaning_zh": "学习",
  "lang": "ja",
  "conjugations": {
    "masu": "勉強します",
    "te": "勉強して",
    "ta": "勉強した",
    "nai": "勉強しない"
  },
  "usages": [...]
}

// 阿拉伯语
{
  "word": "دراسة",
  "pron": "dirāsa",
  "hanja": "د-ر-س",
  "accent": "",
  "pos": "اسم",
  "meaning_zh": "学习",
  "lang": "ar",
  "conjugations": {
    "past_3ms": "دَرَسَ",
    "past_3fs": "دَرَسَت",
    "present_3ms": "يَدْرُسُ",
    "present_3fs": "تَدْرُسُ",
    "imperative_2ms": "اُدْرُسْ"
  },
  "usages": [...]
}

// 韩语
{
  "word": "공부",
  "pron": "gongbu",
  "hanja": "工夫",
  "accent": "",
  "pos": "명사",
  "meaning_zh": "学习",
  "lang": "ko",
  "conjugations": {
    "verb_form": "공부하다",
    "past": "공부했다",
    "present": "공부한다",
    "future": "공부할 것이다",
    "negative": "공부하지 않다"
  },
  "usages": [...]
}

// 波斯语
{
  "word": "درس",
  "pron": "dars",
  "hanja": "",
  "accent": "",
  "pos": "اسم",
  "meaning_zh": "课程",
  "lang": "fa",
  "conjugations": {
    "plural": "درس‌ها",
    "ezafe": "درسِ"
  },
  "usages": [...]
}

// 西班牙语
{
  "word": "estudiar",
  "pron": "estuˈðjar",
  "hanja": "",
  "accent": "",
  "pos": "verbo",
  "meaning_zh": "学习",
  "lang": "es",
  "conjugations": {
    "present_yo": "estudio",
    "present_tu": "estudias",
    "present_el": "estudia",
    "preterite_yo": "estudié",
    "preterite_tu": "estudiaste",
    "preterite_el": "estudió",
    "future_yo": "estudiaré",
    "subjunctive_yo": "estudie"
  },
  "usages": [...]
}
  "gender": "masculino",
  "pos": "sustantivo",
  "meaning_zh": "学习",
  "lang": "es"
}
```

---

## 架构设计

### 1. 语言配置系统

#### 1.1 配置文件 (`data/languages.json`)

```json
{
  "languages": {
    "ja": {
      "name": "日语",
      "name_en": "Japanese",
      "rtl": false,
      "collections": [
        {"id": "n1", "name": "N1", "desc": "JLPT N1"},
        {"id": "n2", "name": "N2", "desc": "JLPT N2"},
        {"id": "n3", "name": "N3", "desc": "JLPT N3"},
        {"id": "n4", "name": "N4", "desc": "JLPT N4"},
        {"id": "n5", "name": "N5", "desc": "JLPT N5"}
      ],
      "accent_service": "ojad",
      "tokenizer": "mecab",
      "prompt_template": "japanese"
    },
    "ar": {
      "name": "阿拉伯语",
      "name_en": "Arabic",
      "rtl": true,
      "collections": [
        {"id": "ar_basic", "name": "基础", "desc": "阿拉伯语基础词汇"},
        {"id": "ar_inter", "name": "中级", "desc": "阿拉伯语中级词汇"},
        {"id": "ar_adv", "name": "高级", "desc": "阿拉伯语高级词汇"}
      ],
      "accent_service": null,
      "tokenizer": "camel",
      "prompt_template": "arabic"
    },
    "ko": {
      "name": "韩语",
      "name_en": "Korean",
      "rtl": false,
      "collections": [
        {"id": "topik1", "name": "TOPIK I", "desc": "TOPIK 初级"},
        {"id": "topik2", "name": "TOPIK II", "desc": "TOPIK 中高级"}
      ],
      "accent_service": null,
      "tokenizer": "mecab-ko",
      "prompt_template": "korean"
    },
    "fa": {
      "name": "波斯语",
      "name_en": "Persian",
      "rtl": true,
      "collections": [
        {"id": "fa_basic", "name": "基础", "desc": "波斯语基础词汇"},
        {"id": "fa_inter", "name": "中级", "desc": "波斯语中级词汇"}
      ],
      "accent_service": null,
      "tokenizer": "hazm",
      "prompt_template": "persian"
    },
    "es": {
      "name": "西班牙语",
      "name_en": "Spanish",
      "rtl": false,
      "collections": [
        {"id": "a1", "name": "A1", "desc": "DELE A1"},
        {"id": "a2", "name": "A2", "desc": "DELE A2"},
        {"id": "b1", "name": "B1", "desc": "DELE B1"},
        {"id": "b2", "name": "B2", "desc": "DELE B2"},
        {"id": "c1", "name": "C1", "desc": "DELE C1"}
      ],
      "accent_service": null,
      "tokenizer": "spacy",
      "prompt_template": "spanish"
    }
  }
}
```

#### 1.2 数据目录结构

```
data/
├── languages.json              # 语言配置
├── settings.json               # 全局设置
├── vendors.json                # 供应商配置
│
├── ja/                         # 日语数据
│   ├── collections.json
│   ├── pending.json
│   └── output/
│       ├── n1.json
│       ├── n2.json
│       └── ...
│
├── ar/                         # 阿拉伯语数据
│   ├── collections.json
│   ├── pending.json
│   └── output/
│       ├── ar_basic.json
│       └── ...
│
├── ko/                         # 韩语数据
├── fa/                         # 波斯语数据
├── es/                         # 西班牙语数据
│
└── .cache/                     # 缓存
    ├── ojad/                   # 日语音调缓存
    └── ...
```

### 2. 后端架构改造

#### 2.1 配置管理 (`backend/config.py`)

```python
# 添加语言配置支持
LANGUAGES_FILE = DATA_DIR / "languages.json"

def load_languages() -> dict:
    """加载语言配置"""
    if LANGUAGES_FILE.exists():
        with open(LANGUAGES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"languages": {}}

def get_language_config(lang_code: str) -> dict:
    """获取指定语言的配置"""
    languages = load_languages()
    return languages.get("languages", {}).get(lang_code, {})

def get_current_language() -> str:
    """获取当前语言（从环境变量或配置）"""
    return os.getenv("CORPUS_LANGUAGE", "ja")

def get_language_collections(lang_code: str) -> list:
    """获取指定语言的词语库列表"""
    lang_config = get_language_config(lang_code)
    return lang_config.get("collections", [])
```

#### 2.2 音调服务抽象 (`backend/services/accent_service.py`)

```python
from abc import ABC, abstractmethod
from typing import Optional

class AccentService(ABC):
    """音调服务基类"""
    
    @abstractmethod
    def get_accent(self, word: str) -> Optional[str]:
        """获取单词的音调/重音"""
        pass
    
    @abstractmethod
    def should_skip(self, word: str) -> bool:
        """判断是否跳过音调查询"""
        pass

class OJADAccentService(AccentService):
    """日语 OJAD 音调服务"""
    
    def get_accent(self, word: str) -> Optional[str]:
        # 现有的 OJAD 查询逻辑
        pass
    
    def should_skip(self, word: str) -> bool:
        # 现有的跳过逻辑
        pass

class NoAccentService(AccentService):
    """无音调服务（用于其他语言）"""
    
    def get_accent(self, word: str) -> Optional[str]:
        return None
    
    def should_skip(self, word: str) -> bool:
        return True

# 工厂函数
def get_accent_service(lang_code: str = None) -> AccentService:
    """根据语言代码获取音调服务"""
    if lang_code is None:
        from backend.config import get_current_language
        lang_code = get_current_language()
    
    if lang_code == "ja":
        return OJADAccentService()
    return NoAccentService()
```

#### 2.3 模型扩展 (`backend/models.py`)

```python
class ProcessedEntry(BaseModel):
    """已处理的词条"""
    word: str
    pron: str = ""
    accent: str = ""      # 日语音调
    root: str = ""        # 阿拉伯语/波斯语词根
    hanja: str = ""       # 韩语汉字
    gender: str = ""      # 西班牙语名词性别
    pos: str = ""
    meaning_zh: str = ""
    usages: list[Usage] = []
    lang: str = "ja"      # 语言代码
```

#### 2.4 路由改造 (`backend/routers/words.py`)

```python
@router.get("/collections")
def list_collections(lang: str = None):
    """获取词语库列表（支持语言过滤）"""
    if lang is None:
        from backend.config import get_current_language
        lang = get_current_language()
    
    # 加载该语言的配置
    lang_config = get_language_config(lang)
    collections_config = lang_config.get("collections", [])
    
    # 加载该语言的数据
    data_dir = DATA_DIR / lang
    collections_file = data_dir / "collections.json"
    
    # ... 加载和统计逻辑
```

### 3. 前端架构改造

#### 3.1 语言选择器组件 (`components/LanguageSelector.tsx`)

```tsx
"use client";

import { useState, useEffect } from "react";

interface Language {
  code: string;
  name: string;
  name_en: string;
  rtl: boolean;
}

export function LanguageSelector() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [currentLang, setCurrentLang] = useState("ja");

  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    const res = await fetch("/api/proxy/languages");
    const data = await res.json();
    setLanguages(data.items || []);
  };

  const handleChange = (langCode: string) => {
    setCurrentLang(langCode);
    // 触发语言切换事件
    window.dispatchEvent(
      new CustomEvent("languageChange", { detail: langCode })
    );
  };

  return (
    <select
      value={currentLang}
      onChange={(e) => handleChange(e.target.value)}
      className="px-3 py-2 bg-dark-200 border border-gray-700 rounded-lg"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}
```

#### 3.2 语言感知的数据加载

```tsx
// hooks/useLanguage.ts
"use client";

import { useState, useEffect } from "react";

export function useLanguage() {
  const [language, setLanguage] = useState("ja");

  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };

    window.addEventListener("languageChange", handleLanguageChange);
    return () => {
      window.removeEventListener("languageChange", handleLanguageChange);
    };
  }, []);

  return language;
}

// 在页面中使用
export default function CollectionsPage() {
  const language = useLanguage();
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    loadCollections();
  }, [language]);

  const loadCollections = async () => {
    const res = await fetch(`/api/proxy/words/collections?lang=${language}`);
    const data = await res.json();
    setCollections(data.items || []);
  };

  // ...
}
```

### 4. 系统提示词模板

创建 `backend/prompts/` 目录，存放各语种的提示词模板：

```python
# backend/prompts/__init__.py

PROMPT_TEMPLATES = {
    "japanese": """你是一个日语词汇卡片 JSON 生成助手。

你会收到：
1. 原始词条信息（单词、读音、释义）。
2. 从用户本地日语语料知识库检索出的片段。

你的任务：只输出一个严格 JSON object，不要 markdown，不要解释。

输出格式：
{
  "word": "...",
  "pron": "...",
  "hanja": "",
  "accent": "...",
  "pos": "...",
  "meaning_zh": "...",
  "lang": "ja",
  "conjugations": {
    "masu": "...",
    "te": "...",
    "ta": "...",
    "nai": "..."
  },
  "usages": [...]
}

字段要求：
- word：使用原始单词，不要改写。
- pron：使用原始读音（假名）。
- hanja：日语无汉字字段，留空字符串。
- accent：声调数字（带圈符号如 ⓪①②）。
- pos：用中文简写，例如 "名"、"动"、"形"、"副"。
- meaning_zh：简洁中文释义。
- lang：固定为 "ja"。
- conjugations：动词/形容词的活用形（ます形、て形、た形、否定形等）。名词可为空对象。
- usages：根据知识库检索结果生成。""",

    "arabic": """你是一个阿拉伯语词汇卡片 JSON 生成助手。

你会收到：
1. 原始词条信息（单词、读音、释义）。
2. 从用户本地阿拉伯语语料知识库检索出的片段。

你的任务：只输出一个严格 JSON object，不要 markdown，不要解释。

输出格式：
{
  "word": "...",
  "pron": "...",
  "hanja": "...",
  "accent": "",
  "pos": "...",
  "meaning_zh": "...",
  "lang": "ar",
  "conjugations": {
    "past_3ms": "...",
    "past_3fs": "...",
    "present_3ms": "...",
    "present_3fs": "...",
    "imperative_2ms": "..."
  },
  "usages": [...]
}

字段要求：
- word：使用阿拉伯语单词。
- pron：使用拉丁转写（阿拉伯语拼音）。
- hanja：填写词根（三字母根，如 د-ر-س）。
- accent：阿拉伯语无音调，留空字符串。
- pos：词性（اسم، فعل، صفة 等）。
- meaning_zh：简洁中文释义。
- lang：固定为 "ar"。
- conjugations：动词的变位（过去式、现在式、命令式等）。名词可为空对象。
- usages：根据知识库检索结果生成。""",

    "korean": """你是一个韩语词汇卡片 JSON 生成助手。

你会收到：
1. 原始词条信息（单词、读音、释义）。
2. 从用户本地韩语语料知识库检索出的片段。

你的任务：只输出一个严格 JSON object，不要 markdown，不要解释。

输出格式：
{
  "word": "...",
  "pron": "...",
  "hanja": "...",
  "accent": "",
  "pos": "...",
  "meaning_zh": "...",
  "lang": "ko",
  "conjugations": {
    "verb_form": "...",
    "past": "...",
    "present": "...",
    "future": "...",
    "negative": "..."
  },
  "usages": [...]
}

字段要求：
- word：使用韩文单词。
- pron：使用罗马音转写。
- hanja：对应的汉字（如果有，否则为空字符串）。
- accent：韩语无音调，留空字符串。
- pos：词性（명사、동사、형용사 等）。
- meaning_zh：简洁中文释义。
- lang：固定为 "ko"。
- conjugations：动词/形容词的活用形（过去式、现在式、将来式、否定式等）。名词可为空对象。
- usages：根据知识库检索结果生成。""",

    "persian": """你是一个波斯语词汇卡片 JSON 生成助手。

你会收到：
1. 原始词条信息（单词、读音、释义）。
2. 从用户本地波斯语语料知识库检索出的片段。

你的任务：只输出一个严格 JSON object，不要 markdown，不要解释。

输出格式：
{
  "word": "...",
  "pron": "...",
  "hanja": "...",
  "accent": "",
  "pos": "...",
  "meaning_zh": "...",
  "lang": "fa",
  "conjugations": {
    "plural": "...",
    "ezafe": "..."
  },
  "usages": [...]
}

字段要求：
- word：使用波斯语单词（阿拉伯字母）。
- pron：使用拉丁转写。
- hanja：填写词根（如果适用）。
- accent：波斯语无音调，留空字符串。
- pos：词性。
- meaning_zh：简洁中文释义。
- lang：固定为 "fa"。
- conjugations：名词的复数形式、伊扎费结构等。动词可为空对象。
- usages：根据知识库检索结果生成。""",

    "spanish": """你是一个西班牙语词汇卡片 JSON 生成助手。

你会收到：
1. 原始词条信息（单词、读音、释义）。
2. 从用户本地西班牙语语料知识库检索出的片段。

你的任务：只输出一个严格 JSON object，不要 markdown，不要解释。

输出格式：
{
  "word": "...",
  "pron": "...",
  "hanja": "",
  "accent": "",
  "pos": "...",
  "meaning_zh": "...",
  "lang": "es",
  "conjugations": {
    "present_yo": "...",
    "present_tu": "...",
    "present_el": "...",
    "preterite_yo": "...",
    "preterite_tu": "...",
    "preterite_el": "...",
    "future_yo": "...",
    "subjunctive_yo": "..."
  },
  "usages": [...]
}

字段要求：
- word：使用西班牙语单词。
- pron：使用国际音标。
- hanja：西班牙语无汉字/词根，留空字符串。
- accent：西班牙语无音调标记，留空字符串。
- pos：词性（sustantivo、verbo、adjetivo 等）。
- meaning_zh：简洁中文释义。
- lang：固定为 "es"。
- conjugations：动词的变位（现在时、过去时、将来时、虚拟式等）。名词可为空对象。
- usages：根据知识库检索结果生成。"""
}


def get_prompt_template(lang_code: str) -> str:
    """获取指定语言的提示词模板"""
    return PROMPT_TEMPLATES.get(lang_code, PROMPT_TEMPLATES["japanese"])
```

---

## 多系统提示词管理

### 设计理念

系统提示词不再是单一固定的，而是支持多个提示词模板，用户可以根据：
1. **语种**：日语、阿拉伯语、韩语等
2. **任务类型**：基础释义、详细用例、语法分析等
3. **输出风格**：简洁版、详细版、学术版等

来选择合适的系统提示词。

### 提示词配置文件 (`data/prompts.json`)

```json
{
  "prompts": {
    "ja_basic": {
      "id": "ja_basic",
      "name": "日语基础",
      "lang": "ja",
      "task_type": "basic",
      "description": "生成基础词条信息和简单用例",
      "template": "你是一个日语词汇卡片 JSON 生成助手。..."
    },
    "ja_detailed": {
      "id": "ja_detailed",
      "name": "日语详细",
      "lang": "ja",
      "task_type": "detailed",
      "description": "生成详细词条信息，包含丰富的用例和语法分析",
      "template": "你是一个专业的日语词汇分析助手。..."
    },
    "ja_academic": {
      "id": "ja_academic",
      "name": "日语学术",
      "lang": "ja",
      "task_type": "academic",
      "description": "学术风格，适合语言学习研究",
      "template": "你是一个日语语言学研究助手。..."
    },
    "ar_basic": {
      "id": "ar_basic",
      "name": "阿拉伯语基础",
      "lang": "ar",
      "task_type": "basic",
      "description": "生成基础词条信息",
      "template": "你是一个阿拉伯语词汇卡片 JSON 生成助手。..."
    },
    "ar_verb": {
      "id": "ar_verb",
      "name": "阿拉伯语动词",
      "lang": "ar",
      "task_type": "verb",
      "description": "专门处理动词，生成详细的变位表",
      "template": "你是一个阿拉伯语动词分析助手。..."
    },
    "ko_basic": {
      "id": "ko_basic",
      "name": "韩语基础",
      "lang": "ko",
      "task_type": "basic",
      "description": "生成基础词条信息",
      "template": "你是一个韩语词汇卡片 JSON 生成助手。..."
    },
    "es_basic": {
      "id": "es_basic",
      "name": "西班牙语基础",
      "lang": "es",
      "task_type": "basic",
      "description": "生成基础词条信息",
      "template": "你是一个西班牙语词汇卡片 JSON 生成助手。..."
    }
  }
}
```

### 前端提示词选择器

```tsx
// components/PromptSelector.tsx
"use client";

import { useState, useEffect } from "react";

interface Prompt {
  id: string;
  name: string;
  lang: string;
  task_type: string;
  description: string;
}

interface PromptSelectorProps {
  language: string;
  value: string;
  onChange: (promptId: string) => void;
}

export function PromptSelector({ language, value, onChange }: PromptSelectorProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    loadPrompts();
  }, [language]);

  const loadPrompts = async () => {
    const res = await fetch(`/api/proxy/prompts?lang=${language}`);
    const data = await res.json();
    setPrompts(data.items || []);
  };

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">系统提示词</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg"
      >
        {prompts.map((prompt) => (
          <option key={prompt.id} value={prompt.id}>
            {prompt.name} - {prompt.description}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 后端提示词管理

```python
# backend/routers/prompts.py

@router.get("")
def list_prompts(lang: str = None):
    """获取提示词列表（支持语言过滤）"""
    prompts = load_prompts()

    if lang:
        prompts = [p for p in prompts if p.get("lang") == lang]

    return {"items": prompts, "total": len(prompts)}


@router.get("/{prompt_id}")
def get_prompt(prompt_id: str):
    """获取单个提示词详情"""
    prompts = load_prompts()
    prompt = next((p for p in prompts if p["id"] == prompt_id), None)

    if not prompt:
        raise HTTPException(404, "提示词不存在")

    return prompt
```

---

## 词语处理参数配置

### 用户可配置参数

在处理词语时，用户可以选择以下参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `system_prompt_id` | string | 语言默认 | 系统提示词 ID |
| `max_usages` | int | 25 | 最大用例数量 |
| `min_snippet_len` | int | 15 | 最短片段长度（字符） |
| `knowledge_bases` | list[str] | [] | 选定的知识库列表 |
| `generate_accent` | bool | true | 是否生成音调/重音 |
| `generate_conjugations` | bool | true | 是否生成变位/活用形 |
| `generate_meaning` | bool | true | 是否生成中文释义 |
| `generate_pos` | bool | true | 是否生成词性 |

### 前端处理配置界面

```tsx
// components/ProcessConfig.tsx
"use client";

import { useState, useEffect } from "react";
import { PromptSelector } from "./PromptSelector";
import { KBSelector } from "./KBSelector";

interface ProcessConfig {
  systemPromptId: string;
  maxUsages: number;
  minSnippetLen: number;
  knowledgeBases: string[];
  generateAccent: boolean;
  generateConjugations: boolean;
  generateMeaning: boolean;
  generatePos: boolean;
}

interface ProcessConfigProps {
  language: string;
  value: ProcessConfig;
  onChange: (config: ProcessConfig) => void;
}

export function ProcessConfig({ language, value, onChange }: ProcessConfigProps) {
  const update = (updates: Partial<ProcessConfig>) => {
    onChange({ ...value, ...updates });
  };

  return (
    <div className="space-y-4 bg-dark-100 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white">处理配置</h3>

      {/* 系统提示词选择 */}
      <PromptSelector
        language={language}
        value={value.systemPromptId}
        onChange={(id) => update({ systemPromptId: id })}
      />

      {/* 知识库选择 */}
      <KBSelector
        language={language}
        value={value.knowledgeBases}
        onChange={(kbs) => update({ knowledgeBases: kbs })}
      />

      {/* 用例配置 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            最大用例数
          </label>
          <input
            type="number"
            value={value.maxUsages}
            onChange={(e) => update({ maxUsages: parseInt(e.target.value) || 25 })}
            min={0}
            max={50}
            className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">默认 25，最多 50</p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            最短片段长度
          </label>
          <input
            type="number"
            value={value.minSnippetLen}
            onChange={(e) => update({ minSnippetLen: parseInt(e.target.value) || 15 })}
            min={5}
            max={100}
            className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">默认 15 字符</p>
        </div>
      </div>

      {/* 生成选项 */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">生成选项</label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.generateAccent}
              onChange={(e) => update({ generateAccent: e.target.checked })}
            />
            <span className="text-sm text-gray-300">音调/重音</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.generateConjugations}
              onChange={(e) => update({ generateConjugations: e.target.checked })}
            />
            <span className="text-sm text-gray-300">变位/活用形</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.generateMeaning}
              onChange={(e) => update({ generateMeaning: e.target.checked })}
            />
            <span className="text-sm text-gray-300">中文释义</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.generatePos}
              onChange={(e) => update({ generatePos: e.target.checked })}
            />
            <span className="text-sm text-gray-300">词性</span>
          </label>
        </div>
      </div>
    </div>
  );
}
```

### 后端处理逻辑（参考 FlAgent）

```python
# backend/services/process_service.py

from flagent.core.agent import Agent
from flagent.core.tools.kb_tool import UniversalSearchTool

async def process_single_word(
    word: str,
    reading: str,
    lang: str,
    config: ProcessConfig,
    provider: str,
    model: str,
) -> Dict[str, Any]:
    """处理单个词语"""

    # 1. 获取系统提示词
    prompt_template = get_prompt_template_by_id(config.system_prompt_id)
    if not prompt_template:
        prompt_template = get_default_prompt_template(lang)

    # 2. 查询音调/重音
    accent = ""
    if config.generate_accent:
        accent_service = get_accent_service(lang)
        if not accent_service.should_skip(word):
            accent = accent_service.get_accent(word)

    # 3. 从知识库检索语料
    kb_results = []
    if config.knowledge_bases:
        kb_results = await search_usages_from_kbs(
            word=word,
            reading=reading,
            kb_names=config.knowledge_bases,
            target_count=config.max_usages * 2,  # 多检索一些，筛选后保留
            min_snippet_len=config.min_snippet_len,
        )

    # 4. 构建提示词
    prompt = build_prompt(
        word=word,
        reading=reading,
        lang=lang,
        kb_results=kb_results[:config.max_usages],
        prompt_template=prompt_template,
    )

    # 5. 调用 LLM
    agent = Agent(
        name=f"{lang}_agent",
        provider=provider,
        model=model,
        instruction=prompt_template,
        tools=[],
        mcp_servers=[],
    )

    result = await agent.provider.chat(
        messages=[
            {"role": "system", "content": prompt_template},
            {"role": "user", "content": prompt},
        ],
        model=model,
    )

    # 6. 解析和验证结果
    entry = parse_and_validate_response(result, word, lang)

    # 7. 补充额外字段
    entry["accent"] = accent
    entry["lang"] = lang

    return entry


async def search_usages_from_kbs(
    word: str,
    reading: str,
    kb_names: List[str],
    target_count: int,
    min_snippet_len: int,
) -> List[Dict[str, Any]]:
    """从多个知识库检索语料"""

    results = []
    seen = set()

    # 基础关键词
    keywords = [word]
    if reading and reading != word:
        keywords.append(reading)

    # 按知识库顺序检索
    for kb_name in kb_names:
        if len(results) >= target_count:
            break

        for keyword in keywords:
            if len(results) >= target_count:
                break

            data = await search_one_kb(
                kb_name=kb_name,
                keyword=keyword,
                page_size=target_count - len(results),
                min_snippet_len=min_snippet_len,
            )

            # 去重并添加
            for item in data:
                key = (item.get("file"), item.get("snippet"))
                if key not in seen:
                    seen.add(key)
                    results.append(item)

    return results[:target_count]
```

---

## 知识库搜索与筛选

### 知识库管理功能

知识库支持以下管理功能：

#### 1. 搜索功能

```tsx
// components/KBSelector.tsx
"use client";

import { useState, useEffect } from "react";

interface KB {
  name: string;
  lang: string;
  description: string;
  stats: {
    files: number;
    chunks: number;
  };
  tags: string[];
}

interface KBSelectorProps {
  language: string;
  value: string[];
  onChange: (selected: string[]) => void;
}

export function KBSelector({ language, value, onChange }: KBSelectorProps) {
  const [kbs, setKBs] = useState<KB[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLang, setFilterLang] = useState(language);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  useEffect(() => {
    loadKnowledgeBases();
  }, [filterLang]);

  const loadKnowledgeBases = async () => {
    const params = new URLSearchParams();
    if (filterLang) params.set("lang", filterLang);
    if (searchQuery) params.set("q", searchQuery);
    if (filterTags.length > 0) params.set("tags", filterTags.join(","));

    const res = await fetch(`/api/proxy/kb?${params}`);
    const data = await res.json();
    setKBs(data.items || []);
  };

  const toggleKB = (kbName: string) => {
    if (value.includes(kbName)) {
      onChange(value.filter((n) => n !== kbName));
    } else {
      onChange([...value, kbName]);
    }
  };

  const filteredKBs = kbs.filter((kb) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        kb.name.toLowerCase().includes(query) ||
        kb.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">知识库</label>

      {/* 搜索和筛选 */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索知识库..."
          className="flex-1 px-3 py-2 bg-dark-200 border border-gray-700 rounded-lg text-sm"
        />
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="px-3 py-2 bg-dark-200 border border-gray-700 rounded-lg text-sm"
        >
          <option value="">所有语种</option>
          <option value="ja">日语</option>
          <option value="ar">阿拉伯语</option>
          <option value="ko">韩语</option>
          <option value="fa">波斯语</option>
          <option value="es">西班牙语</option>
        </select>
      </div>

      {/* 知识库列表 */}
      <div className="max-h-60 overflow-y-auto space-y-2">
        {filteredKBs.map((kb) => (
          <label
            key={kb.name}
            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${
              value.includes(kb.name)
                ? "bg-blue-600/20 border border-blue-500/50"
                : "bg-dark-200 border border-gray-700 hover:border-gray-600"
            }`}
          >
            <input
              type="checkbox"
              checked={value.includes(kb.name)}
              onChange={() => toggleKB(kb.name)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{kb.name}</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-600 text-gray-300">
                  {kb.lang}
                </span>
                {kb.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-purple-600/20 text-purple-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {kb.description && (
                <p className="text-sm text-gray-400 mt-1">{kb.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {kb.stats.chunks.toLocaleString()} 条语料
              </p>
            </div>
          </label>
        ))}
      </div>

      {/* 已选择的知识库 */}
      {value.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-gray-400 mb-2">已选择：</p>
          <div className="flex flex-wrap gap-2">
            {value.map((kbName) => (
              <span
                key={kbName}
                className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm flex items-center gap-1"
              >
                {kbName}
                <button
                  onClick={() => toggleKB(kbName)}
                  className="hover:text-blue-300"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2. 后端知识库搜索 API

```python
# backend/routers/kb.py

@router.get("")
def list_kbs(
    lang: str = None,
    q: str = None,
    tags: str = None,
    page: int = 1,
    size: int = 50,
):
    """列出知识库（支持搜索和筛选）"""

    kbs = load_all_knowledge_bases()

    # 语言筛选
    if lang:
        kbs = [kb for kb in kbs if kb.get("lang") == lang]

    # 标签筛选
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        kbs = [
            kb for kb in kbs
            if any(tag in kb.get("tags", []) for tag in tag_list)
        ]

    # 搜索
    if q:
        q_lower = q.lower()
        kbs = [
            kb for kb in kbs
            if q_lower in kb["name"].lower()
            or q_lower in kb.get("description", "").lower()
        ]

    # 分页
    total = len(kbs)
    start = (page - 1) * size
    end = start + size
    items = kbs[start:end]

    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/{kb_name}/search")
def search_in_kb(
    kb_name: str,
    q: str,
    lang: str = None,
    page: int = 1,
    size: int = 20,
    min_len: int = 15,
):
    """在指定知识库中搜索"""

    # 验证知识库存在
    kb = get_knowledge_base(kb_name)
    if not kb:
        raise HTTPException(404, f"知识库不存在: {kb_name}")

    # 执行搜索
    results = search_knowledge_base(
        kb_name=kb_name,
        query=q,
        page=page,
        page_size=size,
        min_snippet_len=min_len,
    )

    return {
        "items": results,
        "total": len(results),
        "kb_name": kb_name,
        "query": q,
    }
```

#### 3. 知识库配置文件 (`data/kb_registry.json`)

```json
{
  "knowledge_bases": {
    "anime": {
      "name": "anime",
      "lang": "ja",
      "description": "日本动漫语料库",
      "tags": ["动漫", "口语", "日常"],
      "path": "C:\\Vault\\Language\\BahaNote\\语料库\\日语\\词库堆\\日漫",
      "enabled": true
    },
    "drama": {
      "name": "drama",
      "lang": "ja",
      "description": "日剧语料库",
      "tags": ["日剧", "口语", "生活"],
      "path": "C:\\Vault\\Language\\BahaNote\\语料库\\日语\\词库堆\\日剧",
      "enabled": true
    },
    "arabic_news": {
      "name": "arabic_news",
      "lang": "ar",
      "description": "阿拉伯语新闻语料",
      "tags": ["新闻", "正式", "书面"],
      "path": "C:\\Vault\\Language\\ArabicCorpus\\news",
      "enabled": true
    },
    "korean_drama": {
      "name": "korean_drama",
      "lang": "ko",
      "description": "韩剧语料库",
      "tags": ["韩剧", "口语", "日常"],
      "path": "C:\\Vault\\Language\\KoreanCorpus\\drama",
      "enabled": true
    }
  }
}
```

---

## 新增词语流程

### 步骤 1: 添加词语到待处理列表

**前端界面** (`app/words/add/page.tsx`)：

```tsx
"use client";

import { useState, useEffect } from "react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { CollectionSelector } from "@/components/CollectionSelector";

interface AddWordForm {
  lang: string;
  collectionId: string;
  word: string;
  reading: string;
  // 可选字段（叉选以激活）
  hanja: string;
  accent: string;
  pos: string;
  meaningZh: string;
}

export default function AddWordPage() {
  const [form, setForm] = useState<AddWordForm>({
    lang: "ja",
    collectionId: "",
    word: "",
    reading: "",
    hanja: "",
    accent: "",
    pos: "",
    meaningZh: "",
  });

  // 可选字段的激活状态
  const [activeFields, setActiveFields] = useState({
    hanja: false,
    accent: false,
    pos: false,
    meaningZh: false,
  });

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const updateForm = (updates: Partial<AddWordForm>) => {
    setForm({ ...form, ...updates });
  };

  const toggleField = (field: keyof typeof activeFields) => {
    setActiveFields({ ...activeFields, [field]: !activeFields[field] });
    // 如果取消激活，清空该字段
    if (activeFields[field]) {
      updateForm({ [field]: "" });
    }
  };

  const handleSubmit = async () => {
    if (!form.word.trim()) {
      setMessage("❌ 请输入词语");
      return;
    }

    if (!form.collectionId) {
      setMessage("❌ 请选择词语库");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/proxy/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang: form.lang,
          collection_id: form.collectionId,
          word: form.word.trim(),
          reading: form.reading.trim(),
          hanja: activeFields.hanja ? form.hanja.trim() : "",
          accent: activeFields.accent ? form.accent.trim() : "",
          pos: activeFields.pos ? form.pos.trim() : "",
          meaning_zh: activeFields.meaningZh ? form.meaningZh.trim() : "",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        // 清空表单
        setForm({
          ...form,
          word: "",
          reading: "",
          hanja: "",
          accent: "",
          pos: "",
          meaningZh: "",
        });
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">添加词语</h1>
        <p className="text-gray-400 mt-1">添加新词语到待处理列表</p>
      </header>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.startsWith("✅")
              ? "bg-green-600/20 text-green-400"
              : "bg-red-600/20 text-red-400"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* 基础信息 */}
        <div className="bg-dark-100 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">基础信息</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* 语种选择 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">语种 *</label>
              <LanguageSelector
                value={form.lang}
                onChange={(lang) => updateForm({ lang })}
              />
            </div>

            {/* 词语库选择 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                词语库 *
              </label>
              <CollectionSelector
                language={form.lang}
                value={form.collectionId}
                onChange={(id) => updateForm({ collectionId: id })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* 词语 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                词语 *
              </label>
              <input
                type="text"
                value={form.word}
                onChange={(e) => updateForm({ word: e.target.value })}
                placeholder="输入词语原文"
                className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* 发音 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                发音/读音
              </label>
              <input
                type="text"
                value={form.reading}
                onChange={(e) => updateForm({ reading: e.target.value })}
                placeholder="假名、罗马音、拉丁转写等"
                className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 可选字段 */}
        <div className="bg-dark-100 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            可选字段
            <span className="text-sm text-gray-400 font-normal ml-2">
              （叉选以激活，否则默认为空）
            </span>
          </h2>

          <div className="space-y-4">
            {/* 汉字/词根 */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFields.hanja}
                  onChange={() => toggleField("hanja")}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">
                  {form.lang === "ja" ? "汉字" : form.lang === "ar" || form.lang === "fa" ? "词根" : "汉字/词根"}
                </span>
              </label>
              {activeFields.hanja && (
                <input
                  type="text"
                  value={form.hanja}
                  onChange={(e) => updateForm({ hanja: e.target.value })}
                  placeholder={
                    form.lang === "ja"
                      ? "对应的汉字"
                      : form.lang === "ar" || form.lang === "fa"
                      ? "词根（如 د-ر-س）"
                      : "汉字或词根"
                  }
                  className="w-full px-4 py-2 mt-2 bg-dark-200 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* 音调/重音 */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFields.accent}
                  onChange={() => toggleField("accent")}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">音调/重音</span>
              </label>
              {activeFields.accent && (
                <input
                  type="text"
                  value={form.accent}
                  onChange={(e) => updateForm({ accent: e.target.value })}
                  placeholder="如 ⓪、①、② 或重音标记"
                  className="w-full px-4 py-2 mt-2 bg-dark-200 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* 词性 */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFields.pos}
                  onChange={() => toggleField("pos")}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">词性</span>
              </label>
              {activeFields.pos && (
                <input
                  type="text"
                  value={form.pos}
                  onChange={(e) => updateForm({ pos: e.target.value })}
                  placeholder="如 名、动、形、副"
                  className="w-full px-4 py-2 mt-2 bg-dark-200 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* 中文释义 */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFields.meaningZh}
                  onChange={() => toggleField("meaningZh")}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">中文释义</span>
              </label>
              {activeFields.meaningZh && (
                <input
                  type="text"
                  value={form.meaningZh}
                  onChange={(e) => updateForm({ meaningZh: e.target.value })}
                  placeholder="简洁的中文释义"
                  className="w-full px-4 py-2 mt-2 bg-dark-200 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !form.word.trim() || !form.collectionId}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors font-medium text-lg"
          >
            {isLoading ? "添加中..." : "添加到待处理"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 步骤 2: 处理词语到 JSON

**前端界面** (`app/process/page.tsx`)：

```tsx
"use client";

import { useState, useEffect } from "react";
import { VendorSelector } from "@/components/VendorSelector";
import { ProcessConfig } from "@/components/ProcessConfig";

interface ProcessStatus {
  running: boolean;
  total: number;
  processed: number;
  success: number;
  failed: number;
  currentWord: string;
  errors: string[];
}

export default function ProcessPage() {
  const [vendorId, setVendorId] = useState("");
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [config, setConfig] = useState({
    systemPromptId: "",
    maxUsages: 25,
    minSnippetLen: 15,
    knowledgeBases: [],
    generateAccent: true,
    generateConjugations: true,
    generateMeaning: true,
    generatePos: true,
  });

  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 加载供应商模型
  useEffect(() => {
    if (vendorId) {
      loadModels(vendorId);
    }
  }, [vendorId]);

  const loadModels = async (vid: string) => {
    const res = await fetch(`/api/proxy/vendors/${vid}/models`);
    const data = await res.json();
    setAvailableModels(data.models || []);
    if (data.models?.length > 0) {
      setModel(data.models[0]);
    }
  };

  // 轮询处理状态
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isProcessing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/proxy/process/status");
          const data = await res.json();
          setStatus(data);

          if (!data.running) {
            setIsProcessing(false);
            clearInterval(interval);
          }
        } catch (e) {
          console.error("获取状态失败:", e);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  const handleStartProcess = async () => {
    if (!vendorId || !model) {
      alert("请选择供应商和模型");
      return;
    }

    setIsProcessing(true);

    try {
      const res = await fetch("/api/proxy/process/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendorId,
          model: model,
          ...config,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "启动失败");
        setIsProcessing(false);
      }
    } catch (e) {
      alert("网络错误");
      setIsProcessing(false);
    }
  };

  const handleStopProcess = async () => {
    try {
      await fetch("/api/proxy/process/stop", { method: "POST" });
    } catch (e) {
      console.error("停止失败:", e);
    }
  };

  const progress = status
    ? status.total > 0
      ? (status.processed / status.total) * 100
      : 0
    : 0;

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">处理词语</h1>
        <p className="text-gray-400 mt-1">
          将待处理词语转换为完整的词条 JSON
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：配置面板 */}
        <div className="space-y-6">
          {/* 供应商和模型选择 */}
          <div className="bg-dark-100 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              LLM 配置
            </h2>

            <div className="space-y-4">
              <VendorSelector
                value={vendorId}
                onChange={setVendorId}
              />

              {availableModels.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    模型
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 处理配置 */}
          <ProcessConfig
            language="ja"
            value={config}
            onChange={setConfig}
          />

          {/* 操作按钮 */}
          <div className="flex gap-4">
            {!isProcessing ? (
              <button
                onClick={handleStartProcess}
                disabled={!vendorId || !model}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors font-medium"
              >
                🚀 开始处理
              </button>
            ) : (
              <button
                onClick={handleStopProcess}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium"
              >
                ⏹️ 停止处理
              </button>
            )}
          </div>
        </div>

        {/* 右侧：进度面板 */}
        <div className="bg-dark-100 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">处理进度</h2>

          {status ? (
            <div className="space-y-6">
              {/* 进度条 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">总体进度</span>
                  <span className="text-white">
                    {status.processed} / {status.total}
                  </span>
                </div>
                <div className="w-full bg-dark-200 rounded-full h-4">
                  <div
                    className="bg-blue-500 h-4 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-right text-sm text-gray-400 mt-1">
                  {progress.toFixed(1)}%
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-dark-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {status.success}
                  </div>
                  <div className="text-sm text-gray-400">成功</div>
                </div>
                <div className="bg-dark-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {status.failed}
                  </div>
                  <div className="text-sm text-gray-400">失败</div>
                </div>
                <div className="bg-dark-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {status.total - status.processed}
                  </div>
                  <div className="text-sm text-gray-400">待处理</div>
                </div>
              </div>

              {/* 当前处理的词 */}
              {status.running && status.currentWord && (
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">正在处理</div>
                  <div className="text-lg text-white font-medium">
                    {status.currentWord}
                  </div>
                </div>
              )}

              {/* 错误列表 */}
              {status.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    最近错误
                  </h3>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {status.errors.slice(-5).map((error, i) => (
                      <div
                        key={i}
                        className="bg-red-600/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400"
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">尚未开始处理</p>
              <p className="text-sm mt-2">
                配置好参数后点击"开始处理"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 后端处理流程

```python
# backend/routers/process.py

from fastapi import APIRouter, BackgroundTasks
from backend.services.process_service import ProcessService

router = APIRouter(prefix="/api/process", tags=["process"])

# 全局处理状态
_process_status = {
    "running": False,
    "total": 0,
    "processed": 0,
    "success": 0,
    "failed": 0,
    "current_word": "",
    "errors": [],
}


@router.post("/start")
async def start_processing(
    req: ProcessStartRequest,
    background_tasks: BackgroundTasks,
):
    """启动处理任务"""
    if _process_status["running"]:
        return {"success": False, "message": "已有任务在运行"}

    background_tasks.add_task(
        run_processing,
        vendor_id=req.vendor_id,
        model=req.model,
        config=req,
    )

    return {"success": True, "message": "处理任务已启动"}


@router.get("/status")
def get_process_status():
    """获取处理状态"""
    return _process_status


@router.post("/stop")
def stop_processing():
    """停止处理"""
    _process_status["running"] = False
    return {"success": True, "message": "已发送停止信号"}


async def run_processing(
    vendor_id: str,
    model: str,
    config: ProcessStartRequest,
):
    """后台运行处理任务"""
    global _process_status

    _process_status.update({
        "running": True,
        "total": 0,
        "processed": 0,
        "success": 0,
        "failed": 0,
        "current_word": "",
        "errors": [],
    })

    try:
        # 加载待处理词语
        pending_words = load_pending_words()

        # 按语言筛选
        if config.lang:
            pending_words = [w for w in pending_words if w.lang == config.lang]

        _process_status["total"] = len(pending_words)

        # 初始化服务
        process_service = ProcessService(
            vendor_id=vendor_id,
            model=model,
            config=config,
        )

        # 逐个处理
        for word_entry in pending_words:
            if not _process_status["running"]:
                break

            _process_status["current_word"] = word_entry.word

            try:
                result = await process_service.process_word(word_entry)

                # 保存结果
                save_processed_entry(word_entry.collection_id, result)

                _process_status["success"] += 1

            except Exception as e:
                error_msg = f"{word_entry.word}: {type(e).__name__}: {e}"
                _process_status["errors"].append(error_msg)
                _process_status["failed"] += 1

            _process_status["processed"] += 1

    except Exception as e:
        _process_status["errors"].append(f"任务异常: {e}")

    finally:
        _process_status["running"] = False
```

### 数据模型更新

```python
class AddWordRequest(BaseModel):
    """添加词语请求"""
    lang: str = "ja"
    collection_id: str
    word: str
    reading: str = ""
    hanja: str = ""      # 可选：汉字/词根
    accent: str = ""     # 可选：音调/重音
    pos: str = ""        # 可选：词性
    meaning_zh: str = "" # 可选：中文释义

class ProcessStartRequest(BaseModel):
    """启动处理任务请求"""
    vendor_id: str
    model: str
    lang: str = ""  # 空表示处理所有语言
    system_prompt_id: str = ""
    max_usages: int = 25
    min_snippet_len: int = 15
    knowledge_bases: list[str] = []
    generate_accent: bool = True
    generate_conjugations: bool = True
    generate_meaning: bool = True
    generate_pos: bool = True
```

### 完整工作流程图

```
┌─────────────────────────────────────────────────────────────┐
│ 步骤 1: 添加词语                                            │
├─────────────────────────────────────────────────────────────┤
│ 1. 选择语种（日语/阿拉伯语/韩语/波斯语/西班牙语）           │
│ 2. 选择词语库（N1/N2/TOPIK/DELE 等）                        │
│ 3. 输入词语 *                                               │
│ 4. 输入发音/读音                                            │
│ 5. 可选字段（叉选以激活）：                                 │
│    - 汉字/词根                                              │
│    - 音调/重音                                              │
│    - 词性                                                   │
│    - 中文释义                                               │
│ 6. 点击"添加到待处理"                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 步骤 2: 处理词语                                            │
├─────────────────────────────────────────────────────────────┤
│ 1. 选择供应商（方舟/DeepSeek/OpenAI 等）                    │
│ 2. 选择模型                                                 │
│ 3. 配置处理参数：                                           │
│    - 系统提示词（可选）                                     │
│    - 最大用例数（默认 25）                                  │
│    - 最短片段长度（默认 15）                                │
│    - 知识库选择（可多选）                                   │
│    - 生成选项（音调/变位/释义/词性）                        │
│ 4. 点击"开始处理"                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 步骤 3: 实时进度显示                                        │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 总体进度                                                │ │
│ │ ████████████████████░░░░░░░░░░  75%                    │ │
│ │ 150 / 200                                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │  成功 140 │ │  失败 10  │ │ 待处理 50 │                    │
│ └──────────┘ └──────────┘ └──────────┘                    │
│                                                             │
│ 正在处理: 勉強                                              │
│                                                             │
│ 最近错误:                                                   │
│ - xxx: LLM 超时                                             │
│ - yyy: 无效 JSON                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 实施步骤

### 阶段 1: 基础架构（1-2 周）

- [ ] 创建语言配置系统 (`languages.json`)
- [ ] 修改配置管理支持多语言
- [ ] 调整数据目录结构
- [ ] 添加语言字段到数据模型

### 阶段 2: 后端改造（1-2 周）

- [ ] 抽象音调服务接口
- [ ] 修改路由支持语言参数
- [ ] 创建多语种提示词模板
- [ ] 更新数据加载逻辑

### 阶段 3: 前端改造（1-2 周）

- [ ] 创建语言选择器组件
- [ ] 修改页面支持语言切换
- [ ] 添加 RTL 支持（阿拉伯语、波斯语）
- [ ] 更新 UI 文本

### 阶段 4: 语种特定功能（2-3 周）

- [ ] 阿拉伯语：词根提取、RTL 显示
- [ ] 韩语：韩语分词、汉字显示
- [ ] 波斯语：波斯语分词、RTL 显示
- [ ] 西班牙语：西班牙语分词、性别标记

### 阶段 5: 测试与优化（1 周）

- [ ] 功能测试
- [ ] 性能优化
- [ ] 文档更新

---

## 技术细节

### 分词器选择

| 语言 | 推荐分词器 | Python 包 | 备选方案 |
|------|-----------|-----------|---------|
| 日语 | MeCab | `mecab-python3` | Janome |
| 阿拉伯语 | CAMeL Tools | `camel-tools` | Farasa |
| 韩语 | MeCab-KO | `mecab-ko` | KoNLPy |
| 波斯语 | Hazm | `hazm` | Parsivar |
| 西班牙语 | spaCy | `spacy` | Stanza |

### 安装依赖

```bash
# 日语
pip install mecab-python3 unidic-lite

# 阿拉伯语
pip install camel-tools

# 韩语
pip install mecab-ko mecab-ko-dic

# 波斯语
pip install hazm

# 西班牙语
pip install spacy
python -m spacy download es_core_news_sm
```

### 字体支持

前端需要支持多语种字体：

```css
/* tailwind.config.ts */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        'arabic': ['Noto Sans Arabic', 'Arial', 'sans-serif'],
        'korean': ['Noto Sans KR', 'Malgun Gothic', 'sans-serif'],
        'persian': ['Noto Sans Arabic', 'Arial', 'sans-serif'],
        'japanese': ['Noto Sans JP', 'Hiragino Sans', 'sans-serif'],
      }
    }
  }
}
```

---

## 注意事项

### 1. 编码问题
- 所有文件使用 UTF-8 编码
- JSON 文件确保 `ensure_ascii=False`

### 2. RTL 支持
- 阿拉伯语和波斯语需要从右到左显示
- 使用 CSS `direction: rtl` 和 `text-align: right`

### 3. 字体支持
- 确保前端字体支持所有语种
- 使用 Google Fonts 的 Noto 系列字体

### 4. 性能考虑
- 多语种数据量大，注意内存使用
- 使用懒加载和分页
- 缓存策略按语言隔离

### 5. 数据迁移
- 现有日语数据需要迁移到 `data/ja/` 目录
- 提供数据迁移脚本

---

## 总结

这个方案将系统从日语专用扩展为多语种通用系统，主要改动：

1. **配置驱动**: 通过配置文件定义语言特性
2. **服务抽象**: 将语言特定功能抽象为可插拔的服务
3. **数据隔离**: 每种语言独立的数据目录
4. **前端灵活**: 支持语言切换和动态加载

**预计总工期**: 6-10 周

**优先级建议**:
1. 先完成日语的完整功能
2. 添加西班牙语（最简单，无特殊需求）
3. 添加韩语（需要分词支持）
4. 添加阿拉伯语/波斯语（需要 RTL 支持）
