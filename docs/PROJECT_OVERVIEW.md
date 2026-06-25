# 项目架构与设计文档

## 1. 项目概述

多语种语料管理系统是一个用于管理多语言词汇、知识库检索和 LLM 驱动的词条生成的全栈应用。系统采用配置驱动的设计理念，支持任意语言的语料管理。

### 1.1 设计理念

- **语言配置化**：通过 `data/languages.json` 定义语言特性，无需修改代码
- **字段可扩展**：预设常用字段 + 用户自定义字段，适应不同语言需求
- **服务可插拔**：音调服务、分词器、提示词模板按语言配置
- **数据结构统一**：所有语言使用相同的 JSON 结构，便于前端渲染

### 1.2 核心价值

1. **降低语言学习成本**：通过自动化词条生成，减少手动整理时间
2. **提高语料利用率**：将分散的语料库整合为结构化词条
3. **支持多语言扩展**：配置驱动，轻松添加新语言支持
4. **保证数据质量**：通过输出格式验证和重试机制确保词条质量

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 16 + React 19 | 服务端渲染 + 客户端交互 |
| UI | Tailwind CSS | 原子化 CSS 框架 |
| 后端 | FastAPI | 高性能异步 Python 框架 |
| 数据库 | SQLite FTS5 | 全文检索引擎 |
| 数据存储 | JSON 文件 | 配置和词条数据 |
| LLM | OpenAI 兼容 API | 支持多种供应商 |

### 2.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Next.js)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ 词语库  │ │ 添加词语│ │ 处理词语│ │ 知识库  │  ...     │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │
│       │           │           │           │                │
│       └───────────┴───────────┴───────────┘                │
│                           │                                 │
│                    API Proxy (/api/proxy)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                       后端 (FastAPI)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    API 路由层                         │   │
│  │  words.py  kb.py  vendors.py  prompts.py  ...       │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌─────────────────────┴───────────────────────────────┐   │
│  │                    服务层                             │   │
│  │  process_service.py  llm_service.py  kb_service.py  │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌─────────────────────┴───────────────────────────────┐   │
│  │                    数据层                             │   │
│  │  JSON 文件 (data/)  SQLite (kb/)                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 数据流

```
用户输入词语
    ↓
存储到 pending.json
    ↓
选择供应商/模型/提示词
    ↓
从知识库检索用例 (FTS5)
    ↓
构建提示词 (词语信息 + 用例 + 输出格式)
    ↓
调用 LLM 生成词条
    ↓
验证输出格式 (JSON Schema)
    ↓
验证失败 → 重试 (最多 3 次)
    ↓
验证通过 → 存储到 output/{collection_id}.json
```

## 3. 核心模块详解

### 3.1 语言配置 (languages.json)

语言配置是系统的核心，定义了每种语言的特性：

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
          "name": "N1",
          "desc": "JLPT N1",
          "output_format": "ja_entry",
          "created_at": "2026-06-01T00:00:00"
        }
      ],
      "accent_service": "ojad",
      "tokenizer": "mecab",
      "prompt_template": "japanese"
    }
  }
}
```

**关键字段说明**：
- `collections`: 词语库列表，每个词语库绑定一个输出格式
- `output_format`: 绑定的输出格式 ID
- `accent_service`: 音调服务（如 OJAD）
- `tokenizer`: 分词器
- `prompt_template`: 默认提示词模板

### 3.2 输出格式 (output_formats.json)

输出格式定义了词条的 JSON 结构，用于验证 LLM 输出：

```json
{
  "id": "ja_entry",
  "name": "日语词条格式",
  "schema": {
    "type": "object",
    "properties": {
      "word": {"type": "string"},
      "pron": {"type": "string"},
      "accent": {"type": "string"},
      "pos": {"type": "string"},
      "meaning_zh": {"type": "string"},
      "usages": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "source": {"type": "string"},
            "sentence": {"type": "string"},
            "chinese": {"type": "string"}
          }
        }
      }
    },
    "required": ["word", "pron", "pos", "meaning_zh", "usages"]
  },
  "sample_output": "{...}",
  "retry_prompt": "请严格按照指定JSON格式输出..."
}
```

**设计要点**：
- 每个输出格式对应一种语言的词条结构
- `schema` 用于验证 LLM 输出
- `sample_output` 提供给 LLM 作为参考
- `retry_prompt` 在验证失败时发送给 LLM

### 3.3 知识库服务 (kb_service.py)

知识库服务负责语料的索引和检索：

```python
class KBService:
    def search(self, kb_name, keywords, page, page_size, min_snippet_len):
        # 1. FTS5 全文检索
        # 2. LIKE 模糊匹配兜底
        # 3. 去重和排序
        # 4. 构建上下文感知的摘要
        pass

    def search_across_kbs(self, kb_names, keywords, target_count):
        # 跨多个知识库搜索
        pass
