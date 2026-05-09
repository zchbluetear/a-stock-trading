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
        cols = ['代码', '名称', '涨跌幅', '连板数', '封板资金', '所属行业']
        df = df[cols].copy()
        
        # 强制转换数值类型，防止排序出错
        df['涨跌幅'] = pd.to_numeric(df['涨跌幅'], errors='coerce')
        df['连板数'] = pd.to_numeric(df['连板数'], errors='coerce')
        df['封板资金'] = pd.to_numeric(df['封板资金'], errors='coerce')
        
        # 排序逻辑：按连板数和封板资金降序
        df = df.sort_values(by=['连板数', '封板资金'], ascending=[False, False]).reset_index(drop=True)
        
        # 重命名列为英文键，方便 API 和前端使用
        df = df.rename(columns={
            '代码': 'code',
            '名称': 'name',
            '涨跌幅': 'change_percent',
            '连板数': 'five_min_change',  # 复用 existing 字段名以减少前端变动，但代表连板数
            '封板资金': 'net_inflow',     # 复用 existing 字段名
            '所属行业': 'lead_stock'      # 复用 existing 字段名
        })
        return df.head(50).to_dict('records')
    except Exception as e:
        print(f"Error in get_auction_sector_data: {e}")
        # 打印错误到后台日志，不打断界面显示
        return []

if __name__ == "__main__":
    sectors = get_auction_sector_data()
    for s in sectors[:10]:
        print(s)