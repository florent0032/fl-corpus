# fl-corpus

多语种语料管理系统 — 基于 LLM 的智能词条生成平台

一个支持多语言的语料管理系统，用于管理词汇、知识库检索和 LLM 驱动的词条生成。支持日语、阿拉伯语、韩语、波斯语、西班牙语等多种语言，通过 FTS5 全文检索从语料库中提取用例，结合 LLM 自动生成结构化词条。

## ✨ 功能特性

### 📖 词语库管理
- 支持日语、阿拉伯语、韩语、波斯语、西班牙语等多种语言
- 每个词语库绑定一个输出格式，确保词条结构一致
- 支持添加、编辑、删除词语库
- 每个词语库独立管理待处理词语和已处理词条

### 📚 知识库管理
- SQLite FTS5 全文检索，trigram 分词支持多语言
- 双通道搜索：FTS5 MATCH 优先，LIKE 模糊匹配兜底
- 支持多种文件格式（txt, md, json, csv, srt, vtt, ass 等）
- 自动清理字幕格式代码（ASS, SRT, VTT）
- 多知识库联合检索，可调整检索优先级

### ⚡ LLM 词条处理
- OpenAI 兼容 API 支持（方舟、腾讯云、有道等供应商）
- 多供应商管理，支持连接测试
- 自定义系统提示词
- 自动生成词条 JSON（读音、声调、词性、释义、用例）
- JSON Schema 验证 + 基础验证，失败自动重试（最多 3 次）

### 🧩 后处理插件系统
- 可扩展的插件架构，继承 BasePlugin 基类
- OJAD 日语声调填充插件（支持本地缓存）
- 批量处理已生成的词条
- 支持按词库和语言筛选

### 📐 输出格式管理
- JSON Schema 定义词条结构
- 输出格式验证
- 重试提示词配置
- 每个词语库绑定一个输出格式

### 📋 字段管理
- 预设字段（汉字、音调、词性、释义等）
- 自定义字段扩展（text/textarea/select/json 四种类型）
- 按语言配置适用字段
- 支持默认值设置

## 🚀 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- npm 或 yarn

### 安装

```bash
# 克隆仓库
git clone https://github.com/florent0032/fl-corpus.git
cd fl-corpus

# 安装后端依赖
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 安装前端依赖
cd ../frontend
npm install
```

### 启动

```bash
# 方式一：使用启动脚本（推荐）
chmod +x start.sh
./start.sh

# 方式二：分别启动

# 启动后端 (端口 8011)
cd backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8011 --reload

# 启动前端 (端口 3011)
cd frontend
npm run dev
```

### 访问

- 前端界面: http://localhost:3011
- 后端 API: http://localhost:8011
- API 文档: http://localhost:8011/docs

## 🏗️ 技术栈

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.14 | 运行环境 |
| FastAPI | 0.136.3 | Web 框架 |
| Pydantic | 2.13.4 | 数据验证 |
| Uvicorn | - | ASGI 服务器 |
| httpx | 0.28.1 | 异步 HTTP 客户端 |
| loguru | 0.7.3 | 日志 |
| SQLite3 | 内置 | FTS5 全文检索 |

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | v24.16.0 | 运行环境 |
| Next.js | 16.2.7 | React 框架 |
| React | 19.2.4 | UI 库 |
| TypeScript | 5 | 类型系统 |
| Tailwind CSS | 4 | 样式框架 |

## 📁 项目结构

