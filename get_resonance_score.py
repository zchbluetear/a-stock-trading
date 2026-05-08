import akshare as ak
import pandas as pd
import numpy as np

def get_resonance_score(target_stock_code, df_sectors=None, target_sector=None, t_limit_stocks=None):
    """
    计算特定二连板个股的题材共振指数 (极速版)
    :param target_stock_code: 股票代码 (如 "600519")
    :param df_sectors: 可选，行业板块排行数据
    :param target_sector: 可选，目标个股所属板块名称
    :param t_limit_stocks: 可选，当日涨停池数据 (用于快速统计板块涨停数)
    """
    
    # 1. 获取基础数据
    if df_sectors is None:
        try:
            df_sectors = ak.stock_board_industry_name_em()
        except:
            return None
    
    if not target_sector:
        return None

    # 3. --- 维度 A: 板块地位 (权重 40%) ---
    df_sectors['rank'] = df_sectors['涨跌幅'].rank(ascending=False)
    try:
        match_df = df_sectors[df_sectors['板块名称'] == target_sector]
        if match_df.empty:
            # 尝试模糊匹配（处理诸如 "航天装备Ⅱ" 和 "航天装备" 的差异）
            match_df = df_sectors[df_sectors['板块名称'].str.contains(target_sector, na=False, regex=False)]
            
        if not match_df.empty:
            sector_rank = match_df['rank'].values[0]
        else:
            sector_rank = 99
    except:
        sector_rank = 99

    if sector_rank <= 10:
        score_a = 100
    elif sector_rank <= 20:
        score_a = 80
    else:
        score_a = 40
    
    # 4. --- 维度 B: 集群效应 (权重 30%) ---
    # 利用当日涨停池快速统计，替代耗时的全市场快照和成分股查询
    if t_limit_stocks is not None:
        limit_up_count = len([s for s in t_limit_stocks if s.get('industry') == target_sector])
    else:
        limit_up_count = 0
    
    if limit_up_count >= 5:
        score_b = 100
    elif limit_up_count >= 3:
        score_b = 80
    elif limit_up_count >= 1:
        score_b = 50
    else:
        score_b = 0

    # --- 维度 C: 梯队支撑 (权重 20%) ---
    # 逻辑：查找同板块是否有 3 板及以上的“空间板”
    # 极速版简化逻辑：如果同板块有涨停，说明有大哥带路
    if limit_up_count > 0:
        score_c = 100
    else:
        score_c = 60 # 自己就是领头羊，给个及格分

    # --- 维度 D: 大盘环境 (权重 10%) ---
    # 行业板块的上涨家数存在标的重叠（总计约16000），此处计算真实上涨比例并映射回真实A股数量（约5300）
    try:
        total_sector_up = df_sectors['上涨家数'].sum()
        total_sector_down = df_sectors['下跌家数'].sum()
        total_sector_stocks = total_sector_up + total_sector_down
        if total_sector_stocks > 0:
            up_ratio = total_sector_up / total_sector_stocks
            up_count = int(up_ratio * 5300)
        else:
            up_count = 2500
    except:
        up_count = 2500
    
    if up_count >= 3500:
        score_d = 100
    elif up_count >= 3000:
        score_d = 80
    elif up_count >= 2000:
        score_d = 60
    else:
        score_d = 30

    # --- 最终加权评分 ---
    total_score = (score_a * 0.4) + (score_b * 0.3) + (score_c * 0.2) + (score_d * 0.1)
    
    return {
        "个股代码": target_stock_code,
        "所属板块": target_sector,
        "板块排名": int(sector_rank),
        "同板块涨停数": limit_up_count,
        "大盘上涨家数": up_count,
        "共振指数评分": round(total_score, 2)
    }

# --- 实战调用示例 ---
# 假设我们要分析当前的某个二连板股票
# result = get_resonance_score("600000") # 替换为你的目标代码
# print(result)