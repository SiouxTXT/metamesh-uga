import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wrench, BarChart3, CreditCard, Bot, Menu, X, Network } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tools', icon: Wrench, label: 'Tools' },
    { path: '/usage', icon: BarChart3, label: 'Usage' },
    { path: '/billing', icon: CreditCard, label: 'Billing' },
    { path: '/agent', icon: Bot, label: 'Agent' }
  ];

  const Brand = () => (
    <Link to="/" className="flex items-center gap-2.5 group">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
          <Network className="w-5 h-5 text-white" />
        </div>
      </div>
      <span className="text-lg font-extrabold tracking-tight text-gradient">MetaMesh-UGA</span>
    </Link>
  );

  return (
    <div className="min-h-screen app-bg text-slate-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 glass border-r border-slate-800/60 hidden lg:flex lg:flex-col">
        <div className="flex items-center h-16 px-5 border-b border-slate-800/60">
          <Brand />
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-blue-600/20 to-violet-600/10 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-blue-400 to-violet-500" />}
                <item.icon className={`w-[18px] h-[18px] ${active ? 'text-blue-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800/60">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-300">Gateway Online</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 px-1">api.metamesh-uga.dev</p>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden glass border-b border-slate-800/60 sticky top-0 z-40">
        <div className="flex items-center justify-between h-16 px-4">
          <Brand />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="px-4 pb-4 space-y-1.5">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    active ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 p-6 lg:p-8 max-w-7xl animate-fade-in">
        {children}
      </main>
    </div>
  );
}