```
fl-corpus/
├── start.sh                    # 启动脚本
├── .gitignore
├── backend/                    # FastAPI 后端
│   ├── main.py                 # 应用入口，注册路由和 CORS
│   ├── config.py               # 配置管理，JSON 读写，预设字段定义
│   ├── models/__init__.py      # Pydantic 数据模型 (25+ 个模型)
│   ├── routers/                # API 路由 (10 个模块)
│   │   ├── words.py           # 词语 CRUD + 重新处理
│   │   ├── kb.py              # 知识库 CRUD + FTS5 搜索
│   │   ├── process.py         # 处理任务管理 (后台异步)
│   │   ├── vendors.py         # 供应商管理 + 连接测试
│   │   ├── prompts.py         # 提示词 CRUD
│   │   ├── languages.py       # 语言和词库 CRUD
│   │   ├── fields.py          # 字段管理
│   │   ├── settings.py        # 系统设置
│   │   ├── output_formats.py  # 输出格式 CRUD
│   │   └── plugins.py         # 插件管理 + 后台执行
│   ├── services/               # 业务逻辑
│   │   ├── process_service.py # 处理流程服务 (核心)
│   │   ├── llm_service.py     # LLM 调用服务
│   │   ├── kb_service.py      # 知识库搜索服务
│   │   └── subtitle_cleaner.py # 字幕格式清理器
│   ├── plugins/                # 后处理插件
│   │   ├── __init__.py        # 插件基类和注册表
│   │   └── accent_filler.py   # OJAD 声调填充插件
│   └── venv/                   # Python 虚拟环境
├── frontend/                   # Next.js 前端
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app/               # 页面
│       │   ├── layout.tsx     # 全局布局 (Sidebar + 主内容区)
│       │   ├── page.tsx       # 首页 (词语库列表)
│       │   ├── api/proxy/     # API 代理
│       │   ├── words/         # 词语管理
│       │   ├── process/       # 处理词语
│       │   ├── tasks/         # 任务管理
│       │   ├── postprocess/   # 后处理插件
│       │   ├── fields/        # 字段管理
│       │   ├── kb/            # 知识库管理
│       │   ├── vendors/       # 供应商管理
│       │   ├── prompts/       # 提示词管理
│       │   ├── output-formats/# 输出格式管理
│       │   └── settings/      # 系统设置
│       ├── components/        # 组件
│       │   ├── Sidebar.tsx    # 侧边栏导航
│       │   └── LanguageSelector.tsx # 语言选择器
│       └── lib/
│           └── languages.ts   # 世界语言列表 (80+ 种语言)
├── data/                       # 数据文件
│   ├── languages.json         # 语言和词库配置
│   ├── vendors.json           # LLM 供应商配置 (含 API 密钥)
│   ├── prompts.json           # 提示词模板
│   ├── output_formats.json    # 输出格式定义
│   ├── fields.json            # 自定义字段配置
│   ├── settings.json          # 系统设置
│   ├── kb_registry.json       # 知识库注册表
│   ├── pending.json           # 待处理词语
│   ├── tasks.json             # 任务历史
│   └── output/                # 已处理词条 (按词库分文件)
├── kb/                         # 知识库数据库 (SQLite FTS5)
└── docs/                       # 文档
```

## 🌍 支持语言

| 语言 | 代码 | 分词器 | 提示词模板 | 词库示例 |
|------|------|--------|-----------|---------|
| 日语 | `ja` | mecab | japanese | JLPT N1-N5, jp_test |
| 阿拉伯语 | `ar` | camel | arabic | test, test_ar1-3 |
| 韩语 | `ko` | mecab-ko | korean | TOPIK I, TOPIK II |
| 波斯语 | `fa` | hazm | persian | (待配置) |
| 西班牙语 | `es` | spacy | spanish | (待配置) |

## 📊 数据模型

### 词语状态流转

```
pending → processing → done
                    → failed
```

### 核心数据文件

#### languages.json — 语言与词库配置

```json
{
  "languages": {
    "ja": {
      "name": "日语",
      "name_en": "Japanese",
      "rtl": false,
      "collections": [
        {
          "id": "n1",
          "name": "JLPT N1",
          "desc": "日语能力考试 N1 级",
          "output_format": "ja_entry",
          "usage_field": "usages"
        }
      ],
      "tokenizer": "mecab",
      "prompt_template": "japanese"
    }
  }
}
```

#### pending.json — 待处理词语

