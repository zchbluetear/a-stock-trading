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
    获取东方财富板块集合竞价数据
    通过抓取行业板块实时数据
    """
    try:
        # 东方财富行业板块数据接口
        url = "https://push2.eastmoney.com/api/qt/clist/get"
        params = {
            "pn": 1,
            "pz": 100,  # 获取前100个板块
            "po": 1,
            "np": 1,
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": 2,
            "invt": 2,
            "fid": "f3",
            "fs": "m:90 t:2+m:90 t:3", # 行业板块
            "fields": "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f26,f22,f33,f11,f62,f128,f136,f115,f152"
        }
        
        response = requests.get(url, params=params, timeout=2)
        
        if response.status_code == 200:
            data = response.json()
            if data and "data" in data and "diff" in data["data"]:
                sectors = []
                for item in data["data"]["diff"]:
                    # 解析数据
                    sector = {
                        "code": item.get("f12", ""),
                        "name": item.get("f14", ""),
                        "change_percent": item.get("f3", 0), # 涨跌幅
                        "turnover_rate": item.get("f8", 0),  # 换手率
                        "volume": item.get("f5", 0),         # 成交量
                        "amount": item.get("f6", 0),         # 成交额
                        "net_inflow": item.get("f62", 0)     # 净流入
                    }
                    sectors.append(sector)
                
                # 按照涨跌幅排序
                sectors.sort(key=lambda x: x["change_percent"] if x["change_percent"] is not None else -999, reverse=True)
                return sectors
        return []
    except Exception as e:
        print(f"获取集合竞价板块数据失败: {e}")
        return []

if __name__ == "__main__":
    sectors = get_auction_sector_data()
    for s in sectors[:10]:
        print(s)
