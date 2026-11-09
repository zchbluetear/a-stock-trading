import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Watchlist from './pages/Watchlist';
import StockDetail from './pages/StockDetail';
import AICenter from './pages/AICenter';
import Sentiment from './pages/Sentiment';
import SectorResearch from './pages/SectorResearch';
import MarketMovers from './pages/MarketMovers';
import StrategyCenter from './pages/StrategyCenter';
import AIDebate from './pages/AIDebate';
import Auction from './pages/Auction';
import TradingLogs from './pages/TradingLogs';
import JournalPage from './pages/Journal';
import Layout from './components/Layout';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30秒
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/stock/:code" element={<StockDetail />} />
            <Route path="/tasks" element={<AICenter />} />
            <Route path="/settings" element={<AICenter />} />
            <Route path="/sentiment" element={<Sentiment />} />
            <Route path="/sectors" element={<SectorResearch />} />
            <Route path="/market-movers" element={<MarketMovers />} />
            <Route path="/strategy" element={<StrategyCenter />} />
            <Route path="/strategy-config" element={<StrategyCenter />} />
            <Route path="/strategy-toggle" element={<StrategyCenter />} />
            <Route path="/auction" element={<Auction />} />
            <Route path="/ai-debate" element={<AIDebate />} />
            <Route path="/trading-logs" element={<TradingLogs />} />
            <Route
              path="/premarket-plan"
              element={
                <JournalPage
                  type="plan"
                  title="盘前计划"
                  hint="开盘前写下今天的操作计划。"
                  placeholder={'例如：\n· 大盘预判与今日仓位上限\n· 重点关注的标的及买点\n· 止损位与止盈目标\n· 今天坚决不做什么（纪律）'}
                />
              }
            />
            <Route
              path="/postmarket-summary"
              element={
                <JournalPage
                  type="review"
                  title="盘后总结"
                  hint="收盘后结合计划和实际交易复盘与反思。"
                  placeholder={'例如：\n· 今天做对了什么\n· 哪里偏离了盘前计划\n· 当时的情绪与心态\n· 明天要改进的一件事'}
                />
              }
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
