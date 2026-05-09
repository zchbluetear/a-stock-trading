import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockAPI } from '../services/api';

interface Sector {
  name: string;
  change_percent: number;
  five_min_change: number;
  net_inflow: number;
  lead_stock: string;
}

export default function Auction() {
  const { data: sectors, isLoading, refetch } = useQuery<Sector[]>({
    queryKey: ['auction-sectors'],
    queryFn: () => stockAPI.getAuctionSectors(),
    refetchInterval: 10000,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // 格式化金额 (返回亿元)
  const formatAmount = (amount: number) => {
    if (!amount) return '0.00';
    return (amount / 100000000).toFixed(2);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🔥 涨停股实时监控</h1>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 whitespace-nowrap"
          >
            刷新数据
          </button>
        </div>
      </div>

      {isLoading && !sectors ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500 dark:text-gray-400">数据连接中或暂无数据...</div>
        </div>
      ) : sectors && sectors.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">排名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">股票名称</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">今日涨幅</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider font-bold">连板数</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">封板资金(亿)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">所属行业</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sectors.map((sector, index) => (
                  <tr key={sector.name || index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-600 dark:text-cyan-400 text-center">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      {sector.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`font-medium ${sector.change_percent > 0 ? 'text-red-600 dark:text-red-400' :
                          sector.change_percent < 0 ? 'text-green-600 dark:text-green-400' :
                            'text-gray-900 dark:text-white'
                        }`}>
                        {sector.change_percent ? sector.change_percent.toFixed(2) + '%' : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`${
                          sector.five_min_change > 2 ? 'font-bold text-red-600 dark:text-red-400' :
                          sector.five_min_change > 0 ? 'text-red-600 dark:text-red-400' :
                          'text-gray-900 dark:text-white'
                        }`}>
                        {sector.five_min_change ? sector.five_min_change : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`font-medium ${sector.net_inflow > 0 ? 'text-red-600 dark:text-red-400' :
                          sector.net_inflow < 0 ? 'text-green-600 dark:text-green-400' :
                            'text-gray-900 dark:text-white'
                        }`}>
                        {formatAmount(sector.net_inflow)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                      {sector.lead_stock || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
          数据连接中或暂无数据...
        </div>
      )}
    </div>
  );
}
