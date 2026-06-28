import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

const API_BASE = 'https://api.metamesh-uga.dev';

export function Usage() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['metrics-summary'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/metrics/summary`);
      if (!res.ok) throw new Error('Failed to load metrics');
      return res.json();
    },
    staleTime: 60000
  });

  const { data: dailyUsage, isLoading: dailyLoading } = useQuery({
    queryKey: ['dashboard-usage'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/dashboard/usage`);
      if (!res.ok) throw new Error('Failed to load usage');
      return res.json();
    },
    staleTime: 60000
  });

  const { data: dailyErrors } = useQuery({
    queryKey: ['dashboard-errors'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/dashboard/errors`);
      if (!res.ok) throw new Error('Failed to load errors');
      return res.json();
    },
    staleTime: 60000
  });

  const isLoading = summaryLoading || dailyLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const daily = dailyUsage?.usage || [];
  const errors = dailyErrors?.errors || [];

  const errorsMap: Record<string, number> = {};
  errors.forEach((e: { date: string; count: number }) => { errorsMap[e.date] = e.count; });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usage Statistics</h1>
        <p className="text-sm text-slate-400 mt-1">Live data from MetaMesh-UGA gateway</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Calls</p>
              <p className="text-2xl font-bold text-white">{(summary?.total_calls || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Success Rate</p>
              <p className="text-2xl font-bold text-white">{summary?.success_rate ?? 100}%</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Avg Latency</p>
              <p className="text-2xl font-bold text-white">{summary?.avg_latency_ms ?? 0}ms</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Errors</p>
              <p className="text-2xl font-bold text-white">{(summary?.error_calls || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Usage Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Daily Usage — Last 7 Days
        </h2>
        {daily.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No usage data yet. Make your first API call to see stats here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Total Calls</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Errors</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day: { date: string; calls: number }) => {
                  const dayErrors = errorsMap[day.date] || 0;
                  const rate = day.calls > 0 ? (((day.calls - dayErrors) / day.calls) * 100).toFixed(1) : '100.0';
                  return (
                    <tr key={day.date} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-white">{day.date}</td>
                      <td className="py-3 px-4 text-right text-white font-medium">{day.calls.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-red-400">{dayErrors}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${parseFloat(rate) >= 99 ? 'text-emerald-400' : parseFloat(rate) >= 90 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Tools */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Most Called Tools (All Time)</h2>
        {(summary?.top_tools || []).length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No tool calls recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {(summary?.top_tools || []).map((tool: { name: string; calls: number }, idx: number) => {
              const maxCalls = summary.top_tools[0]?.calls || 1;
              const pct = Math.round((tool.calls / maxCalls) * 100);
              return (
                <div key={tool.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500 w-5 text-right">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm">{tool.name}</span>
                      <span className="text-sm text-slate-400">{tool.calls.toLocaleString()} calls</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
