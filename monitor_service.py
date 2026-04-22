#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""监控服务 - 负责后台轮询监控强势股并发出预警"""

import time
import threading
import requests
from datetime import datetime
import pandas as pd
from notification import send_wechat_notification

# 为了避免依赖循环，在函数内按需导入
def get_stock_data_fetchers():
    from data_fetchers import get_realtime_data
    return get_realtime_data

class StrongStockMonitor:
    def __init__(self):
        self.is_running = False
        self.thread = None
        # 记录今天已经预警过的股票代码，避免重复预警
        self.alerted_today = set()
        self.last_check_date = None
        
        # 预警阈值配置（可移至配置文件或数据库）
        self.OVERSOLD_THRESHOLD = -1.0  # 跌幅达到 -5% 视为深水区超卖
        self.POLL_INTERVAL = 60  # 轮询间隔（秒）
        
        # 缓存的强势股列表
        self.strong_stocks = []
        self.strong_stocks_date = None

    def _is_trading_time(self):
        """判断当前是否为交易时间"""
        now = datetime.now()
        # 周末不交易
        if now.weekday() >= 5:
            return False
            
        current_time = now.time()
        morning_start = datetime.strptime("09:30:00", "%H:%M:%S").time()
        morning_end = datetime.strptime("11:30:00", "%H:%M:%S").time()
        afternoon_start = datetime.strptime("13:00:00", "%H:%M:%S").time()
        afternoon_end = datetime.strptime("15:00:00", "%H:%M:%S").time()
        
        is_morning = morning_start <= current_time <= morning_end
        is_afternoon = afternoon_start <= current_time <= afternoon_end
        
        return is_morning or is_afternoon

    def _fetch_strong_stocks(self):
        """获取当天的强势股列表"""
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        # 移除缓存逻辑，因为盘中如果有股票炸板（取消涨停），强势股列表会动态变化
        # 因此每次轮询都应该获取最新的强势股列表
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Monitor] 正在获取强势股列表...")
            # 通过本地 API 获取强势股数据
            response = requests.get('http://127.0.0.1:5001/api/strategy/strong_stocks', timeout=30)
            if response.status_code == 200:
                data = response.json()
                if 'stocks' in data:
                    self.strong_stocks = data['stocks']
                    self.strong_stocks_date = today_str
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Monitor] 获取到 {len(self.strong_stocks)} 只强势股")
                    return self.strong_stocks
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Monitor] 获取强势股失败: {e}")
            
        return []

    def _check_oversold(self):
        """检查强势股是否触发超卖预警"""
        stocks = self._fetch_strong_stocks()
        if not stocks:
            return
            
        get_realtime_data = get_stock_data_fetchers()
        
        for stock in stocks:
            code = stock.get('code')
            name = stock.get('name')
            print("开始检查股票代码：", code)
            print("当前已经预警的股票代码：", self.alerted_today)
            # 如果今天已经预警过，跳过
            if code in self.alerted_today:
                continue
                
            try:
                # 获取实时数据
                rt_data = get_realtime_data(code)
                if not rt_data:
                    continue
                    
                change_percent = rt_data.get('change_percent', 0)
                current_price = rt_data.get('current_price', 0)
                
                # 检查是否满足深水区超卖条件 (跌幅 <= -5%)
                if change_percent <= self.OVERSOLD_THRESHOLD:
                    self._trigger_alert(code, name, change_percent, current_price)
                    
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [Monitor] 检查股票 {code} 异常: {e}")

    def _trigger_alert(self, code, name, change_percent, current_price):
        """触发预警"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [Monitor] 触发预警! {name}({code}) 跌幅 {change_percent:.2f}%")
        
        title = f"📉强势股超卖: {name}"
        content = f"""
        <h3>⚠️ 强势股进入深水区</h3>
        <ul>
            <li><b>股票代码:</b> {code}</li>
            <li><b>股票名称:</b> {name}</li>
            <li><b>当前价格:</b> {current_price:.2f}</li>
            <li><b>当前跌幅:</b> <span style="color: green;">{change_percent:.2f}%</span></li>
            <li><b>预警时间:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</li>
        </ul>
        <p><i>注：该股为前两日强势连板股，当前盘中跌幅已达到设定阈值（{self.OVERSOLD_THRESHOLD}%），存在首阴/深水区低吸机会，请结合盘面量能判断是否介入。</i></p>
        """
        
        # 发送微信推送
        res = send_wechat_notification(title, content, template="html")
        if res.get("success"):
            # 记录已预警
            self.alerted_today.add(code)

    def _monitor_loop(self):
        """监控主循环"""
        print("[Monitor] 强势股监控服务已启动运行...")
        
        while self.is_running:
            try:
                today_str = datetime.now().strftime("%Y-%m-%d")
                
                print("last_check_date:", self.last_check_date)
                print("today_str:", today_str)

                # 跨天重置预警记录
                if self.last_check_date != today_str:
                    self.alerted_today.clear()
                    self.last_check_date = today_str
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Monitor] 新的一个交易日，已重置预警记录。")
                
                # 只在交易时间进行监控
                if self._is_trading_time():
                    self._check_oversold()
                
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [Monitor] 监控循环发生异常: {e}")
                
            # 睡眠等待下一次轮询
            time.sleep(self.POLL_INTERVAL)

    def start(self):
        """启动监控服务"""
        if self.is_running:
            return
            
        self.is_running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        
    def stop(self):
        """停止监控服务"""
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)

# 全局单例
monitor_instance = StrongStockMonitor()

def start_monitor():
    monitor_instance.start()

if __name__ == "__main__":
    # 独立运行测试
    start_monitor()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        monitor_instance.stop()
