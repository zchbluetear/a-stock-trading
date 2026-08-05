#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""技术指标计算模块"""

import pandas as pd
import numpy as np
import warnings
import time
from datetime import datetime
from data_fetchers import get_daily_kline, get_timeline_data, get_minute_kline, get_realtime_data, get_sector_info, get_money_flow, get_fundamental_data, get_industry_comparison
warnings.filterwarnings("ignore")

def calculate_ma(df, periods=[5, 10, 20, 30, 60]):
    """计算移动平均线（MA）"""
    if df is None or len(df) == 0 or 'close' not in df.columns:
        return df
    df = df.copy()
    for period in periods:
        df[f'MA{period}'] = df['close'].rolling(window=period, min_periods=1).mean()
    return df


def calculate_ema(df, periods=[12, 26, 50]):
    """计算指数移动平均线（EMA）"""
    if df is None or len(df) == 0 or 'close' not in df.columns:
        return df
    df = df.copy()
    for period in periods:
        df[f'EMA{period}'] = df['close'].ewm(span=period, adjust=False).mean()
    return df


def calculate_macd(df, fast=12, slow=26, signal=9):
    """计算MACD指标"""
    if df is None or len(df) == 0 or 'close' not in df.columns:
        return df
    df = df.copy()
    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()
    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()
    df['MACD_DIF'] = ema_fast - ema_slow
    df['MACD_DEA'] = df['MACD_DIF'].ewm(span=signal, adjust=False).mean()
    df['MACD'] = (df['MACD_DIF'] - df['MACD_DEA']) * 2
    return df


def calculate_rsi(df, period=14):
    """计算RSI相对强弱指标"""
    if df is None or len(df) == 0 or 'close' not in df.columns:
        return df
    df = df.copy()
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=1).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=1).mean()
    rs = gain / loss
    df[f'RSI{period}'] = 100 - (100 / (1 + rs))
    return df


def calculate_kdj(df, n=9, m1=3, m2=3):
    """计算KDJ指标"""
    if df is None or len(df) == 0:
        return df
    if 'high' not in df.columns or 'low' not in df.columns or 'close' not in df.columns:
        return df
    df = df.copy()
    low_list = df['low'].rolling(window=n, min_periods=1).min()
    high_list = df['high'].rolling(window=n, min_periods=1).max()
    rsv = (df['close'] - low_list) / (high_list - low_list) * 100
    df['KDJ_K'] = rsv.ewm(com=m1-1, adjust=False).mean()
    df['KDJ_D'] = df['KDJ_K'].ewm(com=m2-1, adjust=False).mean()
    df['KDJ_J'] = 3 * df['KDJ_K'] - 2 * df['KDJ_D']
    return df


def calculate_boll(df, period=20, std_dev=2):
    """计算布林带（BOLL）"""
    if df is None or len(df) == 0 or 'close' not in df.columns:
        return df
    df = df.copy()
    df['BOLL_MID'] = df['close'].rolling(window=period, min_periods=1).mean()
    std = df['close'].rolling(window=period, min_periods=1).std()
    df['BOLL_UPPER'] = df['BOLL_MID'] + (std * std_dev)
    df['BOLL_LOWER'] = df['BOLL_MID'] - (std * std_dev)
    return df


def calculate_obv(df):
    """计算OBV能量潮指标"""
    if df is None or len(df) == 0:
        return df
    if 'close' not in df.columns or 'volume' not in df.columns:
        return df
    df = df.copy()
    price_change = df['close'].diff()
    obv = (np.sign(price_change) * df['volume']).fillna(0)
    df['OBV'] = obv.cumsum()
    return df


