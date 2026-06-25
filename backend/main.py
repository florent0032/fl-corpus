"""多语种语料管理系统 - FastAPI 后端"""

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import words, kb, prompts, vendors, process, languages, fields, settings, output_formats, plugins

app = FastAPI(
    title="多语种语料管理系统",
    description="支持任意语言的语料管理 API，通过配置文件定义语言特性",
    version="1.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(languages.router)
app.include_router(words.router)
app.include_router(fields.router)
app.include_router(kb.router)
app.include_router(prompts.router)
app.include_router(vendors.router)
app.include_router(process.router)
app.include_router(settings.router)
app.include_router(output_formats.router)
app.include_router(plugins.router)


@app.get("/")
def root():
    return {
        "message": "多语种语料管理系统 API",
        "version": "1.0.0",
        "description": "通过 data/languages.json 配置支持任意语言",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
