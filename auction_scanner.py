import os
os.environ["NO_PROXY"] = "*"
import time
import pandas as pd
import akshare as ak


def get_auction_sector_data():
    """获取概念板块实时热度，包含5分钟涨幅"""
    try:
        # 获取最新涨停板数据
        from datetime import datetime
        import time
        date_str = datetime.now().strftime('%Y%m%d')
        df = ak.stock_zt_pool_em(date_str)
        
        # 如果今天没数据（可能是非交易日），尝试前一天
        if df is None or len(df) == 0:
            date_str = pd.Timestamp.now().round('D').add(pd.Timedelta(days=-1)).strftime('%Y%m%d')
            df = ak.stock_zt_pool_em(date_str)
            if df is None or len(df) == 0:
                date_str = pd.Timestamp.now().round('D').add(pd.Timedelta(days=-2)).strftime('%Y%m%d')
                df = ak.stock_zt_pool_em(date_str)
                if df is None or len(df) == 0:
                    date_str = pd.Timestamp.now().round('D').add(pd.Timedelta(days=-3)).strftime('%Y%m%d')
                    df = ak.stock_zt_pool_em(date_str)
        
        if df is None or len(df) == 0:
            return []
            
        # 挑选核心监控列
        cols = ['代码', '名称', '涨跌幅', '最新价', '连板数', '封板资金', '首次封板时间', '所属行业']
        df = df[cols].copy()
        
        # 强制转换数值类型，防止排序出错
        df['涨跌幅'] = pd.to_numeric(df['涨跌幅'], errors='coerce')
        df['最新价'] = pd.to_numeric(df['最新价'], errors='coerce')
        df['连板数'] = pd.to_numeric(df['连板数'], errors='coerce')
        df['封板资金'] = pd.to_numeric(df['封板资金'], errors='coerce')

        def first_time_sort_key(value):
            if pd.isna(value):
                return 24 * 60 * 60
            raw = str(value).strip()
            try:
                if ':' in raw:
                    parts = [int(part) for part in raw.split(':')]
                    hour, minute = parts[:2]
                    second = parts[2] if len(parts) > 2 else 0
                else:
                    digits = str(int(float(raw))).zfill(6)
                    hour, minute, second = int(digits[:2]), int(digits[2:4]), int(digits[4:6])
                return hour * 3600 + minute * 60 + second
            except (TypeError, ValueError, OverflowError):
                return 24 * 60 * 60

        # 连板数高的优先；同板数按首次封板时间从早到晚，缺失时间排最后。
        df['_first_time_sort'] = df['首次封板时间'].map(first_time_sort_key)
        df = df.sort_values(by=['连板数', '_first_time_sort'], ascending=[False, True]).reset_index(drop=True)
        df = df.drop(columns=['_first_time_sort'])
        
        # 重命名列为英文键，方便 API 和前端使用
        df = df.rename(columns={
            '代码': 'code',
            '名称': 'name',
            '涨跌幅': 'change_percent',
            '最新价': 'latest_price',
            '连板数': 'continuous_days',
            '封板资金': 'fund',
            '首次封板时间': 'first_time',
            '所属行业': 'industry'
        })
        return df.to_dict('records')
    except Exception as e:
        print(f"Error in get_auction_sector_data: {e}")
        # 打印错误到后台日志，不打断界面显示
        return []

if __name__ == "__main__":
    sectors = get_auction_sector_data()
    for s in sectors[:10]:
        print(s)
