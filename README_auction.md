# 集合竞价监控功能说明

## 1. 启动服务
- 启动后端：`python3 api_server.py`
- 启动前端：`cd stock_frontend && npm run dev`

## 2. API 接口
- `GET /api/auction/sectors`：获取所有板块集合竞价强度排行（返回前100）。

## 3. 监控服务
- 与强势股服务共享后端监控启动体系。
- 每日 **09:25-09:26** 自动触发抓取并推送到绑定的微信端（复用原有的 `send_wechat_notification` ）。

## 4. 前端页面
- 地址：`http://localhost:5173/auction`
- 功能：实时监控集合竞价板块数据，提供排名及资金流等维度的查询视图。
