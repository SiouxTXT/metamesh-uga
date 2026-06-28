import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Server, Globe, Copy, Check, Construction, Bot, Code2, Zap } from 'lucide-react';

const API_BASE = 'https://api.metamesh-uga.dev';

const MCP_CONFIG_SSE = `{
  "mcpServers": {
    "metamesh-uga": {
      "url": "https://api.metamesh-uga.dev/mcp",
      "transport": "http"
    }
  }
}`;

const MCP_CONFIG_CLAUDE = `{
  "mcpServers": {
    "metamesh-uga": {
      "command": "npx",
      "args": ["-y", "@metamesh/mcp-bridge"],
      "env": {
        "METAMESH_URL": "https://api.metamesh-uga.dev/mcp"
      }
    }
  }
}`;

export function AgentDashboard() {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['metrics-summary'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/metrics/summary`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 60000
  });

  const { data: health } = useQuery({
    queryKey: ['dashboard-health'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/dashboard/health`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 60000
  });

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/features`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 300000
  });

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Agent Integration</h1>
        <p className="text-sm text-slate-400 mt-1">Connect any AI agent to MetaMesh-UGA via MCP protocol</p>
      </div>

      {/* Live System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Server className="w-5 h-5 text-blue-400" /></div>
            <div>
              <p className="text-sm text-slate-400">Total Tools</p>
              <p className="text-2xl font-bold text-white">{health?.total_tools ?? '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg"><Zap className="w-5 h-5 text-emerald-400" /></div>
            <div>
              <p className="text-sm text-slate-400">Active Tools</p>
              <p className="text-2xl font-bold text-white">{health?.active_tools ?? '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg"><Activity className="w-5 h-5 text-purple-400" /></div>
            <div>
              <p className="text-sm text-slate-400">Total API Calls</p>
              <p className="text-2xl font-bold text-white">{(summary?.total_calls || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg"><Globe className="w-5 h-5 text-amber-400" /></div>
            <div>
              <p className="text-sm text-slate-400">Success Rate</p>
              <p className="text-2xl font-bold text-white">{summary?.success_rate ?? 100}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* MCP Connection Guide */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg"><Bot className="w-5 h-5 text-blue-400" /></div>
          <h2 className="text-lg font-semibold text-white">Connect Your Agent via MCP</h2>
        </div>

        {/* Endpoint */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">MCP Endpoint</p>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3">
            <code className="text-sm font-mono text-emerald-400 flex-1">https://api.metamesh-uga.dev/mcp</code>
            <button
              onClick={() => copy('https://api.metamesh-uga.dev/mcp', 'endpoint')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {copied === 'endpoint' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Devin / Cursor / Windsurf */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-400" />
            Devin / Cursor / Windsurf / Claude Desktop config
          </p>
          <div className="relative">
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto">{MCP_CONFIG_SSE}</pre>
            <button
              onClick={() => copy(MCP_CONFIG_SSE, 'sse')}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
            >
              {copied === 'sse' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Claude Desktop alternate */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-purple-400" />
            Claude Desktop (stdio bridge)
          </p>
          <div className="relative">
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto">{MCP_CONFIG_CLAUDE}</pre>
            <button
              onClick={() => copy(MCP_CONFIG_CLAUDE, 'claude')}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
            >
              {copied === 'claude' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick curl test */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">Quick test (verify tools/list)</p>
          <div className="relative">
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto">{`curl -X POST https://api.metamesh-uga.dev/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}</pre>
            <button
              onClick={() => copy(`curl -X POST https://api.metamesh-uga.dev/mcp \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`, 'curl')}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
            >
              {copied === 'curl' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Enabled Features */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Gateway Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {((features?.features) || []).map((f: { name: string; enabled: boolean }) => (
            <div key={f.name} className={`rounded-lg p-3 border text-sm ${f.enabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800 border-slate-700'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${f.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className={`capitalize font-medium ${f.enabled ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {f.name.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* x402 Agent Payments */}
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/20 rounded-lg flex-shrink-0">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">x402 Autonomous Agent Payments</h2>
            <p className="text-sm text-slate-300 mt-2">
              MetaMesh-UGA supports the <span className="text-purple-400 font-mono">x402</span> payment protocol — agents pay per API call automatically using USDC on Base, without human intervention.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                <p className="text-slate-400">Price / call</p>
                <p className="text-white font-bold mt-1">$0.001</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                <p className="text-slate-400">Network</p>
                <p className="text-white font-bold mt-1">Base</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                <p className="text-slate-400">Token</p>
                <p className="text-white font-bold mt-1">USDC</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Construction className="w-4 h-4 flex-shrink-0" />
              x402 middleware in development. Current API calls are free. Schema and pricing finalized.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