def calculate_indicators(df, indicators=['MA', 'EMA', 'MACD', 'RSI', 'KDJ', 'BOLL', 'OBV']):
    """批量计算技术指标"""
    if df is None or len(df) == 0:
        return df
    result_df = df.copy()
    if 'MA' in indicators:
        result_df = calculate_ma(result_df, periods=[5, 10, 20, 30, 60])
    if 'EMA' in indicators:
        result_df = calculate_ema(result_df, periods=[12, 26, 50])
    if 'MACD' in indicators:
        result_df = calculate_macd(result_df)
    if 'RSI' in indicators:
        result_df = calculate_rsi(result_df, period=14)
    if 'KDJ' in indicators:
        result_df = calculate_kdj(result_df)
    if 'BOLL' in indicators:
        result_df = calculate_boll(result_df)
    if 'OBV' in indicators:
        result_df = calculate_obv(result_df)
    return result_df


# ==================== 数据整合函数 ====================

def get_comprehensive_data(code):
    """获取股票的综合数据"""
    result = {
        'code': code,
        'timestamp': datetime.now().isoformat(),
        'realtime': None,
        'minute_5': None,
        'minute_15': None,
        'minute_30': None,
        'timeline': None,
        'daily': None,
        'sector_info': None,  # 板块/行业信息
        'money_flow': None,   # 资金流向
        'fundamental': None,  # 基本面数据
        'industry_comparison': None,  # 行业对比数据
    }
    
    print(f"[API] 获取 {code} 实时行情...")
    result['realtime'] = get_realtime_data(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 5分钟K线...")
    result['minute_5'] = get_minute_kline(code, scale=5, datalen=240)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 15分钟K线...")
    result['minute_15'] = get_minute_kline(code, scale=15, datalen=160)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 30分钟K线...")
    result['minute_30'] = get_minute_kline(code, scale=30, datalen=80)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 分时数据...")
    result['timeline'] = get_timeline_data(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 日K线...")
    result['daily'] = get_daily_kline(code, count=240)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 板块/行业信息...")
    result['sector_info'] = get_sector_info(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 资金流向...")
    result['money_flow'] = get_money_flow(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 基本面数据...")
    result['fundamental'] = get_fundamental_data(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 行业对比数据...")
    result['industry_comparison'] = get_industry_comparison(code, sector_info=result.get('sector_info'))
    
    # 计算换手率：换手率 = (成交量 / 流通股本) * 100%
    # 成交量单位：股（新浪API的fields[8]返回的是股数，不是手数）
    # 流通股本单位：亿股
    if result['realtime'] and result['fundamental']:
        volume = result['realtime'].get('volume')  # 成交量（股）
        circulating_shares = result['fundamental'].get('circulating_shares')  # 流通股本（亿股）
        
        if volume and circulating_shares and circulating_shares > 0:
            # 换手率 = 成交量（股） / (流通股本亿股 * 100000000股/亿股) * 100%
            # = volume / (circulating_shares * 100000000) * 100
            turnover_rate = volume / (circulating_shares * 100000000) * 100
            result['realtime']['turnover_rate'] = turnover_rate
            print(f"[API] 计算换手率: {turnover_rate:.2f}% (成交量={volume}股, 流通股本={circulating_shares}亿股)")
    
    return result


def get_comprehensive_data_with_indicators(code):
    """获取股票的综合数据（包含技术指标）"""
    result = {
        'code': code,
        'timestamp': datetime.now().isoformat(),
        'realtime': None,
        'minute_5': None,
        'minute_15': None,
        'minute_30': None,
        'timeline': None,
        'daily': None,
        'indicators': None,  # 技术指标摘要
        'sector_info': None,  # 板块/行业信息
        'money_flow': None,   # 资金流向
        'fundamental': None,  # 基本面数据
        'industry_comparison': None,  # 行业对比数据
    }
    
    print(f"[API] 获取 {code} 实时行情...")
    result['realtime'] = get_realtime_data(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 5分钟K线...")
    result['minute_5'] = get_minute_kline(code, scale=5, datalen=240)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 15分钟K线...")
    result['minute_15'] = get_minute_kline(code, scale=15, datalen=160)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 30分钟K线...")
    result['minute_30'] = get_minute_kline(code, scale=30, datalen=80)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 分时数据...")
    result['timeline'] = get_timeline_data(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 日K线...")
    daily_df = get_daily_kline(code, count=240)
    if daily_df is not None and len(daily_df) > 0:
        print(f"[API] 计算 {code} 技术指标...")
        daily_df = calculate_indicators(daily_df)
        result['daily'] = daily_df
        
        # 提取最新技术指标摘要
        if len(daily_df) > 0:
            latest = daily_df.iloc[-1]
            indicators_summary = {}
            
            ma_cols = [col for col in daily_df.columns if col.startswith('MA') and not col.startswith('MACD')]
            if ma_cols:
                indicators_summary['MA'] = {col: float(latest[col]) for col in ma_cols if pd.notna(latest[col])}
            
            ema_cols = [col for col in daily_df.columns if col.startswith('EMA')]
            if ema_cols:
                indicators_summary['EMA'] = {col: float(latest[col]) for col in ema_cols if pd.notna(latest[col])}
            
            if 'MACD_DIF' in daily_df.columns and pd.notna(latest['MACD_DIF']):
                indicators_summary['MACD'] = {
                    'DIF': float(latest['MACD_DIF']),
                    'DEA': float(latest.get('MACD_DEA', 0)) if pd.notna(latest.get('MACD_DEA')) else 0,
                    'MACD': float(latest.get('MACD', 0)) if pd.notna(latest.get('MACD')) else 0
                }
            
            if 'RSI14' in daily_df.columns and pd.notna(latest['RSI14']):
                indicators_summary['RSI'] = float(latest['RSI14'])
            
            if 'KDJ_K' in daily_df.columns and pd.notna(latest['KDJ_K']):
                indicators_summary['KDJ'] = {
                    'K': float(latest['KDJ_K']),
                    'D': float(latest.get('KDJ_D', 0)) if pd.notna(latest.get('KDJ_D')) else 0,
                    'J': float(latest.get('KDJ_J', 0)) if pd.notna(latest.get('KDJ_J')) else 0
                }
            
            if 'BOLL_UPPER' in daily_df.columns and pd.notna(latest['BOLL_UPPER']):
                indicators_summary['BOLL'] = {
                    'upper': float(latest['BOLL_UPPER']),
                    'mid': float(latest.get('BOLL_MID', 0)) if pd.notna(latest.get('BOLL_MID')) else 0,
                    'lower': float(latest.get('BOLL_LOWER', 0)) if pd.notna(latest.get('BOLL_LOWER')) else 0
                }
            
            if 'OBV' in daily_df.columns and pd.notna(latest['OBV']):
                indicators_summary['OBV'] = float(latest['OBV'])
            
            result['indicators'] = indicators_summary
    else:
        result['daily'] = None
    
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 板块/行业信息...")
    result['sector_info'] = get_sector_info(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 资金流向...")
    result['money_flow'] = get_money_flow(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 基本面数据...")
    result['fundamental'] = get_fundamental_data(code)
    time.sleep(0.1)
    
    print(f"[API] 获取 {code} 行业对比数据...")
    result['industry_comparison'] = get_industry_comparison(code, sector_info=result.get('sector_info'))
    
    # 计算换手率：换手率 = (成交量 / 流通股本) * 100%
    # 成交量单位：股（新浪API的fields[8]返回的是股数，不是手数）
    # 流通股本单位：亿股
    if result['realtime'] and result['fundamental']:
        volume = result['realtime'].get('volume')  # 成交量（股）
        circulating_shares = result['fundamental'].get('circulating_shares')  # 流通股本（亿股）
        
        if volume and circulating_shares and circulating_shares > 0:
            # 换手率 = 成交量（股） / (流通股本亿股 * 100000000股/亿股) * 100%
            # = volume / (circulating_shares * 100000000) * 100
            turnover_rate = volume / (circulating_shares * 100000000) * 100
            result['realtime']['turnover_rate'] = turnover_rate
            print(f"[API] 计算换手率: {turnover_rate:.2f}% (成交量={volume}股, 流通股本={circulating_shares}亿股)")
    
    return result


# ==================== 市场情绪指数计算 ====================

def calculate_market_sentiment(
    df_daily_stats: pd.DataFrame, 
    window: int = 20, 
    ema_span: int = 3,
    custom_weights: dict = None
) -> pd.DataFrame:
    """
    计算每日市场短线情绪得分及阶段状态 (0 - 100 分)
    
    :param df_daily_stats: 包含历史每日市场统计数据的 DataFrame
           期望列: ['limit_up_count', 'limit_down_count', 'broken_limit_count', 
                   'next_day_limit_up_premium', 'two_to_three_rate', 'up_down_ratio']
    :param window: 滚动归一化窗口天数，默认 20 日
    :param ema_span: 情绪指数指数平滑天数，降低日内噪点，默认 3 日
    :param custom_weights: 自定义因子权重字典
    :return: 增加 'sentiment_score', 'sentiment_smooth', 'sentiment_level', 'level_color' 等列的 DataFrame
    """
    if df_daily_stats is None or df_daily_stats.empty:
        return df_daily_stats

    df = df_daily_stats.copy()

    # 1. 动态基础因子构建与容错补充
    # 封板成功率 (0 ~ 1)
    if 'limit_up_count' in df.columns and 'broken_limit_count' in df.columns:
        total_limit = df['limit_up_count'] + df['broken_limit_count']
        df['seal_rate'] = np.where(total_limit > 0, df['limit_up_count'] / (total_limit + 1e-5), 0.5)
    else:
        df['seal_rate'] = 0.5

    # 净涨停差值 (涨停 - 跌停)
    if 'limit_up_count' in df.columns and 'limit_down_count' in df.columns:
        df['net_limit'] = df['limit_up_count'] - df['limit_down_count']
    else:
        df['net_limit'] = 0

    # 默认标准因子库与其基础经验区间(用于无足够历史数据时的降级绝对归一化)
    feature_config = {
        'seal_rate': {'weight': 0.25, 'abs_min': 0.3, 'abs_max': 0.9},
        'net_limit': {'weight': 0.20, 'abs_min': -50, 'abs_max': 100},
        'next_day_limit_up_premium': {'weight': 0.25, 'abs_min': -2.0, 'abs_max': 5.0},  # 单位 %
        'two_to_three_rate': {'weight': 0.15, 'abs_min': 0.0, 'abs_max': 0.8},
        'up_down_ratio': {'weight': 0.15, 'abs_min': 0.3, 'abs_max': 3.0}
    }

    # 合并用户自定义权重
    if custom_weights:
        for k, v in custom_weights.items():
            if k in feature_config:
                feature_config[k]['weight'] = v

    # 过滤数据框中实际存在的因子，并重新归一化权重
    available_features = [col for col in feature_config.keys() if col in df.columns]
    if not available_features:
        # 如果任何明确特征都不存在，设基础得分
        df['sentiment_score'] = 50.0
        df['sentiment_smooth'] = 50.0
        df['sentiment_level'] = '震荡/中性'
        df['level_color'] = '#1890FF'
        return df

    total_weight = sum(feature_config[f]['weight'] for f in available_features)
    
    # 2. 安全的动态 Min-Max 归一化 (防除零、防突变)
    norm_df = pd.DataFrame(index=df.index)
    
    for col in available_features:
        weight = feature_config[col]['weight'] / total_weight
        series = df[col].astype(float).fillna(0.0)

        if len(df) >= 5:  # 历史天数足够，使用动态 Rolling Min-Max
            roll_min = series.rolling(window, min_periods=3).min()
            roll_max = series.rolling(window, min_periods=3).max()
            diff = roll_max - roll_min
            # 防除零处理：如果 roll_max == roll_min，使用经验绝对区间做降级
            safe_diff = np.where(diff < 1e-5, feature_config[col]['abs_max'] - feature_config[col]['abs_min'], diff)
            safe_min = np.where(diff < 1e-5, feature_config[col]['abs_min'], roll_min)
            
            norm_val = (series - safe_min) / safe_diff * 100
        else:  # 历史天数不足，使用绝对经验区间
            abs_min = feature_config[col]['abs_min']
            abs_max = feature_config[col]['abs_max']
            norm_val = (series - abs_min) / (abs_max - abs_min) * 100

        # 裁剪在 0 ~ 100 之间
        norm_df[col] = norm_val.clip(0, 100) * weight

    # 3. 综合得分计算与 EMA 平滑
    raw_score = norm_df.sum(axis=1)
    df['sentiment_score'] = raw_score.round(2)
    
    # 指数平滑降低日内噪点
    df['sentiment_smooth'] = df['sentiment_score'].ewm(span=ema_span, adjust=False).mean().round(2)

    # 4. 情绪阶段状态分类映射 (适合前端渲染与 AI Agent 决策)
    def map_sentiment_level(score):
        if score >= 80:
            return '超强高潮', '#FF4D4F'  # 红色 (极度贪婪/注意见顶风险)
        elif score >= 60:
            return '升温/强情绪', '#FA8C16'  # 橙色 (赚钱效应良好/积极参与)
        elif score >= 40:
            return '震荡/中性', '#1890FF'   # 蓝色 (多空平衡/注重个股)
        elif score >= 20:
            return '分歧/弱情绪', '#52C41A'  # 绿色 (亏损效应显现/控制仓位)
        else:
            return '冰点恐慌', '#722ED1'   # 紫色 (极度恐慌/寻找左侧拐点)

    levels_and_colors = [map_sentiment_level(s) for s in df['sentiment_smooth']]
    df['sentiment_level'] = [item[0] for item in levels_and_colors]
    df['level_color'] = [item[1] for item in levels_and_colors]

    return df


def get_latest_sentiment_summary(df_with_sentiment: pd.DataFrame) -> dict:
    """
    提取最新一天的情绪摘要信息（便于 API 接口直接返回给前端展示或 AI Agent 评判）
    """
    if df_with_sentiment is None or df_with_sentiment.empty:
        return {
            "sentiment_score": 50.0,
            "sentiment_smooth": 50.0,
            "level": "震荡/中性",
            "level_color": "#1890FF",
            "metrics": {}
        }

    latest = df_with_sentiment.iloc[-1]
    date_val = str(latest.name) if not isinstance(latest.name, int) else latest.get('date', '')
    
    return {
        "date": str(date_val),
        "sentiment_score": float(latest.get('sentiment_score', 50.0)),
        "sentiment_smooth": float(latest.get('sentiment_smooth', 50.0)),
        "level": str(latest.get('sentiment_level', '震荡/中性')),
        "level_color": str(latest.get('level_color', '#1890FF')),
        "metrics": {
            "seal_rate": round(float(latest.get('seal_rate', 0.5)) * 100, 2),
            "net_limit": int(latest.get('net_limit', 0)),
            "limit_up_count": int(latest.get('limit_up_count', 0)) if pd.notna(latest.get('limit_up_count')) else 0,
            "limit_down_count": int(latest.get('limit_down_count', 0)) if pd.notna(latest.get('limit_down_count')) else 0,
            "next_day_premium": float(latest.get('next_day_limit_up_premium', 0.0)) if pd.notna(latest.get('next_day_limit_up_premium')) else 0.0,
            "two_to_three_rate": float(latest.get('two_to_three_rate', 0.0)) if pd.notna(latest.get('two_to_three_rate')) else 0.0,
            "up_down_ratio": float(latest.get('up_down_ratio', 1.0)) if pd.notna(latest.get('up_down_ratio')) else 1.0
        }
    }