```json
{
  "id": "20260612120000123456",
  "lang": "ja",
  "collection_id": "n1",
  "word": "食べる",
  "json_input": {
    "word": "食べる",
    "pron": "たべる",
    "pos": "动词",
    "meaning": "吃"
  },
  "knowledge_bases": ["jp_anime", "jp_novel"],
  "fallback_words": ["食べ", "食べた"],
  "status": "pending",
  "error": "",
  "added_at": "2026-06-12T12:00:00",
  "updated_at": "2026-06-12T12:00:00"
}
```

#### output/{collection_id}.json — 已处理词条

```json
{
  "word": "食べる",
  "pron": "たべる",
  "accent": "②",
  "pos": "动",
  "meaning_zh": "吃",
  "usages": [
    {
      "source": "动画名",
      "sentence": "ご飯を食べる",
      "chinese": "吃饭"
    }
  ]
}
```

### 文件关系图

```
languages.json ──→ output_formats.json  (词库绑定输出格式)
       │
       ├──→ prompts.json                (语言关联提示词模板)
       │
       └──→ pending.json ──→ tasks.json (词语经过任务处理)
                │
                └──→ output/{id}.json   (处理结果按词库存储)

vendors.json ──→ tasks.json             (任务记录供应商配置)
kb_registry.json ──→ pending.json       (词语关联知识库用于检索)
```

## 🔧 API 端点

### 词语管理 (`/api/words`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/words` | 待处理词语列表 |
| POST | `/api/words` | 添加单个词语 |
| PUT | `/api/words/{word_id}` | 更新待处理词语 |
| POST | `/api/words/batch` | 批量添加词语 |
| DELETE | `/api/words/{word_id}` | 删除待处理词语 |
| POST | `/api/words/batch-delete` | 批量删除待处理词语 |
| GET | `/api/words/processed` | 已处理词语列表 |
| PUT | `/api/words/processed/{collection_id}/{word}` | 更新已处理词语 |
| DELETE | `/api/words/processed/{collection_id}/{word}` | 删除已处理词语 |
| POST | `/api/words/processed/batch-delete` | 批量删除已处理词语 |
| POST | `/api/words/processed/{collection_id}/{word}/reprocess` | 单个词语重新处理 |
| POST | `/api/words/processed/batch-reprocess` | 批量重新处理 |

### 知识库管理 (`/api/kb`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/kb` | 知识库列表 |
| GET | `/api/kb/browse/dirs` | 浏览目录 |
| GET | `/api/kb/{kb_name}` | 知识库详情 |
| POST | `/api/kb` | 创建知识库 |
| PUT | `/api/kb/{kb_name}` | 更新知识库 |
| DELETE | `/api/kb/{kb_name}` | 删除知识库 |
| POST | `/api/kb/{kb_name}/toggle` | 启用/禁用 |
| GET | `/api/kb/{kb_name}/search` | 搜索知识库内容 |

### 供应商管理 (`/api/vendors`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/vendors` | 供应商列表 |
| POST | `/api/vendors` | 添加供应商 |
| PUT | `/api/vendors/{vendor_id}` | 更新供应商 |
| DELETE | `/api/vendors/{vendor_id}` | 删除供应商 |
| GET | `/api/vendors/{vendor_id}/models` | 获取模型列表 |
| POST | `/api/vendors/{vendor_id}/models` | 添加模型 |
| POST | `/api/vendors/{vendor_id}/test` | 测试供应商连接 |
| POST | `/api/vendors/{vendor_id}/models/{model}/test` | 测试指定模型 |

### 处理任务 (`/api/process`)

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/process/start` | 启动处理任务 |
| GET | `/api/process/status` | 获取处理状态 |
| GET | `/api/process/tasks` | 任务列表 |
| GET | `/api/process/tasks/current` | 当前任务详情 |
| GET | `/api/process/tasks/{task_id}` | 指定任务详情 |
| POST | `/api/process/stop` | 停止处理 |
| POST | `/api/process/retry-failed` | 重试失败词语 |
| POST | `/api/process/reset-failed` | 重置失败词语为待处理 |

### 提示词管理 (`/api/prompts`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/prompts` | 提示词列表 |
| GET | `/api/prompts/{prompt_id}` | 提示词详情 |
| POST | `/api/prompts` | 添加提示词 |
| PUT | `/api/prompts/{prompt_id}` | 更新提示词 |
| DELETE | `/api/prompts/{prompt_id}` | 删除提示词 |

