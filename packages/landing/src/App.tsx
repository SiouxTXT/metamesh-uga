import React from 'react';
import { 
  Zap, Shield, Globe, CreditCard, 
  Check, ArrowRight, Menu, X, Github, Twitter, 
  Linkedin, Mail, Clock,
  ChevronDown,
  Bot, Wallet, Layers,
  Search, Lock, Activity, Server, Code, BarChart3, Cpu, Cloud, RefreshCw, Bell, Terminal, Workflow,
  Coins, Plug
} from 'lucide-react';

const API_BASE = 'https://api.metamesh-uga.dev';
const MCP_URL = `${API_BASE}/mcp`;

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="fixed w-full glass border-b border-slate-800/80 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Layers className="w-8 h-8 text-blue-500" />
                <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40" />
              </div>
              <span className="text-xl font-bold text-white">MetaMesh<span className="text-blue-500">-UGA</span></span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a>
              <a href="#payments" className="text-slate-400 hover:text-white transition-colors">Payments</a>
              <a href="#pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</a>
              <a href="#connect" className="text-slate-400 hover:text-white transition-colors">Connect</a>
              <a href="https://dashboard.metamesh-uga.dev" className="text-slate-400 hover:text-white transition-colors">Dashboard</a>
              <a 
                href="https://github.com/metamesh-uga/metamesh-uga" 
                className="text-slate-400 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5" />
              </a>
              <a 
                href="#connect"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30"
              >
                Get Started
              </a>
            </div>

            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-slate-300">Features</a>
              <a href="#payments" className="block text-slate-300">Payments</a>
              <a href="#pricing" className="block text-slate-300">Pricing</a>
              <a href="#connect" className="block text-slate-300">Connect</a>
              <a href="https://dashboard.metamesh-uga.dev" className="block text-slate-300">Dashboard</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Aurora background */}
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-3xl animate-aurora" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '3s' }} />
        <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '6s' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <a
              href="https://registry.modelcontextprotocol.io/?q=dev.metamesh-uga"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 glass border border-slate-700 text-slate-200 px-4 py-2 rounded-full text-sm font-medium mb-6 hover:border-blue-500/50 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              Listed on the official MCP Registry
            </a>
            
            <h1 className="text-5xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">
              The <span className="text-gradient">MCP Operating System</span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-4 leading-relaxed max-w-3xl mx-auto">
              One endpoint to discover, verify, route and monetize <span className="text-white font-semibold">13,000+</span> MCP tools. Serverless, edge-native, with built-in payments for AI agents.
            </p>
            
            <p className="text-base text-slate-500 mb-8 max-w-2xl mx-auto">
              Cloudflare-grade infrastructure for the Model Context Protocol: routing, trust scoring, security, analytics and self-healing — at the edge.
            </p>

            {/* Connect endpoint */}
            <div id="connect" className="glass border border-slate-700 rounded-2xl p-6 max-w-2xl mx-auto mb-8 shadow-2xl shadow-blue-950/50">
              <p className="text-slate-400 text-sm mb-3 flex items-center gap-2 justify-center">
                <Plug className="w-4 h-4" /> Add to any MCP client (Claude, Windsurf, Cursor, Antigravity)
              </p>
              <div className="flex items-center gap-3 bg-slate-950/80 rounded-lg px-4 py-3 border border-slate-800">
                <code className="flex-1 text-blue-300 font-mono text-sm sm:text-base overflow-x-auto text-left">
                  {MCP_URL}
                </code>
                <button 
                  onClick={copyCommand}
                  className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="#demo"
                className="group bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50"
              >
                See it in action
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a 
                href="https://docs.metamesh-uga.dev"
                className="glass border border-slate-700 text-slate-200 px-8 py-4 rounded-xl font-semibold hover:border-slate-500 transition-colors"
              >
                Read Documentation
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-16 border-t border-slate-800/60">
              <StatItem value="13,147" label="MCP Tools Indexed" />
              <StatItem value="< 50ms" label="Edge Latency" />
              <StatItem value="300+" label="Global Locations" />
              <StatItem value="2-Way" label="Stripe + x402 Pay" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              The MCP Operating System
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              18+ primitives that turn any MCP server into a managed, observable, monetizable service
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <FeatureCard icon={<Zap className="w-6 h-6 text-yellow-400" />} title="Serverless Edge" description="Zero infrastructure. Runs on Cloudflare's global edge network with 300+ locations." />
            <FeatureCard icon={<Shield className="w-6 h-6 text-green-400" />} title="WASM Runtime" description="Secure execution of MCP tools compiled to WebAssembly. Sandboxed and isolated." />
            <FeatureCard icon={<Bot className="w-6 h-6 text-purple-400" />} title="AI Agent Economy" description="Native x402 protocol support. Agents pay for tools with USDC micropayments." />
            <FeatureCard icon={<Globe className="w-6 h-6 text-blue-400" />} title="Universal Access" description="Single API key for all MCP servers. Automatic discovery and catalog updates." />
            <FeatureCard icon={<CreditCard className="w-6 h-6 text-pink-400" />} title="Flexible Pricing" description="Free tier for experimentation. Pro at $19/mo. Enterprise with SLA." />
            <FeatureCard icon={<Clock className="w-6 h-6 text-orange-400" />} title="Set & Forget" description="Automated discovery, updates, backups, and monitoring. Truly autonomous." />
            <FeatureCard icon={<Lock className="w-6 h-6 text-red-400" />} title="Security & Trust" description="CVE scanning, dependency analysis, security score, and policy enforcement." />
            <FeatureCard icon={<RefreshCw className="w-6 h-6 text-cyan-400" />} title="Self-Healing" description="Auto-detect failures, deprecate unhealthy tools, rollback when they recover." />
            <FeatureCard icon={<BarChart3 className="w-6 h-6 text-indigo-400" />} title="Real-time Analytics" description="Prometheus and OpenTelemetry exports. Usage, health, and error dashboards." />
            <FeatureCard icon={<Search className="w-6 h-6 text-emerald-400" />} title="Semantic Search" description="Find the right tool by intent, category, or capability across the entire registry." />
            <FeatureCard icon={<Server className="w-6 h-6 text-rose-400" />} title="Registry Sync" description="Federate with official and community registries. Keep the catalog always fresh." />
            <FeatureCard icon={<Activity className="w-6 h-6 text-lime-400" />} title="Health Monitoring" description="Periodic health checks, latency tracking, and automatic degradation handling." />
            <FeatureCard icon={<Cpu className="w-6 h-6 text-amber-400" />} title="Smart Routing" description="Route requests to the best backend based on trust, latency, cost, and health." />
            <FeatureCard icon={<Cloud className="w-6 h-6 text-sky-400" />} title="Cloudflare Native" description="KV, R2, D1, Analytics Engine, Queues and Workers built into the architecture." />
            <FeatureCard icon={<Code className="w-6 h-6 text-violet-400" />} title="MCP Compatible" description="Full MCP JSON-RPC and streamable-http support. Plug into Claude, Windsurf, and more." />
            <FeatureCard icon={<Terminal className="w-6 h-6 text-teal-400" />} title="CLI & SDK" description="Command-line tools and SDKs to connect, discover, and call tools from any environment." />
            <FeatureCard icon={<Bell className="w-6 h-6 text-fuchsia-400" />} title="Alerting" description="Telegram, email, and webhook alerts for errors, budget limits, and health events." />
            <FeatureCard icon={<Workflow className="w-6 h-6 text-blue-400" />} title="Lifecycle Management" description="From DISCOVERED to ACTIVE to DEPRECATED. Governed state transitions for every tool." />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              How it works
            </h2>
            <p className="text-xl text-slate-400">Three steps to MCP nirvana</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard 
              number="1"
              title="Connect"
              description="Point any MCP client at the gateway URL, or register an agent for a programmatic API key."
            />
            <StepCard 
              number="2"
              title="Discover"
              description="Browse 13,000+ indexed MCP tools with trust and security scores. Filter by namespace or intent."
            />
            <StepCard 
              number="3"
              title="Call"
              description="Execute any tool with a single request. Pay per call via Stripe credit or x402 — handled automatically."
            />
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              See it in action
            </h2>
            <p className="text-xl text-slate-400">Real endpoints. Copy, paste, run.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Agent onboarding */}
            <div className="bg-slate-900 rounded-xl p-6 overflow-hidden border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-400 text-sm ml-2">Onboard an agent</span>
              </div>
              <pre className="text-green-400 font-mono text-sm overflow-x-auto">
{`# 1. Register an agent (get agent_id + api_key)
curl -X POST \\
  https://api.metamesh-uga.dev/v1/agent/register \\
  -d '{"name":"my-agent"}'

# 2. Top up balance via Stripe Checkout
curl -X POST \\
  https://api.metamesh-uga.dev/v1/agent/topup \\
  -H "X-Agent-Id: agent_..." \\
  -H "X-Agent-Key: ak_..." \\
  -d '{"amount_usd": 25}'
# -> open checkout_url to pay`}
              </pre>
            </div>

            {/* Tool call */}
            <div className="bg-slate-900 rounded-xl p-6 overflow-hidden border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-400 text-sm ml-2">Discover & call tools</span>
              </div>
              <pre className="text-blue-400 font-mono text-sm overflow-x-auto">
{`# Browse 13,000+ indexed tools
curl https://api.metamesh-uga.dev/v1/tools?limit=20

# Call a tool (debits prepaid balance)
curl -X POST \\
  https://api.metamesh-uga.dev/v1/call \\
  -H "X-Agent-Id: agent_..." \\
  -H "X-Agent-Key: ak_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "example.echo",
    "params": { "message": "hi" }
  }'`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Models Section */}
      <section id="payments" className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950" />
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 glass border border-slate-700 text-slate-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Coins className="w-4 h-4 text-amber-400" />
              Built for the AI Agent Economy
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
              Two ways to <span className="text-gradient">pay per call</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Fund agents with a credit card via Stripe, or settle on-chain with x402 micropayments. Same gateway, same pricing.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Stripe prepaid credit */}
            <div className="glass border border-slate-700 rounded-2xl p-8 hover:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Stripe Prepaid Credit</h3>
                  <p className="text-sm text-slate-500">Fiat · live now</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <PayPoint text="Register an agent and get an API key instantly" />
                <PayPoint text="Top up your USD balance via Stripe Checkout" />
                <PayPoint text="Per-call pricing debited atomically from balance" />
                <PayPoint text="Budgets, spend limits and transaction history" />
              </ul>
              <code className="block bg-slate-950/80 rounded-lg px-4 py-3 text-xs font-mono text-blue-300 border border-slate-800 overflow-x-auto">
                POST /v1/agent/topup &#123; "amount_usd": 25 &#125;
              </code>
            </div>

            {/* x402 crypto */}
            <div className="glass border border-slate-700 rounded-2xl p-8 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">x402 Micropayments</h3>
                  <p className="text-sm text-slate-500">USDC on Base · on-chain</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <PayPoint text="Pay-as-you-go with the HTTP 402 standard" />
                <PayPoint text="EIP-712 signed payments, no account required" />
                <PayPoint text="Settles in USDC on Base via x402 facilitator" />
                <PayPoint text="Ideal for autonomous, walleted AI agents" />
              </ul>
              <code className="block bg-slate-950/80 rounded-lg px-4 py-3 text-xs font-mono text-purple-300 border border-slate-800 overflow-x-auto">
                POST /v1/call  ·  X-PAYMENT: &lt;x402 header&gt;
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Simple pricing
            </h2>
            <p className="text-xl text-slate-400">Start free, scale as you grow</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard 
              name="Free"
              price="$0"
              period="/month"
              description="Perfect for experimentation"
              features={[
                '1,000 calls/month',
                '100 requests/min',
                'Access to 13,147 tools',
                'Community support',
                'Dashboard access'
              ]}
              cta="Get Started"
              popular={false}
            />
            <PricingCard 
              name="Pro"
              price="$19"
              period="/month"
              description="For professional developers"
              features={[
                'Unlimited calls',
                '1,000 requests/min',
                'All 13,147 tools',
                'Priority support',
                'Advanced analytics',
                'Export CSV',
                'Agent marketplace'
              ]}
              cta="Start Pro Trial"
              popular={true}
            />
            <PricingCard 
              name="Enterprise"
              price="$499"
              period="/month"
              description="For teams and businesses"
              features={[
                'Everything in Pro',
                '10,000 requests/min',
                'Dedicated WASM runner',
                '99.9% SLA',
                'Custom categories',
                'SSO integration',
                'Dedicated support'
              ]}
              cta="Contact Sales"
              popular={false}
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4">
            <FAQItem 
              question="What is MCP?"
              answer="MCP (Model Context Protocol) is a protocol for connecting AI assistants to external data and tools. MetaMesh-UGA provides a unified gateway to access all MCP servers without managing individual connections."
            />
            <FAQItem 
              question="How does the free tier work?"
              answer="The free tier includes 1,000 API calls per month with a rate limit of 100 requests per minute. No credit card required. Upgrade anytime to Pro for unlimited calls."
            />
            <FAQItem 
              question="What is x402 and how does it work?"
              answer="x402 is a micropayment protocol (HTTP 402 Payment Required) that enables AI agents to pay for API calls using cryptocurrency (USDC). Agents sign payment requests with EIP-712 signatures."
            />
            <FAQItem 
              question="Is my data secure?"
              answer="Yes. MetaMesh runs on Cloudflare's edge network with enterprise-grade security. All WASM execution is sandboxed. We never store API credentials - they are encrypted in your browser."
            />
            <FAQItem 
              question="Can I self-host MetaMesh?"
              answer="Yes! MetaMesh is open source and can be deployed to your own Cloudflare account. See our self-hosting guide in the documentation."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Ready to get started?
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            Join developers using MetaMesh to access MCP servers
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="#install"
              className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Install Now (Free)
            </a>
            <a 
              href="https://docs.metamesh-uga.dev"
              className="text-slate-400 hover:text-white font-medium"
            >
              Read Documentation →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-6 h-6 text-blue-500" />
                <span className="text-lg font-bold text-white">MetaMesh-UGA</span>
              </div>
              <p className="text-sm">
                The MCP Operating System — A serverless control plane for AI agents and MCP infrastructure.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Changelog</a></li>
                <li><a href="#" className="hover:text-white">Roadmap</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://docs.metamesh-uga.dev" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">API Reference</a></li>
                <li><a href="#" className="hover:text-white">CLI Guide</a></li>
                <li><a href="#" className="hover:text-white">MCP Integration</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Connect</h4>
              <div className="flex gap-4">
                <a href="https://github.com/metamesh-uga" className="hover:text-white">
                  <Github className="w-5 h-5" />
                </a>
                <a href="https://twitter.com/metamesh" className="hover:text-white">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="https://linkedin.com/company/metamesh" className="hover:text-white">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="mailto:hello@metamesh-uga.dev" className="hover:text-white">
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              © 2026 MetaMesh-UGA. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white">Privacy</a>
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">GDPR</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50 transition-all">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string, label: string }) {
  return (
    <div>
      <p className="text-3xl lg:text-4xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-sm mt-1">{label}</p>
    </div>
  );
}

