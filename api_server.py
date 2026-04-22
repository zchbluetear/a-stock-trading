#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Flask API服务 - 股票数据查询接口
使用新浪和东方财富API提供股票数据
"""

from flask import Flask, jsonify
from flask_cors import CORS
import warnings

warnings.filterwarnings('ignore')

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 确保JSON响应使用UTF-8编码
app.config['JSON_AS_ASCII'] = False

# 导入并注册路由（延迟导入避免循环依赖）
def register_routes():
    from api_routes import register_routes as register
    register(app)

def init_database():
    """初始化数据库和默认配置"""
    try:
        from init_agents import init_default_agents
        init_default_agents()
    except Exception as e:
        print(f"[初始化] 数据库初始化失败: {e}")

def start_monitor_service():
    """启动强势股监控服务"""
    try:
        from monitor_service import start_monitor
        # 在多进程模式下(如 debug=True 的 auto-reloader)，避免启动两次
        # Flask 的 Werkzeug reloader 启动时会设置 WERKZEUG_RUN_MAIN=true
        import os
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
            start_monitor()
    except Exception as e:
        print(f"[初始化] 监控服务启动失败: {e}")

register_routes()
init_database()

if __name__ == '__main__':
    start_monitor_service()
    print("=" * 60)
    print("股票数据API服务启动")
    print("=" * 60)
    print("访问 http://localhost:5001 查看API文档")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5001, debug=True)
