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
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
