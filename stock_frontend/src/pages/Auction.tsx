import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockAPI } from '../services/api';

interface Sector {
  code: string;
  name: string;
  change_percent: number;
  turnover_rate: number;
  volume: number;
  amount: number;
  net_inflow: number;
}

export default function Auction() {
  const { data: sectors, isLoading, refetch } = useQuery<Sector[]>({
    queryKey: ['auction-sectors'],
    queryFn: () => stockAPI.getAuctionSectors(),
    refetchInterval: 10000, // 每10秒刷新一次
  });

  // 格式化金额
  const formatAmount = (amount: number) => {
    if (!amount) return '0.00亿';
    return (amount / 100000000).toFixed(2) + '亿';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">早盘集合竞价板块强度</h1>
        
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
          <div className="text-gray-500 dark:text-gray-400">加载数据中...</div>
        </div>
      ) : sectors && sectors.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">排名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">板块代码</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">板块名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">涨跌幅</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">换手率</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">成交额</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">净流入</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sectors.map((sector, index) => (
                  <tr key={sector.code} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {sector.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      {sector.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-medium ${
                        sector.change_percent > 0 ? 'text-red-600 dark:text-red-400' :
                        sector.change_percent < 0 ? 'text-green-600 dark:text-green-400' :
                        'text-gray-900 dark:text-white'
                      }`}>
                        {sector.change_percent ? (sector.change_percent > 0 ? '+' : '') + sector.change_percent.toFixed(2) + '%' : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {sector.turnover_rate ? sector.turnover_rate.toFixed(2) + '%' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatAmount(sector.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <span className={`font-medium ${
                        sector.net_inflow > 0 ? 'text-red-600 dark:text-red-400' :
                        sector.net_inflow < 0 ? 'text-green-600 dark:text-green-400' :
                        'text-gray-900 dark:text-white'
                      }`}>
                        {formatAmount(sector.net_inflow)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
          暂无数据
        </div>
      )}
    </div>
  );
}
