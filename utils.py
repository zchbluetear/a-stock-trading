#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
工具函数模块
"""


def calculate_trading_fee(price, quantity, direction,
                          commission_rate=0.00025,
                          min_commission=5.0,
                          stamp_duty_rate=0.0005,
                          transfer_fee_rate=0.00001):
    """
    计算A股交易手续费
    
    Args:
        price: 交易价格
        quantity: 交易数量（股）
        direction: 'buy' 或 'sell'
        commission_rate: 佣金费率，默认万 2.5
        min_commission: 最低佣金，默认 5 元
        stamp_duty_rate: 印花税费率，千 0.5（仅卖出）
        transfer_fee_rate: 过户费率，万 0.1
    
    Returns:
        dict: {commission, stamp_duty, transfer_fee, total}
    """
    amount = price * quantity
    
    # 佣金：买卖都收，最低 5 元
    commission = max(amount * commission_rate, min_commission)
    commission = round(commission, 2)
    
    # 印花税：仅卖出时收取
    stamp_duty = round(amount * stamp_duty_rate, 2) if direction == 'sell' else 0
    
    # 过户费：买卖都收
    transfer_fee = round(amount * transfer_fee_rate, 2)
    
    total = round(commission + stamp_duty + transfer_fee, 2)
    
    return {
        'commission': commission,
        'stamp_duty': stamp_duty,
        'transfer_fee': transfer_fee,
        'total': total
    }


def get_stock_code_format(code):
    """转换股票代码格式（用于新浪API）"""
    code_str = str(code).strip()
    
    # 如果已经是sh/sz格式，直接返回
    if code_str.startswith(('sh', 'sz')):
        return code_str
    
    # 处理指数代码
    if code_str == '1A0001' or code_str == '000001':
        # 上证指数使用 sh000001
        return 'sh000001'
    elif code_str.startswith('1A'):
        # 其他指数代码，去掉1A前缀
        return f"sh{code_str[2:]}"
    elif code_str.startswith('6'):
        return f"sh{code_str}"
    elif code_str.startswith(('0', '3')):
        return f"sz{code_str}"
    else:
        return code_str


def get_secid(code):
    """获取东方财富API的secid格式"""
    code_str = str(code).strip()
    
    # 处理指数代码
    if code_str == '1A0001' or code_str == '000001':
        # 上证指数
        return '1.000001'
    elif code_str.startswith('1A'):
        # 其他指数代码，去掉1A前缀
        return f"1.{code_str[2:]}"
    elif code_str.startswith('6'):
        return f"1.{code_str}"
    else:
        return f"0.{code_str}"

