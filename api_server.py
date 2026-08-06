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
    """启动后台监控服务"""
    try:
        from monitor_service import start_monitor
        from auction_monitor import start_auction_monitor
        # 在多进程模式下(如 debug=True 的 auto-reloader)，避免启动两次
        # Flask 的 Werkzeug reloader 启动时会设置 WERKZEUG_RUN_MAIN=true
        import os
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
            start_monitor()
    except Exception as e:
        print(f"[初始化] 监控服务启动失败: {e}")

def start_scheduler_service():
    """
    启动定时任务服务（参考 start_monitor 的守护线程+轮询实现，无需额外依赖）
    功能：每个交易日 09:45 自动触发自选股成交量预测计算
    """
    try:
        import threading
        import time
        from datetime import datetime
        from api_routes import run_watchlist_volume_prediction_task

        import os
        if os.environ.get('WERKZEUG_RUN_MAIN') != 'true' and app.debug:
            # 不是 werkzeug 的真正 worker 进程，跳过
            return

        # 记录今天是否已经执行过，避免在 09:45 这一分钟内因为轮询间隔小而重复执行
        state = {'last_run_date': None}

        def _scheduler_loop():
            print("[Scheduler] 守护线程定时服务已启动：每日 09:45 自动计算自选股成交量预测")
            while True:
                try:
                    now = datetime.now()
                    today_str = now.strftime('%Y-%m-%d')

                    # 跨天重置执行标记
                    if state['last_run_date'] == today_str:
                        # 今天已经执行过，直接 sleep
                        time.sleep(30)
                        continue

                    weekday = now.weekday()
                    current_hm = (now.hour, now.minute)
                    # 只在工作日执行，且时间窗口锁定为 09:45 ~ 09:46（给一分钟容错窗口）
                    if weekday < 5 and current_hm >= (9, 45) and current_hm <= (9, 46):
                        print(f"[Scheduler] 到达 09:45，开始执行自选股成交量预测任务 [{today_str}]")
                        try:
                            run_watchlist_volume_prediction_task()
                        except Exception as e:
                            print(f"[Scheduler] 任务执行异常: {e}")
                            import traceback
                            traceback.print_exc()
                        # 标记今日已执行
                        state['last_run_date'] = today_str
                        print(f"[Scheduler] {today_str} 成交量预测任务执行完成")
                except Exception as e:
                    print(f"[Scheduler] 定时循环异常: {e}")
                # 每 30 秒轮询一次，足够捕捉 09:45 的时间窗口
                time.sleep(30)

        t = threading.Thread(target=_scheduler_loop, name="WatchlistVolumeScheduler", daemon=True)
        t.start()
    except Exception as e:
        print(f"[Scheduler] 定时服务启动失败: {e}")
        import traceback
        traceback.print_exc()

register_routes()
init_database()

if __name__ == '__main__':
    start_monitor_service()
    start_scheduler_service()
    print("=" * 60)
    print("股票数据API服务启动")
    print("=" * 60)
    print("访问 http://localhost:5001 查看API文档")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5001, debug=True)
