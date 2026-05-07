#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""集合竞价分析模块 - 抓取东方财富数据并分析板块强度"""

import requests
import pandas as pd
import json
from datetime import datetime
import time

def get_auction_sector_data():
    """
    获取行业板块实时数据（使用新浪申万行业板块接口）
    涨跌幅/成交量/成交额 来自新浪；换手率/净流入 新浪无数据置 None
    """
    try:
        # 新浪申万一级行业板块接口（sw_hy = 申万行业分类，共31个一级行业）
        url = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeDataByNode"
        params = {
            "count": 100,
            "page": 1,
            "sort": "changepercent",
            "asc": 0,
            "node": "sw_hy",
            "symbol": "",
            "_s_r_a": "page",
        }
        
        response = requests.get(url, params=params, timeout=5, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "http://finance.sina.com.cn",
        })
        response.encoding = "gbk"

        if response.status_code == 200:
            raw = response.text.strip()
            # 新浪接口返回格式为 {"count":N,"data":[...]} 或直接 [...]
            try:
                parsed = json.loads(raw)
            except Exception:
                return []

            if isinstance(parsed, dict):
                items = parsed.get("data", [])
            elif isinstance(parsed, list):
                items = parsed
            else:
                items = []

            sectors = []
            for item in items:
                try:
                    change_pct = float(item.get("changepercent", 0) or 0)
                except (ValueError, TypeError):
                    change_pct = 0
                try:
                    volume = int(item.get("volume", 0) or 0)
                except (ValueError, TypeError):
                    volume = 0
                try:
                    amount = float(item.get("amount", 0) or 0)
                except (ValueError, TypeError):
                    amount = 0

                sectors.append({
                    "code": item.get("code", ""),
                    "name": item.get("name", ""),
                    "change_percent": change_pct,   # 涨跌幅（%）
                    "turnover_rate": None,           # 新浪板块接口无换手率
                    "volume": volume,                # 成交量（股）
                    "amount": amount,                # 成交额（元）
                    "net_inflow": None,              # 新浪无净流入数据
                })

            # 按涨跌幅降序排列
            sectors.sort(
                key=lambda x: x["change_percent"] if x["change_percent"] is not None else -999,
                reverse=True,
            )
            return sectors

        return []
    except Exception as e:
        print(f"获取板块数据失败: {e}")
        return []

if __name__ == "__main__":
    sectors = get_auction_sector_data()
    for s in sectors[:10]:
        print(s)