function PayPoint({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-slate-300">
      <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}

function PricingCard({ name, price, period, description, features, cta, popular }: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}) {
  return (
    <div className={`rounded-xl p-8 ${popular ? 'bg-blue-600 text-white ring-4 ring-blue-500/50' : 'bg-slate-950 border border-slate-800'}`}>
      {popular && (
        <div className="inline-block bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
          Most Popular
        </div>
      )}
      <h3 className={`text-lg font-semibold mb-2 ${popular ? 'text-white' : 'text-white'}`}>{name}</h3>
      <div className="mb-4">
        <span className={`text-4xl font-bold ${popular ? 'text-white' : 'text-white'}`}>{price}</span>
        <span className={popular ? 'text-blue-100' : 'text-slate-500'}>{period}</span>
      </div>
      <p className={`text-sm mb-6 ${popular ? 'text-blue-100' : 'text-slate-400'}`}>{description}</p>
      
      <ul className="space-y-3 mb-8">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            <Check className={`w-4 h-4 ${popular ? 'text-blue-200' : 'text-green-400'}`} />
            <span className={popular ? 'text-blue-50' : 'text-slate-300'}>{feature}</span>
          </li>
        ))}
      </ul>
      
      <button className={`w-full py-3 rounded-lg font-semibold transition-colors ${
        popular 
          ? 'bg-white text-blue-600 hover:bg-blue-50' 
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}>
        {cta}
      </button>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800">
      <button 
        className="w-full px-6 py-4 flex items-center justify-between text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-semibold text-white">{question}</span>
        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-6 pb-4">
          <p className="text-slate-400">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default App;
