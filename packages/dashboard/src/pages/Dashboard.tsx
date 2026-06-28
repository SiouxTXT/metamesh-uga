import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Activity, Wrench, TrendingUp, TrendingDown,
  AlertCircle, Shield, Zap, RefreshCw, Search, Bot, Globe, Server
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_BASE = 'https://api.metamesh-uga.dev';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

function StatsCard({ title, value, icon: Icon, trend, trendUp, color = 'blue' }: StatsCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, title, description, href, color = 'blue' }: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'hover:border-blue-500/30 hover:bg-blue-500/5',
    green: 'hover:border-emerald-500/30 hover:bg-emerald-500/5',
    purple: 'hover:border-purple-500/30 hover:bg-purple-500/5',
    amber: 'hover:border-amber-500/30 hover:bg-amber-500/5',
  };

  return (
    <a
      href={href}
      className={`group bg-slate-900 rounded-xl border border-slate-800 p-6 transition-all ${colorMap[color]}`}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
      </div>
    </a>
  );
}

export function Dashboard() {
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['dashboard-health'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/dashboard/health`);
      if (!res.ok) throw new Error('Failed to load health');
      return res.json();
    }
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['dashboard-usage'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/dashboard/usage`);
      if (!res.ok) throw new Error('Failed to load usage');
      return res.json();
    }
  });

  const { data: errors, isLoading: errorsLoading } = useQuery({
    queryKey: ['dashboard-errors'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/dashboard/errors`);
      if (!res.ok) throw new Error('Failed to load errors');
      return res.json();
    }
  });

  const { data: tools } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/tools?limit=5`);
      if (!res.ok) throw new Error('Failed to load tools');
      return res.json();
    }
  });

  const { data: featuresData } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/features`);
      if (!res.ok) throw new Error('Failed to load features');
      return res.json();
    }
  });

  const isLoading = healthLoading || usageLoading || errorsLoading;

  const usageChartData = {
    labels: (usage?.usage || []).map((u: { date: string }) => u.date),
    datasets: [
      {
        label: 'Calls',
        data: (usage?.usage || []).map((u: { calls: number }) => u.calls),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
      }
    ]
  };

  const errorChartData = {
    labels: (errors?.errors || []).map((e: { date: string }) => e.date),
    datasets: [
      {
        label: 'Errors',
        data: (errors?.errors || []).map((e: { count: number }) => e.count),
        backgroundColor: '#ef4444',
        borderRadius: 6,
      }
    ]
  };

  const doughnutData = {
    labels: ['Active', 'Other'],
    datasets: [
      {
        data: [health?.active_tools || 0, Math.max(0, (health?.total_tools || 0) - (health?.active_tools || 0))],
        backgroundColor: ['#10b981', '#334155'],
        borderWidth: 0,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: '#1e293b' }
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: { color: '#1e293b' }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8' }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time MCP Operating System metrics</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Tools"
          value={health?.total_tools ?? 0}
          icon={Server}
          color="blue"
        />
        <StatsCard
          title="Active Tools"
          value={health?.active_tools ?? 0}
          icon={Activity}
          trend="+24h"
          trendUp={true}
          color="green"
        />
        <StatsCard
          title="24h Requests"
          value={health?.requests_24h ?? 0}
          icon={Globe}
          color="purple"
        />
        <StatsCard
          title="24h Errors"
          value={health?.errors_24h ?? 0}
          icon={AlertCircle}
          trend={health?.errors_24h === 0 ? 'healthy' : 'review'}
          trendUp={health?.errors_24h === 0}
          color="amber"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction icon={Search} title="Search Tools" description="Find by capability or category" href="/tools" color="blue" />
        <QuickAction icon={Shield} title="Security Scan" description="Run vulnerability checks" href="/tools" color="green" />
        <QuickAction icon={RefreshCw} title="Registry Sync" description="Refresh tool catalog" href="/tools" color="purple" />
        <QuickAction icon={Bot} title="AI Agents" description="Manage agent wallets" href="/agent" color="amber" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Usage (Last 7 Days)
          </h2>
          <div className="h-64">
            <Line data={usageChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-400" />
            Tool Status
          </h2>
          <div className="h-48">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-400">
              {health?.active_tools ?? 0} of {health?.total_tools ?? 0} tools active
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Errors (Last 7 Days)
          </h2>
          <div className="h-48">
            <Bar data={errorChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Active Features
          </h2>
          <div className="space-y-3">
            {(featuresData?.features || []).slice(0, 8).map((feature: { name: string; enabled: boolean }, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-slate-300 text-sm capitalize">{feature.name.replace(/_/g, ' ')}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${feature.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  {feature.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Tools */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-400" />
          Top Tools
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-3 text-slate-400 font-medium">Name</th>
                <th className="py-3 text-slate-400 font-medium">Category</th>
                <th className="py-3 text-slate-400 font-medium">Trust Score</th>
                <th className="py-3 text-slate-400 font-medium">Security Score</th>
                <th className="py-3 text-slate-400 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {(tools?.tools || []).slice(0, 5).map((tool: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-800 last:border-0">
                  <td className="py-3 text-white font-medium">{tool.name}</td>
                  <td className="py-3 text-slate-400">{tool.category}</td>
                  <td className="py-3 text-emerald-400">{(tool.trust_score * 100).toFixed(0)}%</td>
                  <td className="py-3 text-blue-400">{(tool.security_score * 100).toFixed(0)}%</td>
                  <td className="py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                      {tool.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
