import { Link, useLocation } from 'react-router-dom';
import Tasks from './Tasks';
import Settings from './Settings';

const tabs = [
  { path: '/tasks', label: 'AI评测', component: Tasks },
  { path: '/settings', label: '模型配置', component: Settings },
];

export default function AICenter() {
  const { pathname } = useLocation();
  const activeTab = tabs.find((tab) => tab.path === pathname) ?? tabs[0];
  const ActiveComponent = activeTab.component;

  return (
    <div className="space-y-4">
      <nav aria-label="AI中心功能" className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-2 border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const active = tab.path === activeTab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${active
                  ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <ActiveComponent />
    </div>
  );
}