```

**检索流程**：
1. 对每个关键词进行 FTS5 检索
2. 如果 FTS5 结果不足，使用 LIKE 兜底
3. 去重（基于文件名和 chunk_id）
4. 构建上下文感知的摘要（包含前后文）
5. 按分数排序
6. 返回指定数量的结果

### 3.4 处理服务 (process_service.py)

处理服务是系统的核心，负责协调整个词条生成流程：

```python
class ProcessService:
    async def process_single_word(self, word_entry, vendor, model, 
                                   prompt_template, output_format, config):
        # 1. 从知识库检索语料
        kb_results = kb_service.search_across_kbs(...)

        # 2. 带重试的 LLM 调用
        for attempt in range(max_retries):
            entry = await llm_service.generate_entry(...)
            
            # 3. 验证输出格式
            if not validate(entry, schema):
                continue
            
            # 4. 基础验证
            if not validate_entry(entry, word):
                continue
            
            break

        # 5. 标准化词条
        entry = normalize_entry(entry, output_format)
        
        return entry
```

**关键设计**：
- 支持兜底词搜索：当原词检索不到足够用例时，使用兜底词继续搜索
- 带重试的 LLM 调用：验证失败时携带错误信息重试
- 输出格式过滤：只保留输出格式中定义的字段

### 3.5 LLM 服务 (llm_service.py)

LLM 服务负责与 LLM API 交互：

```python
class LLMService:
    async def generate_entry(self, word_entry, kb_results, prompt_template, 
                             output_format, vendor, model, max_usages):
        # 1. 构建知识库检索结果文本
        kb_text = build_kb_text(kb_results)

        # 2. 构建词条信息文本
        word_info = build_word_info(word_entry)

        # 3. 构建输出格式说明
        format_desc = build_format_desc(output_format)

        # 4. 构建用户提示词
        user_prompt = f"""
        词条信息：{word_info}
        知识库检索结果：{kb_text}
        输出格式要求：{format_desc}
        """

        # 5. 调用 LLM
        messages = [
            {"role": "system", "content": prompt_template},
            {"role": "user", "content": user_prompt},
        ]
        text = await self.chat(messages, vendor, model)

        # 6. 解析 JSON
        entry = self._parse_json_response(text)
        
        return entry
```

### 3.6 字幕清理器 (subtitle_cleaner.py)

字幕清理器负责清理各种字幕格式的代码：

```python
class SubtitleCleaner:
    @staticmethod
    def clean(content, format_hint=None):
        # 1. 检测格式 (ASS, SRT, VTT)
        fmt = detect_format(content)
        
        # 2. 根据格式选择清理方法
        if fmt == 'ass':
            return clean_ass(content)
        elif fmt == 'srt':
            return clean_srt(content)
        elif fmt == 'vtt':
            return clean_vtt(content)
