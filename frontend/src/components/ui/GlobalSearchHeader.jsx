'use client';
import { useState, useEffect, useRef } from 'react';
import { searchAPI } from '@/lib/api';
import { Search, X, FileText, User as UserIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function GlobalSearchHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ customers: [], documents: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ customers: [], documents: [] });
      setLoading(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await searchAPI.globalSearch(query, { signal: controller.signal });
        if (!controller.signal.aborted && res.data.success) {
          setResults(res.data.data);
        }
      } catch (err) {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          console.error('Global search error:', err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounce);
    };
  }, [query]);

  const handleSelectResult = (item, type) => {
    setQuery('');
    setOpen(false);
    
    if (type === 'customer') {
      router.push(`/department/customers/${item._id}`);
    } else if (type === 'document') {
      const custId = item.customerId?._id || item.customerId;
      if (user.role === 'department') {
        router.push(`/department/customers/${custId}?selectFile=${item._id}`);
      } else if (user.role === 'customer') {
        router.push(`/customer/documents?selectFile=${item._id}`);
      }
    }
  };

  const hasResults = results.customers?.length > 0 || results.documents?.length > 0;

  return (
    <div ref={containerRef} className="relative w-64 md:w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Global search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full bg-slate-100 hover:bg-slate-200/60 focus:bg-white text-slate-700 text-xs pl-9 pr-8 py-1.5 rounded-lg border border-transparent focus:border-blue-500/80 outline-none transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults({ customers: [], documents: [] });
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (query.trim() || loading) && (
        <div className="absolute right-0 mt-1.5 w-full bg-white rounded-xl shadow-lg border border-slate-200/60 z-50 overflow-hidden max-h-96 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-xs">Searching...</span>
            </div>
          ) : !hasResults ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              No matches found
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-slate-100 max-h-80">
              {results.customers?.length > 0 && (
                <div className="p-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">Customers</span>
                  {results.customers.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => handleSelectResult(c, 'customer')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-left transition"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{c.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.documents?.length > 0 && (
                <div className="p-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">Documents</span>
                  {results.documents.map((d) => (
                    <button
                      key={d._id}
                      onClick={() => handleSelectResult(d, 'document')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-left transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{d.title || d.originalName}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {d.departmentId?.name || 'General'} • {d.direction === 'submission' ? 'Submission' : 'Response'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
