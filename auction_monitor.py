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
        """判断当前是否为交易时间 包含集合竞价完成的时间(09:26:00 - 15:00:00)"""
        now = datetime.now()
        if now.weekday() >= 5: # 周末
            return False
        
        current_time = now.time()
        morning_start = datetime.strptime("09:26:00", "%H:%M:%S").time()
        morning_end = datetime.strptime("11:30:00", "%H:%M:%S").time()
        afternoon_start = datetime.strptime("13:00:00", "%H:%M:%S").time()
        afternoon_end = datetime.strptime("15:00:00", "%H:%M:%S").time()
        
        is_morning = morning_start <= current_time <= morning_end
        is_afternoon = afternoon_start <= current_time <= afternoon_end
        
        return is_morning or is_afternoon

    def _send_auction_data(self):
        """发送板块强度数据"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 开始获取并发送板块强度数据...")
        try:
            sectors = get_auction_sector_data()
            if not sectors:
                print("未获取到有效板块强度数据")
                return
                
            top_sectors = sectors[:10]
            title = f"集合板块强度播报 - {datetime.now().strftime('%Y-%m-%d')}"
            
            content = f"<h3>实时涨停股监控前10名</h3><table border='1' cellspacing='0' cellpadding='5'>"
            content += "<tr><th>排名</th><th>股票名称</th><th>今日涨幅</th><th>连板数</th><th>封板资金(亿)</th><th>所属行业</th></tr>"
            
            for i, sector in enumerate(top_sectors):
                change_color = "red" if sector.get('change_percent', 0) > 0 else "green"
                change_str = f"<span style='color: {change_color}'>{sector.get('change_percent', 0):.2f}%</span>"
                
                # 连板数
                m_val = sector.get('five_min_change', 0)
                if m_val > 2:
                    m_style = "color: red; font-weight: bold;"
                elif m_val > 0:
                    m_style = "color: red;"
                else:
                    m_style = "color: black;"
                m_str = f"<span style='{m_style}'>{m_val}</span>"
                
                # 资金换算为亿元
                net_inflow = sector.get('net_inflow', 0)
                money = net_inflow / 100000000 if net_inflow else 0
                money_color = "red" if money > 0 else "green"
                money_str = f"<span style='color: {money_color}'>{money:.2f}</span>"
                
                lead_stock = sector.get('lead_stock', '-')
                
                content += f"<tr><td>{i+1}</td><td>{sector.get('name', '')}</td><td>{change_str}</td><td>{m_str}</td><td>{money_str}</td><td>{lead_stock}</td></tr>"
            
            content += "</table>"
            
            send_wechat_notification(title, content, template="html")
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 发送异常: {e}")

    def _monitor_loop(self):
        while self.is_running:
            try:
                today_str = datetime.now().strftime('%Y-%m-%d')
                
                if self._is_auction_end_time():
                        self._send_auction_data()
                        self.last_run_date = today_str
                
                # 如果今天已经开始发送数据，则进入 10 分钟(600秒)发送一次的周期
                # 否则（如早盘开盘前）每 10 秒高频检查一次，以精准踩点 09:26
                if self.last_run_date == today_str:
                    time.sleep(600) 
                else:
                    time.sleep(10)
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 监控循环发生异常: {e}")
                time.sleep(600)

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [AuctionMonitor] 板块强度监控服务已启动...")

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)

auction_monitor_instance = AuctionMonitor()

def start_auction_monitor():
    auction_monitor_instance.start()
