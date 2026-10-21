import { useQuery } from '@tanstack/react-query';
import { stockAPI, type DebateJobStatus } from '../services/api';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();

  const { data: jobsData, isLoading, error, refetch } = useQuery({
    queryKey: ['debate-jobs', statusFilter],
    queryFn: async () => {
      const filterParam = statusFilter !== 'all' ? statusFilter : undefined;
      return await stockAPI.listDebateJobs(filterParam);
    },
    refetchInterval: 5000, // 每5秒刷新一次
  });

  // 当路由切换时刷新任务列表
  useEffect(() => {
    refetch();
  }, [location.pathname, refetch]);

  const jobs: DebateJobStatus[] = jobsData || [];

  // 过滤任务列表
  const filteredJobs = jobs.filter(job => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const codeMatch = job.code?.toLowerCase().includes(searchLower);
    const nameMatch = job.name?.toLowerCase().includes(searchLower);
    return codeMatch || nameMatch;
  });

  const handleStopJob = async (jobId: string) => {
    try {
      await stockAPI.stopDebateJob(jobId);
      refetch();
    } catch (error) {
      console.error('终止任务失败:', error);
      alert('终止任务失败');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return;
    try {
      await stockAPI.deleteDebateJob(jobId);
      refetch();
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除任务失败');
    }
  };

  const handleViewJob = (jobId: string, code?: string) => {
    const params = new URLSearchParams();
    params.set('job_id', jobId);
    if (code) params.set('code', code);
    navigate(`/ai-debate?${params.toString()}`);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      queued: { label: '排队中', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
      running: { label: '进行中', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
      completed: { label: '已完成', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      failed: { label: '失败', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
      canceled: { label: '已取消', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
    };

    const config = statusConfig[status] || statusConfig.queued;
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h3 className="text-red-800 dark:text-red-300 font-medium">加载任务列表失败</h3>
        <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(error)}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
        </div>
      </div>

      {/* 状态筛选和搜索 */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setStatusFilter('running')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'running'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            进行中
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            已完成
          </button>
        </div>
        <div className="relative sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索代码 / 名称"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* 任务列表 */}
      <div className="mt-6 flow-root">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              {jobs.length === 0 ? '暂无任务记录' : '未找到匹配的任务'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <div
                key={job.job_id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {job.name}
                      </h3>
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>股票代码: {job.code}</span>
                      <span>·</span>
                      <span>创建时间: {new Date(job.created_at).toLocaleString('zh-CN')}</span>
                      <span>·</span>
                      <span>分析轮数: {job.analysis_rounds}</span>
                      <span>·</span>
                      <span>辩论轮数: {job.debate_rounds}</span>
                    </div>
                    {job.status === 'running' && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${job.progress || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {job.progress || 0}%
                          </span>
                        </div>
                      </div>
                    )}
                    {job.error && (
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        错误: {job.error}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:ml-4">
                    <button
                      onClick={() => handleViewJob(job.job_id, job.code)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      查看详情
                    </button>
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleStopJob(job.job_id)}
                        className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                      >
                        终止
                      </button>
                    )}
                    {(job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') && (
                      <button
                        onClick={() => handleDeleteJob(job.job_id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
