#!/bin/bash

# 多语种语料管理系统启动脚本

echo "🚀 启动多语种语料管理系统..."

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装"
    exit 1
fi

# 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

# 初始化数据（如果需要）
if [ ! -f "data/languages.json" ]; then
    echo "📁 初始化数据..."
    python3 init_data.py
fi

# 启动后端
echo "🔧 启动后端服务 (端口 8011)..."
backend/venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8011 --reload &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
echo "🎨 启动前端服务 (端口 3011)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 服务已启动！"
echo ""
echo "📝 访问地址："
echo "   - 前端界面: http://localhost:3011"
echo "   - 后端 API: http://localhost:8011"
echo "   - API 文档: http://localhost:8011/docs"
echo ""
echo "按 Ctrl+C 停止服务"

# 等待用户中断
trap "echo ''; echo '🛑 停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
