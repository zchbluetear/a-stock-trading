#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""数据库模型定义"""

from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()

class Watchlist(Base):
    """自选股表"""
    __tablename__ = 'watchlist'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(6), unique=True, nullable=False, index=True)
    name = Column(String(50))
    added_at = Column(DateTime, default=datetime.now)
    sort_order = Column(Integer, default=0)

class Config(Base):
    """配置表"""
    __tablename__ = 'config'
    
    key = Column(String(50), primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class Agent(Base):
    """Agent配置表"""
    __tablename__ = 'agents'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    type = Column(String(20), nullable=False)  # 'default', 'intraday_t', 'review'
    prompt = Column(Text)
    enabled = Column(Boolean, default=True)
    ai_provider = Column(String(20))  # 'openai', 'deepseek', 'qwen', 'gemini', 'grok'
    model = Column(String(50))
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

class AnalysisCache(Base):
    """分析结果缓存表"""
    __tablename__ = 'analysis_cache'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(6), nullable=False, index=True)
    analysis_type = Column(String(20), nullable=False)  # 'intraday_t', 'review', 'comprehensive'
    data = Column(Text)  # JSON格式
    created_at = Column(DateTime, default=datetime.now)
    
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )

class DebateJob(Base):
    """多Agent辩论任务表"""
    __tablename__ = 'debate_jobs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(64), unique=True, nullable=False, index=True)
    code = Column(String(6), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    status = Column(String(20), default='queued')  # queued/running/completed/failed/canceled
    progress = Column(Integer, default=0)
    agent_ids = Column(Text)  # JSON
    steps = Column(Text)  # JSON
    report_md = Column(Text)
    error = Column(Text)
    canceled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class TradingLog(Base):
    """交易日志表"""
    __tablename__ = 'trading_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(6), nullable=False, index=True)
    name = Column(String(50))
    buy_time = Column(DateTime, nullable=False)
    buy_price = Column(Float, nullable=False)
    buy_quantity = Column(Integer, nullable=False)       # 买入数量（股）
    buy_logic = Column(Text)                             # 买入逻辑
    sell_time = Column(DateTime)                         # 卖出时间（空=未卖出）
    sell_price = Column(Float)                           # 卖出价格
    sell_quantity = Column(Integer)                      # 卖出数量
    sell_logic = Column(Text)                            # 卖出逻辑
    status = Column(String(10), default='open')          # open=持仓中, closed=已清仓
    total_fee = Column(Float, default=0)                 # 累计手续费
    holding_quantity = Column(Integer, default=0)        # 当前持仓数量（分批买卖动态计算）
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class TradeAction(Base):
    """交易动作明细表（支持分批买卖）"""
    __tablename__ = 'trade_actions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    log_id = Column(Integer, ForeignKey('trading_logs.id'), nullable=False, index=True)
    action_type = Column(String(4), nullable=False)   # 'buy' / 'sell'
    action_time = Column(DateTime, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    fee = Column(Float, default=0)                     # 本次操作手续费
    fee_detail = Column(Text)                          # JSON: {commission, stamp_duty, transfer_fee}
    logic = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

class TradeTag(Base):
    """交易标签表"""
    __tablename__ = 'trade_tags'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(20), unique=True, nullable=False)
    color = Column(String(7), default='#6366f1')       # HEX 颜色
    created_at = Column(DateTime, default=datetime.now)

class TradingLogTag(Base):
    """交易日志-标签关联表（多对多）"""
    __tablename__ = 'trading_log_tags'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    log_id = Column(Integer, ForeignKey('trading_logs.id'), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey('trade_tags.id'), nullable=False, index=True)

class VolumePrediction(Base):
    """每日成交量预测表（9:45 计算，15分钟成交量 * 5）"""
    __tablename__ = 'volume_prediction'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    code = Column(String(6), nullable=False, index=True)
    name = Column(String(50))
    vol_15min = Column(Float, default=0)          # 9:30-9:45 的 15 分钟成交量（单位：股）
    predicted_vol = Column(Float, default=0)      # 预测全天成交量 = vol_15min * 5（单位：股）
    today_actual_vol = Column(Float, default=0)   # 今日实时成交量（每次计算时从实时行情读取，单位：股）
    avg_5d_vol = Column(Float, default=0)         # 过去 5 个交易日平均成交量（单位：股）
    change_pct = Column(Float, default=0)         # 预测 vs 5 日均量增减幅 (%, 可正可负)
    calculated_at = Column(DateTime, default=datetime.now)
    
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )

# 数据库初始化
DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
engine = create_engine(f'sqlite:///{DB_PATH}', echo=False)
Base.metadata.create_all(engine)

# SQLite 不会自动为已有表添加新列，需要手动迁移
def _migrate_add_columns():
    """为已有表添加新增列（如果不存在）"""
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # 检查 trading_logs 表是否有 total_fee 列
    cursor.execute("PRAGMA table_info(trading_logs)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'total_fee' not in columns:
        cursor.execute("ALTER TABLE trading_logs ADD COLUMN total_fee FLOAT DEFAULT 0")
    if 'holding_quantity' not in columns:
        cursor.execute("ALTER TABLE trading_logs ADD COLUMN holding_quantity INTEGER DEFAULT 0")
    conn.commit()
    conn.close()

_migrate_add_columns()
SessionLocal = sessionmaker(bind=engine)

def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

