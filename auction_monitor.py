import time
import threading
from datetime import datetime
from notification import send_wechat_notification
from auction_scanner import get_auction_sector_data

class AuctionMonitor:
    def __init__(self):
        self.is_running = False
        self.thread = None
        self.last_run_date = None

    def _is_auction_end_time(self):
        """判断当前是否为集合竞价结束时间(09:25:00 - 09:26:00)"""
        now = datetime.now()
        if now.weekday() >= 5: # 周末
            return False
            
        current_time = now.time()
        start = datetime.strptime("09:25:00", "%H:%M:%S").time()
        end = datetime.strptime("09:27:00", "%H:%M:%S").time()
        
        return start <= current_time <= end

    def _send_auction_data(self):
        """发送集合竞价数据"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 开始获取并发送集合竞价数据...")
        try:
            sectors = get_auction_sector_data()
            if not sectors:
                print("未获取到有效集合竞价数据")
                return
                
            top_sectors = sectors[:10]
            title = f"早盘集合竞价板块强度播报 - {datetime.now().strftime('%Y-%m-%d')}"
            
            content = f"<h3>早盘集合竞价板块强度前10名</h3><table border='1' cellspacing='0' cellpadding='5'>"
            content += "<tr><th>排名</th><th>板块名称</th><th>涨跌幅</th><th>换手率</th><th>成交额(亿)</th></tr>"
            
            for i, sector in enumerate(top_sectors):
                change_color = "red" if sector['change_percent'] > 0 else "green"
                change_str = f"<span style='color: {change_color}'>{sector['change_percent']}%</span>" if sector['change_percent'] is not None else "-"
                
                amount_yi = f"{sector['amount'] / 100000000:.2f}" if sector['amount'] else "0"
                
                content += f"<tr><td>{i+1}</td><td>{sector['name']}</td><td>{change_str}</td><td>{sector['turnover_rate']}%</td><td>{amount_yi}</td></tr>"
            
            content += "</table>"
            
            send_wechat_notification(title, content, template="html")
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 发送异常: {e}")

    def _monitor_loop(self):
        while self.is_running:
            try:
                today_str = datetime.now().strftime('%Y-%m-%d')
                
                if self._is_auction_end_time():
                    if self.last_run_date != today_str:
                        self._send_auction_data()
                        self.last_run_date = today_str
                
                # 若已执行过今日任务，可休眠较长时间，否则每30秒检查一次
                if self.last_run_date == today_str:
                    time.sleep(3600) 
                else:
                    time.sleep(30)
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 监控循环发生异常: {e}")
                time.sleep(60)

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 集合竞价监控服务已启动...")

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)

auction_monitor_instance = AuctionMonitor()

def start_auction_monitor():
    auction_monitor_instance.start()
