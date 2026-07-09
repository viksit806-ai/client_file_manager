'use client';
import { useState, useEffect, useMemo } from 'react';
import { customerAPI } from '@/lib/api';
import { formatDateTime, formatFileSize } from '@/lib/utils';
import { toast } from 'sonner';
import { FileText, Download, Filter, Search, X } from 'lucide-react';
import PaymentModal from '@/components/customer/PaymentModal';
import Pagination from '@/components/ui/Pagination';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function CustomerResponsesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [blockedDoc, setBlockedDoc] = useState(null);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [filterCat, setFilterCat] = useState(() => searchParams.get('category') || '');
  const [page, setPage] = useState(() => parseInt(searchParams.get('page')) || 1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterCat) params.set('category', filterCat);
    
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [search, filterCat, pathname, router]);


  useEffect(() => {
    customerAPI.getResponses({ page, limit: 10 })
      .then(res => {
        setDocs(res.data.data || []);
        if (res.data.pagination) {
          setPages(res.data.pagination.pages);
        }
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load responses'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [search, filterCat]);

  const fileCategories = useMemo(() => {
    const cats = new Set();
    docs.forEach(d => { if (d.fileCategoryId?.name) cats.add(d.fileCategoryId.name); });
    return Array.from(cats).sort();
  }, [docs]);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (search && !(d.title || d.originalName || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat && d.fileCategoryId?.name !== filterCat) return false;
      return true;
    });
  }, [docs, search, filterCat]);

  const handleDownload = async (doc) => {
    if (doc.paymentBlocked || doc.status === 'blocked') {
      setBlockedDoc(doc);
      setShowPaymentModal(true);
      return;
    }
    try {
      const res = await customerAPI.downloadDocument(doc._id, 'submission');
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed');
    }
  };

  if (loading) return <div className="animate-pulse space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-blue-50 rounded-lg" />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Response Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Documents uploaded by departments in response to your requests</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 outline-none bg-white"
          >
            <option value="">All Categories</option>
            {fileCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <span className="text-xs text-gray-400">{filtered.length} of {docs.length} documents</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400 gap-2">
          <FileText className="w-12 h-12 text-gray-300" />
          <p className="text-sm font-medium">No response documents found</p>
          <p className="text-xs">When a department uploads a document in response to your request, it will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b bg-blue-50 text-blue-900 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">Document</th>
                  <th className="py-3 px-4 font-semibold">File Category</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Notes</th>
                  <th className="py-3 px-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(doc => (
                  <tr key={doc._id} className="hover:bg-blue-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="font-medium text-gray-800 truncate max-w-[200px]">{doc.title || doc.originalName}</span>
                        {doc.paymentBlocked && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 uppercase">Blocked</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs">
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">{doc.fileCategoryId?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{doc.departmentId?.name || '-'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{formatDateTime(doc.createdAt)}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs max-w-[150px] truncate">{doc.notes || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-1.5 bg-blue-50 border border-blue-200 rounded text-blue-700 hover:bg-blue-100 transition"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {pages > 1 && <div className="mt-4"><Pagination page={page} pages={pages} onPageChange={setPage} /></div>}
      {showPaymentModal && <PaymentModal onClose={() => setShowPaymentModal(false)} document={blockedDoc} />}
    </div>
  );
}
