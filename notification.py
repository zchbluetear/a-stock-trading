#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""通知模块 - 处理微信等第三方消息推送"""

import requests
import os
import json
from datetime import datetime

# 默认 PushPlus Token，建议用户在环境变量中配置 PUSHPLUS_TOKEN
PUSHPLUS_TOKEN = os.getenv("PUSHPLUS_TOKEN", "262b497ea05a42a59161157a321d07e9")

def send_wechat_notification(title, content, template="html"):
    """
    通过 PushPlus 发送微信通知
    
    参数:
    - title: 消息标题
    - content: 消息内容（支持 Markdown 或 HTML）
    - template: 模板类型（html, txt, json, markdown）
    
    返回:
    - dict: 包含 success(bool) 和 message(str)
    """
    if not PUSHPLUS_TOKEN:
        print("[Notification] 推送失败：未配置 PUSHPLUS_TOKEN环境变量")
        return {"success": False, "message": "未配置 PUSHPLUS_TOKEN"}
        
    url = "http://www.pushplus.plus/send"
    data = {
        "token": PUSHPLUS_TOKEN,
        "title": title,
        "content": content,
        "template": template
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        result = response.json()
        
        if result.get("code") == 200:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Notification] 推送成功: {title}")
            return {"success": True, "message": "推送成功"}
        else:
            error_msg = result.get("msg", "未知错误")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Notification] 推送失败: {error_msg}")
            return {"success": False, "message": error_msg}
            
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [Notification] 推送异常: {str(e)}")
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    # 测试代码
    send_wechat_notification("超卖预警测试", "这是一条来自股票分析系统的测试消息。", "txt")

def send_email_notification(to_addr, title, content):
    """
    发送邮件通知
    此函数为模拟发送，因为没有配置实际的 SMTP 服务器。
    """
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Notification] 准备发送邮件到: {to_addr}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Notification] 邮件标题: {title}")
    # 实际应用中这里会调用 smtplib 连接服务器发送邮件
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Notification] 邮件发送成功 (模拟)")
    return {"success": True, "message": "邮件发送成功"}
