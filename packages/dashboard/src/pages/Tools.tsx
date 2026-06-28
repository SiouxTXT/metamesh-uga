import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Wrench, Shield, Star, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE = 'https://api.metamesh-uga.dev';
const PAGE_SIZE = 24;

interface Tool {
  name: string;
  version: string;
  category: string;
  description: string;
  popularity_score: number;
  trust_score: number;
  security_score: number;
  state: string;
}

export function Tools() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: toolsData, isLoading, isFetching } = useQuery({
    queryKey: ['tools', debouncedSearch, category, page],
    queryFn: async () => {
      if (debouncedSearch) {
        const res = await fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(debouncedSearch)}`);
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();
        return { tools: json.results || [], total: json.total || 0, isSearch: true };
      }
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        sort: 'popularity'
      });
      if (category) params.set('category', category);
      const res = await fetch(`${API_BASE}/v1/tools?${params}`);
      if (!res.ok) throw new Error('Failed to load tools');
      const json = await res.json();
      return { tools: json.tools || [], total: json.total || 0, isSearch: false };
    },
    staleTime: 30000
  });

  const { data: categories } = useQuery({
    queryKey: ['tool-categories'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/tools?limit=200`);
      if (!res.ok) return [];
      const json = await res.json();
      const cats = [...new Set((json.tools || []).map((t: Tool) => t.category).filter(Boolean))] as string[];
      return cats.sort();
    },
    staleTime: 300000
  });

  const tools = toolsData?.tools || [];
  const total = toolsData?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const scoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Available Tools</h1>
          <p className="text-sm text-slate-400 mt-1">{total} tools in the registry</p>
        </div>
        {isFetching && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, description, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(0); }}
          className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {(categories || []).map((c: string) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Tools Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : tools.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No tools found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool: Tool) => (
            <div
              key={tool.name}
              className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-slate-600 transition-colors flex flex-col"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Wrench className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-center gap-2">
                  {tool.state && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tool.state === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                    }`}>{tool.state}</span>
                  )}
                  {tool.version && (
                    <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded">v{tool.version}</span>
                  )}
                </div>
              </div>
              <h3 className="font-semibold text-white mt-3 text-sm leading-snug">{tool.name}</h3>
              <p className="text-xs text-slate-400 mt-1 flex-1 line-clamp-2">{tool.description || 'No description available.'}</p>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 capitalize bg-slate-800 px-2 py-0.5 rounded">{tool.category}</span>
                <div className="flex items-center gap-3">
                  {tool.trust_score != null && (
                    <span className={`flex items-center gap-1 ${scoreColor(tool.trust_score)}`}>
                      <Star className="w-3 h-3" />{(tool.trust_score * 100).toFixed(0)}%
                    </span>
                  )}
                  {tool.security_score != null && (
                    <span className={`flex items-center gap-1 ${scoreColor(tool.security_score)}`}>
                      <Shield className="w-3 h-3" />{(tool.security_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!toolsData?.isSearch && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-slate-400 text-sm">Page {page + 1} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-700 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
