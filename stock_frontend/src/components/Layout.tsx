import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '市场概览' },
    { path: '/sectors', label: '板块强度' },
    { path: '/auction', label: '涨停池' },
    { path: '/watchlist', label: '自选' },
    { path: '/trading-logs', label: '交易记录' },
    { path: '/strategy', label: '策略中心' },
    { path: '/tasks', label: 'AI中心' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 手机端始终展示全部入口；宽屏恢复单行导航。 */}
      <nav aria-label="主导航" className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-6">
            <Link to="/" className="flex h-14 shrink-0 items-center text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 lg:h-16">
              静水流深
            </Link>
            <div className="grid grid-cols-3 gap-1 pb-3 sm:grid-cols-5 lg:flex lg:flex-1 lg:justify-between lg:gap-2 lg:pb-0">
              {navItems.map((item) => {
                const active = item.path === '/strategy'
                  ? location.pathname.startsWith('/strategy')
                  : item.path === '/tasks'
                    ? location.pathname === '/tasks' || location.pathname === '/settings'
                  : location.pathname === item.path;
                return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border-b-2 px-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 lg:h-16 lg:rounded-none ${active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 lg:bg-transparent dark:lg:bg-transparent'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                >
                  {item.label}
                </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="min-w-0 max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
