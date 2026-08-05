# 市场情绪强弱量化指标集成计划

将情绪强弱计算与阶段评估模型接入 `a-stock-trading` 项目后端，提供计算引擎、数据获取接口及 REST API 服务。

## User Review Required

> [!IMPORTANT]
> 1. **数据源容错与降级机制**：因依赖 akshare / 新浪等公开接口，若实时接口响应较慢或在非交易日无最新数据，系统将自动使用安全的默认经验基准值进行降级补偿，避免接口 500。
> 2. **历史计算窗口**：默认采用 20 个交易日滚动标准化窗口及 3 日 EMA 情绪平滑。

## Open Questions

无。

## Proposed Changes

---

### [指标引擎与计算层]

#### [MODIFY] [technical_indicators.py](file:///Users/user/python/a-stock-trading/technical_indicators.py)
- 新增 `calculate_market_sentiment` 函数：
  - 计算封板成功率、净涨停差值、连板晋级率及涨跌比。
  - 进行防除零与防突变的安全 Min-Max 归一化。
  - 加入 3 日 EMA 消除单日短线噪点。
  - 自动输出情绪等级标签（`超强高潮` / `升温/强情绪` / `震荡/中性` / `分歧/弱情绪` / `冰点恐慌`）及 HEX 视觉颜色代码。
- 新增 `get_latest_sentiment_summary` 函数：
  - 提取最新交易日情绪指标字典供 API 或 Agent 消费。

---

### [数据获取层]

#### [MODIFY] [data_fetchers.py](file:///Users/user/python/a-stock-trading/data_fetchers.py)
- 新增 `get_market_sentiment_stats(days=30)` 函数：
  - 综合调用 `ak.stock_zt_pool_em` (涨停池), `ak.stock_zt_pool_zbc_em` (炸板池), `ak.stock_zt_pool_dtgc_em` (跌停池) 等接口，整理最近交易日的情绪基础数据集 DataFrame。

---

### [后端路由与 API 层]

#### [MODIFY] [api_routes.py](file:///Users/user/python/a-stock-trading/api_routes.py)
- 注册路由 `GET /api/market/sentiment`：
  - 支持参数 `days` (可选，默认 30)。
  - 调用 `data_fetchers` 与 `technical_indicators` 计算情绪分值，返回最新情绪摘要与历史趋势数组 JSON。

---

## Verification Plan

### Automated Tests
- 运行测试脚本校验 `calculate_market_sentiment` 在正常数据、缺失列、极端值（如极度大跌、大涨）下的计算正确性与安全性。

### Manual Verification
- 启动 Flask 服务器 `python api_server.py` 或测试环境路由，请求 `http://localhost:5000/api/market/sentiment` 验证 HTTP 返回结构。
