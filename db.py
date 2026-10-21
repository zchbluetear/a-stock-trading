#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""数据库操作函数"""

from models import SessionLocal, Watchlist, Config, Agent, AnalysisCache, DebateJob, VolumePrediction, TradingLog, TradeAction, TradeTag, TradingLogTag
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from utils import calculate_trading_fee

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

# ==================== 交易日志操作 ====================

def create_trading_log(db: Session, code: str, name: str, buy_time: datetime,
                       buy_price: float, buy_quantity: int, buy_logic: str = None):
    """创建交易记录（买入），同时生成对应的 TradeAction"""
    log = TradingLog(
        code=code, name=name, buy_time=buy_time,
        buy_price=buy_price, buy_quantity=buy_quantity,
        buy_logic=buy_logic, status='open',
        total_fee=0, holding_quantity=buy_quantity
    )
    db.add(log)
    db.flush()  # 获取 log.id
    
    # 计算手续费
    fee_info = calculate_trading_fee(buy_price, buy_quantity, 'buy')
    
    # 创建买入动作
    action = TradeAction(
        log_id=log.id,
        action_type='buy',
        action_time=buy_time,
        price=buy_price,
        quantity=buy_quantity,
        fee=fee_info['total'],
        fee_detail=json.dumps(fee_info, ensure_ascii=False),
        logic=buy_logic
    )
    db.add(action)
    
    # 更新累计手续费
    log.total_fee = fee_info['total']
    
    db.commit()
    db.refresh(log)
    return log

