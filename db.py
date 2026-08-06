#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""数据库操作函数"""

from models import SessionLocal, Watchlist, Config, Agent, AnalysisCache, DebateJob, VolumePrediction
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json

# ==================== 自选股操作 ====================

def get_watchlist(db: Session):
    """获取所有自选股"""
    return db.query(Watchlist).order_by(Watchlist.sort_order, Watchlist.added_at).all()

def add_to_watchlist(db: Session, code: str, name: str = None):
    """添加自选股"""
    existing = db.query(Watchlist).filter(Watchlist.code == code).first()
    if existing:
        return existing
    
    watchlist_item = Watchlist(code=code, name=name)
    db.add(watchlist_item)
    db.commit()
    db.refresh(watchlist_item)
    return watchlist_item

def remove_from_watchlist(db: Session, code: str):
    """移除自选股"""
    item = db.query(Watchlist).filter(Watchlist.code == code).first()
    if item:
        db.delete(item)
        db.commit()
        return True
    return False

def update_watchlist_order(db: Session, orders: list):
    """更新自选股排序"""
    for code, sort_order in orders:
        item = db.query(Watchlist).filter(Watchlist.code == code).first()
        if item:
            item.sort_order = sort_order
    db.commit()

# ==================== 配置操作 ====================

def get_config(db: Session, key: str, default=None):
    """获取配置"""
    config = db.query(Config).filter(Config.key == key).first()
    return config.value if config else default

def set_config(db: Session, key: str, value: str):
    """设置配置"""
    config = db.query(Config).filter(Config.key == key).first()
    if config:
        config.value = value
        config.updated_at = datetime.now()
    else:
        config = Config(key=key, value=value)
        db.add(config)
    db.commit()
    return config

def get_all_configs(db: Session):
    """获取所有配置"""
    configs = db.query(Config).all()
    return {c.key: c.value for c in configs}

# ==================== Agent操作 ====================

def get_agents(db: Session, enabled_only: bool = False):
    """获取所有Agent"""
    query = db.query(Agent)
    if enabled_only:
        query = query.filter(Agent.enabled == True)
    return query.order_by(Agent.sort_order, Agent.created_at).all()

def get_agent(db: Session, agent_id: int):
    """获取单个Agent"""
    return db.query(Agent).filter(Agent.id == agent_id).first()