### 语言管理 (`/api/languages`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/languages` | 所有语言列表 |
| GET | `/api/languages/{lang_code}` | 指定语言配置 |
| POST | `/api/languages/collections` | 添加词库 |
| PUT | `/api/languages/collections/{lang_code}/{collection_id}` | 更新词库 |
| DELETE | `/api/languages/collections/{lang_code}/{collection_id}` | 删除词库 |

### 字段管理 (`/api/fields`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/fields` | 字段列表 |
| GET | `/api/fields/{field_id}` | 字段详情 |
| POST | `/api/fields` | 添加自定义字段 |
| PUT | `/api/fields/{field_id}` | 更新字段 |
| DELETE | `/api/fields/{field_id}` | 删除自定义字段 |
| POST | `/api/fields/init-presets` | 初始化预设字段 |

### 输出格式管理 (`/api/output-formats`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/output-formats` | 输出格式列表 |
| GET | `/api/output-formats/{format_id}` | 输出格式详情 |
| POST | `/api/output-formats` | 添加输出格式 |
| PUT | `/api/output-formats/{format_id}` | 更新输出格式 |
| DELETE | `/api/output-formats/{format_id}` | 删除输出格式 |

### 插件管理 (`/api/plugins`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/plugins` | 可用插件列表 |
| GET | `/api/plugins/status` | 插件执行状态 |
| POST | `/api/plugins/{plugin_id}/run` | 运行插件 |
| POST | `/api/plugins/stop` | 停止插件 |

### 系统设置 (`/api/settings`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |

## 📝 使用流程

### 1. 配置供应商

在"供应商"页面添加 LLM 供应商（如方舟、腾讯云、有道等），配置 API 密钥和模型。支持连接测试。

### 2. 创建知识库

在"知识库"页面创建知识库，选择语料目录。系统会自动清理字幕格式代码并建立 FTS5 索引。

### 3. 创建词语库

在首页点击"添加词库"，选择语言、输入词库名称，绑定输出格式。

### 4. 添加词语

在"添加词语"页面输入词语信息，选择知识库用于检索用例。支持批量导入。

### 5. 处理词语

在"处理词语"页面选择供应商、模型、提示词，启动处理任务。系统会自动从知识库检索用例，调用 LLM 生成词条。

### 6. 后处理

在"后处理"页面运行插件（如 OJAD 声调填充），批量处理已生成的词条。

### 7. 查看结果

在词语库详情页面查看已处理的词条，支持编辑、删除、批量操作和重新处理。

## 🔌 扩展开发

### 添加新语言

在 `data/languages.json` 中添加语言配置：

```json
{
  "languages": {
    "zh": {
      "name": "中文",
      "name_en": "Chinese",
      "rtl": false,
      "collections": [
        {
          "id": "hsk1",
          "name": "HSK 1",
          "desc": "汉语水平考试 1 级",
          "output_format": "chinese_entry",
          "usage_field": "usages"
        }
      ],
      "tokenizer": "jieba",
      "prompt_template": "chinese"
    }
  }
}
```

### 添加新输出格式

在 `data/output_formats.json` 中添加输出格式定义，包含 JSON Schema 和示例输出。

### 添加新插件

在 `backend/plugins/` 目录下创建新的插件类，继承 `BasePlugin` 并实现 `process_entry` 方法：

```python
from backend.plugins import BasePlugin, PluginResult

class MyPlugin(BasePlugin):
    id = "my_plugin"
    name = "我的插件"
    description = "插件描述"
    supported_languages = ["ja", "ar"]
    target_field = "my_field"

    def should_process(self, entry: dict) -> bool:
        return not entry.get(self.target_field)

    def process_entry(self, entry: dict, **kwargs) -> PluginResult:
        # 处理逻辑
        entry[self.target_field] = "处理结果"
        return PluginResult(success=True, modified=True)
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
