# 板块研究

页面入口：主导航「板块研究」，路径 `/sectors`。

## 功能

- 开盘啦强度分 / 同花顺涨幅分别研究，不混合比较单位。
- 选择上游返回的日期复盘，观察窗口为 5 / 10 / 20 个快照。
- 当日 Top10、持续活跃（连续至少 3 个完整快照上榜）、新进榜单、窗口全部。
- 搜索、按排名 / 上榜频次 / 排名提升排序、单板块排名轨迹、轮动矩阵、CSV 导出。
- 显示真实快照日期、抓取时间、数据缺失状态；不生成占位行情。

## 接入

`api_routes.register_routes` 已注册新增接口，无需数据库迁移或新的 Python / npm 依赖。

`GET /api/market/sectors/research?source=kaipan&window=10&date=2026-10-09`

- `source`: `kaipan` 或 `ths`。
- `window`: `5`、`10`、`20`。
- `date`: 可选，只接受实际返回的快照日期，省略时使用最新快照。
- 参数无效返回 400；上游失败返回 502，JSON 内给出中文错误。
- 上游：`https://duanxianxia.com/api/getPlateRotatData`，每次申请 50 个快照。
- 每个来源缓存 180 秒，页面每 5 分钟检查更新。

正常启动项目后端和前端即可使用；前端沿用设置中的 API 地址及 `VITE_API_BASE_URL`。

## 口径与限制

快照不等于交易日：上游可能缺少日期，连续上榜按连续完整快照统计。回看日期时，频次、轨迹及轮动矩阵都不包含所选日期以后的数据。

单日必须具备 1–10 名且板块代码不重复才认定完整。空单元格保留日期位置；不把后一日数据前移。上榜率只统计完整快照。前后两日均完整时才计算新进榜单和排名变化；新进板块没有虚构的前序排名。

未上榜是榜单外状态，并非跌幅或零强度。该页面未计算自研综合强度分，不提供买卖信号，也未对两个来源的同名板块做成分映射。历史范围以接口当前可提供的快照为限，暂不提供永久归档。

## 检查

```sh
python3 -m unittest discover -s checks -p check_sector_research.py
cd stock_frontend
./node_modules/.bin/eslint src/pages/SectorResearch.tsx src/services/sectorResearch.ts
./node_modules/.bin/tsc --noEmit --jsx react-jsx --moduleResolution bundler --module ESNext --target ES2022 --lib ES2022,DOM --skipLibCheck --types vite/client src/pages/SectorResearch.tsx src/services/sectorResearch.ts
./node_modules/.bin/vite build
```

当前仓库原有 `npm run build` 调用 `tsc -b`，但缺少 `tsconfig.json`，因此该命令仍受既有配置问题阻塞；上述独立类型检查及 Vite 打包可验证新增页面。

已用真实双源响应进行桌面与 390px 手机端检查，覆盖日期切换、观察窗口、筛选、搜索空状态、详情选择、CSV 下载，以及浏览器模拟 502 后的旧数据提示与恢复。截图位于 `output/playwright/sector-research-*.png`。