def create_agent(db: Session, name: str, type: str, prompt: str, 
                 ai_provider: str = None, model: str = None, enabled: bool = True, sort_order: int = 0):
    """创建Agent"""
    agent = Agent(
        name=name,
        type=type,
        prompt=prompt,
        ai_provider=ai_provider,
        model=model,
        enabled=enabled,
        sort_order=sort_order
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent

def update_agent(db: Session, agent_id: int, **kwargs):
    """更新Agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        return None
    
    for key, value in kwargs.items():
        if hasattr(agent, key):
            setattr(agent, key, value)
    
    db.commit()
    db.refresh(agent)
    return agent

def delete_agent(db: Session, agent_id: int):
    """删除Agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if agent:
        db.delete(agent)
        db.commit()
        return True
    return False

# ==================== 缓存操作 ====================

def get_cached_analysis(db: Session, code: str, analysis_type: str, max_age_minutes: int = 30):
    """获取缓存的分析结果"""
    cache = db.query(AnalysisCache).filter(
        AnalysisCache.code == code,
        AnalysisCache.analysis_type == analysis_type
    ).first()
    
    if cache:
        age = datetime.now() - cache.created_at
        if age < timedelta(minutes=max_age_minutes):
            return json.loads(cache.data)
    
    return None

def save_analysis_cache(db: Session, code: str, analysis_type: str, data: dict):
    """保存分析结果到缓存"""
    # 删除旧缓存
    db.query(AnalysisCache).filter(
        AnalysisCache.code == code,
        AnalysisCache.analysis_type == analysis_type
    ).delete()
    
    # 添加新缓存
    cache = AnalysisCache(
        code=code,
        analysis_type=analysis_type,
        data=json.dumps(data, ensure_ascii=False)
    )
    db.add(cache)
    db.commit()

# ==================== 辩论任务操作 ====================

def create_debate_job(db: Session, job_id: str, code: str, name: str, agent_ids: list,
                     analysis_rounds: int, debate_rounds: int, meta: dict = None):
    """创建辩论任务"""
    payload = {
        'agent_ids': agent_ids,
        'analysis_rounds': analysis_rounds,
        'debate_rounds': debate_rounds,
        'meta': meta or {}
    }
    job = DebateJob(
        job_id=job_id,
        code=code,
        name=name,
        status='queued',
        progress=0,
        agent_ids=json.dumps(payload, ensure_ascii=False),
        steps=json.dumps([], ensure_ascii=False),
        report_md='',
        error=None,
        canceled=False
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

def update_debate_job(db: Session, job_id: str, **kwargs):
    """更新辩论任务"""
    job = db.query(DebateJob).filter(DebateJob.job_id == job_id).first()
    if not job:
        return None
    for key, value in kwargs.items():
        if hasattr(job, key):
            setattr(job, key, value)
    job.updated_at = datetime.now()
    db.commit()
    db.refresh(job)
    return job

def get_debate_job(db: Session, job_id: str):
    """获取辩论任务"""
    return db.query(DebateJob).filter(DebateJob.job_id == job_id).first()

def list_debate_jobs(db: Session, status: str = None, limit: int = 50):
    """列出辩论任务"""
    query = db.query(DebateJob)
    if status == 'active':
        query = query.filter(DebateJob.status.in_(['queued', 'running']))
    elif status:
        query = query.filter(DebateJob.status == status)
    return query.order_by(DebateJob.updated_at.desc()).limit(limit).all()

def cancel_debate_job(db: Session, job_id: str):
    """终止辩论任务"""
    job = db.query(DebateJob).filter(DebateJob.job_id == job_id).first()
    if not job:
        return None
    job.canceled = True
    if job.status in ['queued', 'running']:
        job.status = 'canceled'
    job.updated_at = datetime.now()
    db.commit()
    db.refresh(job)
    return job

def delete_debate_job(db: Session, job_id: str):
    """删除辩论任务"""
    job = db.query(DebateJob).filter(DebateJob.job_id == job_id).first()
    if not job:
        return False
    db.delete(job)
    db.commit()
    return True

# ==================== 成交量预测操作 ====================

def upsert_volume_prediction(db: Session, date: str, code: str, name: str,
                              vol_15min: float, predicted_vol: float,
                              today_actual_vol: float,
                              avg_5d_vol: float, change_pct: float):
    """写入或更新当天某股票的成交量预测数据"""
    existing = db.query(VolumePrediction).filter(
        VolumePrediction.date == date,
        VolumePrediction.code == code
    ).first()
    
    if existing:
        existing.name = name
        existing.vol_15min = vol_15min
        existing.predicted_vol = predicted_vol
        existing.today_actual_vol = today_actual_vol
        existing.avg_5d_vol = avg_5d_vol
        existing.change_pct = change_pct
        existing.calculated_at = datetime.now()
        db.commit()
        db.refresh(existing)
        return existing
    
    item = VolumePrediction(
        date=date, code=code, name=name,
        vol_15min=vol_15min, predicted_vol=predicted_vol,
        today_actual_vol=today_actual_vol,
        avg_5d_vol=avg_5d_vol, change_pct=change_pct
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

def get_volume_predictions_by_date(db: Session, date: str):
    """按日期获取所有成交量预测记录"""
    return db.query(VolumePrediction).filter(VolumePrediction.date == date).all()

def get_volume_predictions_dict(db: Session, date: str):
    """按日期获取成交量预测数据，返回 dict: code -> record_obj"""
    records = get_volume_predictions_by_date(db, date)
    result = {}
    for r in records:
        result[r.code] = r
    return result