def get_trading_logs(db: Session, status: str = None, code: str = None,
                     date_from: str = None, date_to: str = None,
                     tag_id: int = None,
                     page: int = 1, per_page: int = 50):
    """分页查询交易日志"""
    query = db.query(TradingLog)
    if status:
        query = query.filter(TradingLog.status == status)
    if code:
        # 同时支持股票代码和股票名称的模糊搜索
        from sqlalchemy import or_
        query = query.filter(
            or_(
                TradingLog.code.contains(code),
                TradingLog.name.contains(code)
            )
        )
    if date_from:
        query = query.filter(TradingLog.buy_time >= datetime.strptime(date_from, '%Y-%m-%d'))
    if date_to:
        dt_to = datetime.strptime(date_to, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
        query = query.filter(TradingLog.buy_time <= dt_to)
    if tag_id:
        log_ids = [lt.log_id for lt in db.query(TradingLogTag).filter(TradingLogTag.tag_id == tag_id).all()]
        if log_ids:
            query = query.filter(TradingLog.id.in_(log_ids))
        else:
            return [], 0
    total = query.count()
    items = query.order_by(TradingLog.updated_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return items, total

def get_trading_log(db: Session, log_id: int):
    """获取单条交易记录"""
    return db.query(TradingLog).filter(TradingLog.id == log_id).first()

def update_trading_log(db: Session, log_id: int, **kwargs):
    """更新交易记录（卖出时自动计算盈亏并更新状态）"""
    log = db.query(TradingLog).filter(TradingLog.id == log_id).first()
    if not log:
        return None
    for key, value in kwargs.items():
        if hasattr(log, key):
            setattr(log, key, value)
    # 如果填入了卖出信息，自动计算盈亏并更新状态
    if log.sell_price is not None and log.sell_quantity is not None:
        log.status = 'closed'
    log.updated_at = datetime.now()
    db.commit()
    db.refresh(log)
    return log

def delete_trading_log(db: Session, log_id: int):
    """删除交易记录（同时删除关联的 actions 和 tags）"""
    log = db.query(TradingLog).filter(TradingLog.id == log_id).first()
    if log:
        db.query(TradeAction).filter(TradeAction.log_id == log_id).delete()
        db.query(TradingLogTag).filter(TradingLogTag.log_id == log_id).delete()
        db.delete(log)
        db.commit()
        return True
    return False

# ==================== 交易动作操作 ====================

def create_trade_action(db: Session, log_id: int, action_type: str,
                        action_time: datetime, price: float, quantity: int,
                        logic: str = None):
    """新增交易动作，自动更新 TradingLog 汇总字段"""
    log = db.query(TradingLog).filter(TradingLog.id == log_id).first()
    if not log:
        return None, '交易记录不存在'
    
    # 卖出校验：不得超过当前持仓量
    if action_type == 'sell':
        current_holding = log.holding_quantity if log.holding_quantity is not None else log.buy_quantity
        if quantity > current_holding:
            return None, f'卖出数量({quantity})超过当前持仓({current_holding})'
    
    # 计算手续费
    fee_info = calculate_trading_fee(price, quantity, action_type)
    
    action = TradeAction(
        log_id=log_id,
        action_type=action_type,
        action_time=action_time,
        price=price,
        quantity=quantity,
        fee=fee_info['total'],
        fee_detail=json.dumps(fee_info, ensure_ascii=False),
        logic=logic
    )
    db.add(action)
    db.flush()
    
    # 重算汇总
    recalculate_log_summary(db, log_id)
    
    db.commit()
    db.refresh(action)
    return action, None

def get_trade_actions(db: Session, log_id: int):
    """获取某笔交易的所有动作"""
    return db.query(TradeAction).filter(
        TradeAction.log_id == log_id
    ).order_by(TradeAction.action_time).all()

def delete_trade_action(db: Session, action_id: int):
    """删除交易动作并重算汇总"""
    action = db.query(TradeAction).filter(TradeAction.id == action_id).first()
    if not action:
        return False
    log_id = action.log_id
    db.delete(action)
    db.flush()
    
    # 检查是否还有动作
    remaining = db.query(TradeAction).filter(TradeAction.log_id == log_id).count()
    if remaining == 0:
        # 如果没有动作了，也删除主记录
        log = db.query(TradingLog).filter(TradingLog.id == log_id).first()
        if log:
            db.query(TradingLogTag).filter(TradingLogTag.log_id == log_id).delete()
            db.delete(log)
    else:
        recalculate_log_summary(db, log_id)
    
    db.commit()
    return True

def recalculate_log_summary(db: Session, log_id: int):
    """根据所有 actions 重算 TradingLog 的汇总字段"""
    log = db.query(TradingLog).filter(TradingLog.id == log_id).first()
    if not log:
        return
    
    actions = db.query(TradeAction).filter(
        TradeAction.log_id == log_id
    ).order_by(TradeAction.action_time).all()
    
    if not actions:
        return
    
    total_buy_qty = 0
    total_buy_amount = 0
    total_sell_qty = 0
    total_sell_amount = 0
    total_fee = 0
    first_buy_time = None
    last_sell_time = None
    first_buy_logic = None
    last_sell_logic = None
    
    for a in actions:
        total_fee += (a.fee or 0)
        if a.action_type == 'buy':
            total_buy_qty += a.quantity
            total_buy_amount += a.price * a.quantity
            if first_buy_time is None or a.action_time < first_buy_time:
                first_buy_time = a.action_time
                first_buy_logic = a.logic
        elif a.action_type == 'sell':
            total_sell_qty += a.quantity
            total_sell_amount += a.price * a.quantity
            if last_sell_time is None or a.action_time > last_sell_time:
                last_sell_time = a.action_time
                last_sell_logic = a.logic
    
    holding_qty = total_buy_qty - total_sell_qty
    
    # 更新主记录汇总字段
    log.buy_time = first_buy_time
    log.buy_price = round(total_buy_amount / total_buy_qty, 4) if total_buy_qty > 0 else 0
    log.buy_quantity = total_buy_qty
    log.buy_logic = first_buy_logic
    
    if total_sell_qty > 0:
        log.sell_time = last_sell_time
        log.sell_price = round(total_sell_amount / total_sell_qty, 4) if total_sell_qty > 0 else None
        log.sell_quantity = total_sell_qty
        log.sell_logic = last_sell_logic
    else:
        log.sell_time = None
        log.sell_price = None
        log.sell_quantity = None
        log.sell_logic = None
    
    log.holding_quantity = holding_qty
    log.total_fee = round(total_fee, 2)
    log.status = 'closed' if holding_qty <= 0 else 'open'
    log.updated_at = datetime.now()

# ==================== 交易标签操作 ====================

def create_trade_tag(db: Session, name: str, color: str = '#6366f1'):
    """创建交易标签"""
    existing = db.query(TradeTag).filter(TradeTag.name == name).first()
    if existing:
        return existing, False
    tag = TradeTag(name=name, color=color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag, True

def get_trade_tags(db: Session):
    """获取所有标签"""
    return db.query(TradeTag).order_by(TradeTag.created_at).all()

def delete_trade_tag(db: Session, tag_id: int):
    """删除标签（同时删除关联）"""
    tag = db.query(TradeTag).filter(TradeTag.id == tag_id).first()
    if tag:
        db.query(TradingLogTag).filter(TradingLogTag.tag_id == tag_id).delete()
        db.delete(tag)
        db.commit()
        return True
    return False

def add_log_tag(db: Session, log_id: int, tag_id: int):
    """给交易记录添加标签"""
    existing = db.query(TradingLogTag).filter(
        TradingLogTag.log_id == log_id,
        TradingLogTag.tag_id == tag_id
    ).first()
    if existing:
        return existing
    lt = TradingLogTag(log_id=log_id, tag_id=tag_id)
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return lt

def remove_log_tag(db: Session, log_id: int, tag_id: int):
    """移除交易记录的标签"""
    lt = db.query(TradingLogTag).filter(
        TradingLogTag.log_id == log_id,
        TradingLogTag.tag_id == tag_id
    ).first()
    if lt:
        db.delete(lt)
        db.commit()
        return True
    return False

def get_log_tags(db: Session, log_id: int):
    """获取交易记录的所有标签"""
    tag_ids = [lt.tag_id for lt in db.query(TradingLogTag).filter(TradingLogTag.log_id == log_id).all()]
    if not tag_ids:
        return []
    return db.query(TradeTag).filter(TradeTag.id.in_(tag_ids)).all()

def get_trading_log_statistics(db: Session, date_from: str = None, date_to: str = None,
                                tag_id: int = None):
    """计算交易日志统计指标"""
    query = db.query(TradingLog)
    if date_from:
        query = query.filter(TradingLog.buy_time >= datetime.strptime(date_from, '%Y-%m-%d'))
    if date_to:
        dt_to = datetime.strptime(date_to, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
        query = query.filter(TradingLog.buy_time <= dt_to)
    if tag_id:
        log_ids = [lt.log_id for lt in db.query(TradingLogTag).filter(TradingLogTag.tag_id == tag_id).all()]
        if log_ids:
            query = query.filter(TradingLog.id.in_(log_ids))
        else:
            return _empty_stats()
    
    logs = query.all()
    
    if not logs:
        return _empty_stats()
    
    total_trades = len(logs)
    open_trades = sum(1 for l in logs if l.status == 'open')
    closed_trades = sum(1 for l in logs if l.status == 'closed')
    total_fee = sum(l.total_fee or 0 for l in logs)
    
    # 已清仓的盈亏统计
    profits = []
    holding_days_list = []
    for l in logs:
        if l.status == 'closed' and l.sell_price is not None and l.sell_quantity is not None:
            gross = round((l.sell_price - l.buy_price) * l.sell_quantity, 2)
            net = round(gross - (l.total_fee or 0), 2)
            profits.append({'gross': gross, 'net': net, 'name': l.name or l.code})
            if l.buy_time and l.sell_time:
                days = (l.sell_time - l.buy_time).days
                holding_days_list.append(max(days, 0))
    
    total_profit = round(sum(p['gross'] for p in profits), 2)
    net_profit = round(sum(p['net'] for p in profits), 2)
    
    win_trades = [p for p in profits if p['net'] > 0]
    loss_trades = [p for p in profits if p['net'] < 0]
    even_trades = [p for p in profits if p['net'] == 0]
    
    win_count = len(win_trades)
    loss_count = len(loss_trades)
    
    win_rate = round(win_count / len(profits) * 100, 1) if profits else 0
    
    avg_profit = round(sum(p['net'] for p in win_trades) / win_count, 2) if win_count > 0 else 0
    avg_loss = round(sum(p['net'] for p in loss_trades) / loss_count, 2) if loss_count > 0 else 0
    
    profit_loss_ratio = round(abs(avg_profit / avg_loss), 2) if avg_loss != 0 else 0
    
    max_profit_item = max(win_trades, key=lambda p: p['net']) if win_trades else None
    max_loss_item = min(loss_trades, key=lambda p: p['net']) if loss_trades else None
    
    avg_holding_days = round(sum(holding_days_list) / len(holding_days_list), 1) if holding_days_list else 0
    
    return {
        'total_trades': total_trades,
        'open_trades': open_trades,
        'closed_trades': closed_trades,
        'total_profit': total_profit,
        'total_fee': round(total_fee, 2),
        'net_profit': net_profit,
        'win_count': win_count,
        'loss_count': loss_count,
        'win_rate': win_rate,
        'avg_profit': avg_profit,
        'avg_loss': avg_loss,
        'profit_loss_ratio': profit_loss_ratio,
        'max_single_profit': max_profit_item['net'] if max_profit_item else 0,
        'max_single_profit_name': max_profit_item['name'] if max_profit_item else '',
        'max_single_loss': max_loss_item['net'] if max_loss_item else 0,
        'max_single_loss_name': max_loss_item['name'] if max_loss_item else '',
        'avg_holding_days': avg_holding_days
    }

def _empty_stats():
    """返回空统计数据"""
    return {
        'total_trades': 0, 'open_trades': 0, 'closed_trades': 0,
        'total_profit': 0, 'total_fee': 0, 'net_profit': 0,
        'win_count': 0, 'loss_count': 0, 'win_rate': 0,
        'avg_profit': 0, 'avg_loss': 0, 'profit_loss_ratio': 0,
        'max_single_profit': 0, 'max_single_profit_name': '',
        'max_single_loss': 0, 'max_single_loss_name': '',
        'avg_holding_days': 0
    }