```

**支持的格式**：
- ASS/SSA: 去除 Dialogue 行的格式代码
- SRT: 去除序号、时间戳、HTML 标签
- VTT: 去除 WEBVTT 头、时间戳、HTML 标签

## 4. 前端架构

### 4.1 页面结构

```
src/app/
├── page.tsx                    # 首页（词语库列表）
├── words/
│   ├── add/page.tsx           # 添加词语
│   └── [lang]/[collectionId]/page.tsx  # 词语库详情
├── process/page.tsx           # 处理词语
├── kb/page.tsx                # 知识库管理
├── vendors/page.tsx           # 供应商管理
├── prompts/page.tsx           # 提示词管理
├── fields/page.tsx            # 字段管理
├── output-formats/page.tsx    # 输出格式管理
├── postprocess/page.tsx       # 后处理插件
└── settings/page.tsx          # 系统设置
```

### 4.2 组件设计

#### LanguageSelector 组件
支持全部语言 + 搜索模式的语言选择器：
- 搜索语言（中文名、英文名、本地名）
- 显示常用语言快捷选项
- 支持键盘导航
- 显示语言代码和本地名称

#### Sidebar 组件
侧边栏导航组件：
- Logo 区域
- 功能菜单（10 个主要功能）
- 主题切换（亮色/暗色）
- 版本信息

### 4.3 API 代理

前端通过 `/api/proxy/[...path]/route.ts` 代理所有 API 请求到后端：

```typescript
async function proxyRequest(request, method, context) {
  const path = context.params.path.join("/");
  const backendUrl = `http://127.0.0.1:8011/api/${path}${url.search}`;
  
  const res = await fetch(backendUrl, {
    method,
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
  
  return NextResponse.json(await res.json());
}
```

## 5. 数据存储设计

### 5.1 JSON 文件存储

配置和词条数据使用 JSON 文件存储：

| 文件 | 用途 | 更新频率 |
|------|------|----------|
| languages.json | 语言和词库配置 | 低 |
| vendors.json | LLM 供应商配置 | 低 |
| prompts.json | 提示词模板 | 低 |
| output_formats.json | 输出格式定义 | 低 |
| fields.json | 自定义字段配置 | 低 |
| settings.json | 系统设置 | 低 |
| kb_registry.json | 知识库注册表 | 中 |
| pending.json | 待处理词语 | 高 |
| output/{id}.json | 已处理词条 | 高 |

### 5.2 SQLite 知识库

知识库使用 SQLite FTS5 实现全文检索：

```sql
CREATE VIRTUAL TABLE docs USING fts5(
    filename UNINDEXED,
    chunk_id UNINDEXED,
    content,
    tokenize='trigram'
);
```

**索引策略**：
- 使用 trigram tokenizer 支持中日韩文检索
- filename 和 chunk_id 不参与索引
- content 字段建立全文索引

### 5.3 数据备份

建议定期备份以下目录：
- `data/` - 所有配置和词条数据
- `kb/` - 知识库数据

## 6. 安全设计

### 6.1 API 密钥管理

- API 密钥存储在 `data/vendors.json` 中
- 前端不显示完整密钥
- 建议使用环境变量管理敏感信息

### 6.2 输入验证

- 所有 API 输入使用 Pydantic 模型验证
- JSON 格式验证
- SQL 注入防护（使用参数化查询）

### 6.3 错误处理

- 统一的错误响应格式
- 详细的错误日志
- 用户友好的错误提示

## 7. 性能优化

### 7.1 知识库检索优化

- 使用 FTS5 全文索引
- 结果去重和缓存
- 限制返回数量

### 7.2 LLM 调用优化

- 异步调用
- 超时控制
- 重试机制

### 7.3 前端优化

- 服务端渲染 (SSR)
- 按需加载
- 响应式设计

## 8. 扩展性设计

### 8.1 添加新语言

只需在 `data/languages.json` 中添加配置，无需修改代码。

### 8.2 添加新输出格式

在 `data/output_formats.json` 中添加输出格式定义。

### 8.3 添加新插件

在 `backend/plugins/` 目录下创建新的插件类：

```python
class MyPlugin(BasePlugin):
    @property
    def id(self) -> str:
        return "my_plugin"
    
    @property
    def name(self) -> str:
        return "我的插件"
    
    async def process_entry(self, entry: dict, config: dict) -> dict:
        # 处理逻辑
        return entry
```

### 8.4 添加新供应商

在 `data/vendors.json` 中添加供应商配置，支持任何 OpenAI 兼容 API。

## 9. 部署建议

### 9.1 开发环境

```bash
# 后端
cd backend && source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8011 --reload

# 前端
cd frontend && npm run dev
```

### 9.2 生产环境

```bash
# 后端
cd backend && source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8011 --workers 4

# 前端
cd frontend && npm run build && npm start
```

### 9.3 Docker 部署

```dockerfile
# 后端 Dockerfile
FROM python:3.10
WORKDIR /app
COPY backend/ .
RUN pip install -r requirements.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8011"]

# 前端 Dockerfile
FROM node:18
WORKDIR /app
COPY frontend/ .
RUN npm install && npm run build
CMD ["npm", "start"]
```

## 10. 常见问题

### Q: 如何添加新的语言支持？

A: 在 `data/languages.json` 中添加语言配置，包括语言代码、名称、词语库列表、分词器等。

### Q: 如何自定义输出格式？

A: 在 `data/output_formats.json` 中添加新的输出格式定义，包含 JSON Schema 和示例输出。

### Q: 如何提高知识库检索质量？

A: 
1. 使用更干净的语料数据
2. 调整 `min_snippet_len` 参数
3. 增加更多知识库
4. 使用兜底词

### Q: 如何处理 LLM 输出格式不正确？

A: 
1. 检查输出格式的 JSON Schema 是否正确
2. 优化提示词模板
3. 调整 `retry_prompt`
4. 增加重试次数

## 11. 未来规划

### 11.1 短期目标

- [ ] 支持更多语言（泰语、越南语等）
- [ ] 优化知识库检索算法
- [ ] 添加批量导入功能
- [ ] 支持导出为 Anki 格式

### 11.2 中期目标

- [ ] 支持自定义分词器
- [ ] 添加词条翻译功能
- [ ] 支持多用户协作
- [ ] 添加数据分析面板

### 11.3 长期目标

- [ ] 支持语音输入
- [ ] 添加 AI 辅助学习功能
- [ ] 构建词条社区
- [ ] 支持移动端

## 12. 贡献指南

欢迎贡献代码、文档、语料数据等！

### 12.1 代码贡献

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 Pull Request

### 12.2 语料贡献

1. 准备干净的语料数据
2. 按语言分类整理
3. 提交到 `data/corpus/` 目录

### 12.3 文档贡献

1. 完善 README
2. 添加使用示例
3. 翻译文档

## 13. 许可证

MIT License
