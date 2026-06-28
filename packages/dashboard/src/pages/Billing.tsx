import { useQuery } from '@tanstack/react-query';
import { CreditCard, Check, Zap, Building2, Construction } from 'lucide-react';

const API_BASE = 'https://api.metamesh-uga.dev';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    callLimit: '1,000 calls/month',
    features: [
      '1,000 API calls per month',
      'Access to all 114+ MCP tools',
      'REST API + MCP protocol',
      'Community support'
    ],
    icon: Zap,
    highlight: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    callLimit: 'Unlimited calls',
    features: [
      'Unlimited API calls',
      'Access to all MCP tools',
      'Priority smart routing',
      'Advanced analytics',
      'Email support'
    ],
    icon: CreditCard,
    highlight: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    callLimit: 'Unlimited + SLA',
    features: [
      'Everything in Pro',
      'Dedicated infrastructure',
      'Custom tool integration',
      'SLA 99.9% uptime',
      'Dedicated support'
    ],
    icon: Building2,
    highlight: false
  }
];

export function Billing() {
  const { data: health } = useQuery({
    queryKey: ['dashboard-health'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/dashboard/health`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    staleTime: 60000
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
        <p className="text-sm text-slate-400 mt-1">Choose the right plan for your usage</p>
      </div>

      {/* Stripe Coming Soon Banner */}
      <div className="flex items-start gap-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
        <Construction className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-300">Stripe integration in progress</p>
          <p className="text-sm text-amber-400/80 mt-1">
            Subscription management and invoicing are under development. Currently all API calls are free.
            Register your interest at <span className="font-mono text-amber-300">team@metamesh-uga.dev</span>.
          </p>
        </div>
      </div>

      {/* Current System Status */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Current System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Total Tools</p>
            <p className="text-xl font-bold text-white mt-1">{health?.total_tools ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-400">Active Tools</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{health?.active_tools ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-400">24h Requests</p>
            <p className="text-xl font-bold text-blue-400 mt-1">{health?.requests_24h ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-400">24h Errors</p>
            <p className="text-xl font-bold text-red-400 mt-1">{health?.errors_24h ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 relative ${
                plan.highlight
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-slate-800 bg-slate-900'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${plan.highlight ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
                  <Icon className={`w-5 h-5 ${plan.highlight ? 'text-blue-400' : 'text-slate-400'}`} />
                </div>
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              </div>
              <p className="text-3xl font-bold text-white">
                ${plan.price}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">{plan.callLimit}</p>
              <ul className="mt-5 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                disabled
                className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
              >
                Coming Soon
              </button>
            </div>
          );
        })}
      </div>

      {/* x402 AI Agent Payments */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg flex-shrink-0">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">x402 AI Agent Payments</h2>
            <p className="text-sm text-slate-400 mt-2">
              MetaMesh-UGA is designed to support autonomous AI agents paying per-call via the{' '}
              <span className="text-purple-400 font-mono">x402</span> payment protocol on Base network (USDC).
              Pricing starts at <span className="text-white font-medium">$0.001 per call</span> with bulk discounts.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400">Per Call</p>
                <p className="text-white font-semibold mt-1">$0.001 USDC</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400">Bulk (100+ calls)</p>
                <p className="text-white font-semibold mt-1">$0.0005 USDC</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400">Network</p>
                <p className="text-white font-semibold mt-1">Base (EVM)</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Construction className="w-4 h-4 flex-shrink-0" />
              x402 payment middleware is under active development. The schema and pricing are finalized; integration pending.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
