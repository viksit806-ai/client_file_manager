'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { customerAPI } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';
import SlaBadge from '@/components/ui/SlaBadge';
import Modal from '@/components/ui/Modal';
import { formatDateTime, formatFileSize, getSlaStatus } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Pagination from '@/components/ui/Pagination';
import {
  Download,
  Lock,
  CheckCircle,
  Folder,
  File,
  ChevronRight,
  LayoutGrid,
  List,
  Columns,
  Info,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  X,
  FileText,
  Search,
  Monitor,
  HardDrive,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function CustomerDocumentsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'columns'
  
  // Navigation stack state
  const [currentPath, setCurrentPath] = useState([]); // [{ id, name, type }]
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [quickLookItem, setQuickLookItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [page, setPage] = useState(() => parseInt(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(() => parseInt(searchParams.get('limit')) || 10);
  const [pages, setPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const panelRef = useRef(null);
  const isResizing = useRef(false);
  const [panelWidth, setPanelWidth] = useState(300);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      const container = panelRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setPanelWidth(Math.max(220, Math.min(520, rect.right - e.clientX)));
    };
    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const loadData = useCallback(() => {
    setLoading(true);
    customerAPI.getDocuments({
      page,
      limit,
      search: searchQuery,
    })
      .then(res => {
        setDocuments(res.data.data);
        if (res.data.pagination) {
          setPages(res.data.pagination.pages);
          setTotalDocs(res.data.pagination.total);
        } else {
          setPages(1);
          setTotalDocs(res.data.data.length);
        }
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [page, limit, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (page > 1) params.set('page', page.toString());
    if (limit !== 10) params.set('limit', limit.toString());
    
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchQuery, page, limit, pathname, router]);

  useEffect(() => {
    if (selectedItem && (selectedItem.type === 'submission' || selectedItem.type === 'result')) {
      const isDeleted = selectedItem.type === 'result'
        ? selectedItem.doc?.resultFileDeletedFromStorage
        : selectedItem.doc?.fileDeletedFromStorage;
      
      const isBlocked = selectedItem.type === 'result' && selectedItem.doc?.paymentBlocked;
      
      if (isDeleted || isBlocked) {
        setPreviewUrl(null);
        return;
      }

      setLoadingPreview(true);
      setPreviewUrl(null);

      customerAPI.downloadDocument(selectedItem.doc?._id || selectedItem.id, selectedItem.type)
        .then(res => {
          const blob = new Blob([res.data], { type: selectedItem.mimeType || res.headers['content-type'] });
          const url = window.URL.createObjectURL(blob);
          setPreviewUrl(url);
        })
        .catch(err => {
          console.error('Failed to load preview:', err);
          setPreviewUrl(null);
        })
        .finally(() => {
          setLoadingPreview(false);
        });
    } else {
      setPreviewUrl(null);
    }

    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [selectedItem]);

  // Spacebar Quick Look hotkey
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space' && selectedItem) {
        e.preventDefault();
        setQuickLookItem(prev => prev ? null : selectedItem);
      }
      if (e.key === 'Escape') {
        if (quickLookItem) setQuickLookItem(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedItem, quickLookItem]);

  const handleDownload = async (doc, type) => {
    if (type === 'result' && doc.paymentBlocked) {
      setShowPaymentModal(true);
      return;
    }
    try {
      const res = await customerAPI.downloadDocument(doc._id, type);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'result' ? (doc.resultFile?.originalName || 'result') : doc.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed');
    }
  };

  const navigateToPath = useCallback((newPath) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newPath);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setCurrentPath(newPath);
    setSelectedItem(null);
  }, [history, historyIndex]);

  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setCurrentPath(history[idx]);
      setSelectedItem(null);
    }
  }, [historyIndex, history]);

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      setCurrentPath(history[idx]);
      setSelectedItem(null);
    }
  }, [historyIndex, history]);

  const handleUp = useCallback(() => {
    if (currentPath.length > 0) {
      navigateToPath(currentPath.slice(0, -1));
    }
  }, [currentPath, navigateToPath]);

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 dark:bg-slate-800 rounded-2xl" />;

  const getGroupStatus = (groupDocs) => {
    if (groupDocs.some(d => d.paymentBlocked || d.status === 'blocked')) return 'blocked';
    if (groupDocs.every(d => d.status === 'completed')) return 'completed';
    if (groupDocs.some(d => d.status === 'processing')) return 'processing';
    return 'pending';
  };

  const groupedByDept = {};
  for (const doc of documents) {
    const deptId = doc.departmentId?._id || 'general';
    const deptName = doc.departmentId?.name || 'General';
    if (!groupedByDept[deptId]) {
      groupedByDept[deptId] = { id: deptId, name: deptName, docs: [] };
    }
    groupedByDept[deptId].docs.push(doc);
  }

  const sidebarDepts = Object.values(groupedByDept);
  const isSearching = searchQuery.trim() !== '';
  const searchResults = documents.filter(d =>
    d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  let explorerItems = [];
  const currentDepth = currentPath.length;

  if (currentDepth === 0) {
    explorerItems = Object.values(groupedByDept).map(dept => ({
      id: dept.id,
      name: dept.name,
      type: 'dept',
      itemCount: dept.docs.length,
      docs: dept.docs
    }));
  } else if (currentDepth === 1) {
    const activeDeptId = currentPath[0].id;
    const deptData = groupedByDept[activeDeptId];
    if (deptData) {
      const groups = {};
      for (const d of deptData.docs) {
        const key = d.groupId || d._id;
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
      }
      explorerItems = Object.entries(groups).map(([groupId, groupDocs]) => {
        const firstDoc = groupDocs[0];
        return {
          id: groupId,
          name: firstDoc.customGroupName || formatDateTime(firstDoc.createdAt),
          type: 'request',
          itemCount: groupDocs.length,
          status: getGroupStatus(groupDocs),
          slaStatus: getSlaStatus(firstDoc.createdAt, getGroupStatus(groupDocs)),
          docs: groupDocs
        };
      });
    }
  } else if (currentDepth === 2) {
    const activeDeptId = currentPath[0].id;
    const activeGroupId = currentPath[1].id;
    const deptData = groupedByDept[activeDeptId];
    if (deptData) {
      const groupDocs = deptData.docs.filter(d => (d.groupId || d._id) === activeGroupId && !d.isPlaceholder && d.storedPath);
      for (const d of groupDocs) {
        explorerItems.push({
          id: d._id,
          name: d.title || d.originalName,
          type: 'submission',
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          status: d.status,
          createdAt: d.createdAt,
          doc: d
        });
        if (d.resultFile) {
          explorerItems.push({
            id: `${d._id}_result`,
            name: `Result_${d.resultFile.originalName}`,
            type: 'result',
            fileSize: d.resultFile.fileSize,
            mimeType: d.mimeType,
            status: d.status,
            createdAt: d.resultFile.uploadedAt,
            doc: d
          });
        }
      }
    }
  }

  const handleItemDoubleClick = (item) => {
    if (item.type === 'dept') {
      navigateToPath([{ id: item.id, name: item.name, type: 'dept' }]);
    } else if (item.type === 'request') {
      navigateToPath([currentPath[0], { id: item.id, name: item.name, type: 'request' }]);
    } else if (item.type === 'submission' || item.type === 'result') {
      setQuickLookItem(item);
    }
  };

  const handleSidebarDeptClick = (dept) => {
    setSearchQuery('');
    const folderItem = { id: dept.id, name: dept.name, type: 'dept', itemCount: dept.itemCount, docs: dept.docs };
    navigateToPath([{ id: dept.id, name: dept.name, type: 'dept' }]);
    setSelectedItem(folderItem);
  };

  const panelClassName = 'bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full p-4 overflow-y-auto flex flex-col gap-4 relative shadow-sm ' + (isMobile
    ? 'fixed inset-y-0 right-0 z-50 w-[85vw] max-w-sm transition-transform duration-300 ' + (selectedItem ? 'translate-x-0' : 'translate-x-full')
    : 'shrink-0 ' + (selectedItem ? 'opacity-100' : 'lg:opacity-90 lg:block hidden'));

  return (
    <div className="flex flex-col -m-6 h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-[#0b0f19] select-none overflow-hidden font-sans">
      
      {/* Header Toolbar */}
      <div className="h-13 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-1.5">
          <button onClick={handleBack} disabled={historyIndex === 0} className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition"><ArrowLeft className="w-4 h-4 stroke-[2.2]" /></button>
          <button onClick={handleForward} disabled={historyIndex === history.length - 1} className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition"><ArrowRight className="w-4 h-4 stroke-[2.2]" /></button>
          <button onClick={handleUp} disabled={currentPath.length === 0} className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition"><ArrowUp className="w-4 h-4 stroke-[2.2]" /></button>
        </div>

        {/* Breadcrumb Path Bar */}
        <div className="flex-1 max-w-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl h-8 flex items-center px-3 overflow-x-auto whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 gap-1.5 scrollbar-none font-medium">
          <HardDrive className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <button onClick={() => navigateToPath([])} className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition">My Documents</button>
          {currentPath.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              <button onClick={() => navigateToPath(currentPath.slice(0, idx + 1))} className={`hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[140px] transition ${idx === currentPath.length - 1 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>{item.name}</button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-44 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-8 flex items-center px-2.5 shrink-0 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-blue-500 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none text-xs ml-1.5 outline-none text-slate-700 dark:text-slate-200" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400"><X className="w-3 h-3" /></button>}
          </div>

          {!isSearching && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`} title="Grid"><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`} title="List"><List className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode('columns')} className={`p-1.5 rounded-lg transition ${viewMode === 'columns' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`} title="Columns"><Columns className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-row flex-1 overflow-hidden">
        <div className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full overflow-y-auto shrink-0 flex flex-col p-3 text-xs text-slate-700 dark:text-slate-300 select-none">
          <div className="mb-4">
            <span className="font-bold text-slate-400 dark:text-slate-500 block px-2 mb-2 uppercase text-[9px] tracking-wider">Quick Access</span>
            <button onClick={() => navigateToPath([])} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition ${currentPath.length === 0 && !isSearching ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Monitor className={`w-4 h-4 ${currentPath.length === 0 && !isSearching ? 'text-white' : 'text-blue-500'}`} />
              <span>All Folders</span>
            </button>
          </div>

          <div>
            <span className="font-bold text-slate-400 dark:text-slate-500 block px-2 mb-2 uppercase text-[9px] tracking-wider">Departments</span>
            <div className="space-y-0.5">
              {sidebarDepts.map(dept => {
                const isActive = currentPath.length > 0 && currentPath[0].id === dept.id && !isSearching;
                return (
                  <button key={dept.id} onClick={() => handleSidebarDeptClick(dept)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition ${isActive ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <Folder className={`w-4 h-4 ${isActive ? 'text-white fill-white' : 'text-blue-500 fill-blue-500/20'}`} />
                    <span className="truncate">{dept.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Files View */}
        <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 h-full p-4 flex flex-col overflow-hidden relative">
          {isSearching ? (
            <div className="space-y-2 flex-1 overflow-y-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Matches ({searchResults.length})</span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-800 font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                      <th className="py-2.5 px-3" onClick={() => handleHeaderClick('name')}>Name</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {searchResults.map((d) => (
                      <tr key={d._id} onClick={() => setSelectedItem({ id: d._id, name: d.title || d.originalName, type: 'submission', doc: d })} className={`cursor-pointer transition ${selectedItem?.id === d._id ? 'bg-blue-600 text-white font-medium rounded-xl' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-gray-200'}`}>
                        <td className="py-2.5 px-3 flex items-center gap-2 max-w-xs"><FileText className={`w-4 h-4 shrink-0 ${selectedItem?.id === d._id ? 'text-white' : 'text-blue-500'}`} /><span className="truncate">{d.title || d.originalName}</span></td>
                        <td className={`py-2.5 px-3 ${selectedItem?.id === d._id ? 'text-white' : 'text-gray-500'}`}>{formatFileSize(d.fileSize)}</td>
                        <td className="py-2.5 px-3 text-center"><StatusBadge status={d.paymentBlocked ? 'blocked' : d.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto min-h-0">
                {explorerItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-24 text-slate-400 gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      <Folder className="w-8 h-8 text-blue-500 fill-blue-500/20" />
                    </div>
                    <div><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Folder is empty</p></div>
                    <Link href="/customer/upload" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-xs">Upload New Document</Link>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-2">
                    {explorerItems.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const isFolder = item.type === 'dept' || item.type === 'request';
                      return (
                        <div key={item.id} onClick={() => setSelectedItem(item)} onDoubleClick={() => handleItemDoubleClick(item)} className={`flex flex-col items-center text-center p-3.5 rounded-2xl cursor-pointer transition-all select-none group ${isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]' : 'bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80 text-gray-700 dark:text-gray-200'}`}>
                          {isFolder ? (
                            <div className="relative mb-2"><Folder className={`w-14 h-14 transition-transform group-hover:scale-105 ${isSelected ? 'text-white fill-white/20' : 'text-blue-500 fill-blue-500/20'}`} /><span className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-xs ${isSelected ? 'bg-white text-blue-600 border-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>{item.itemCount}</span></div>
                          ) : (
                            <div className="relative mb-2"><FileText className={`w-14 h-14 ${isSelected ? 'text-white' : 'text-blue-600'}`} /></div>
                          )}
                          <span className="text-xs font-semibold truncate w-full px-1" title={item.name}>{item.name}</span>
                          <div className="mt-1 flex items-center gap-1">{item.status && <StatusBadge status={item.status} size="sm" />}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : viewMode === 'list' ? (
                  <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer">
                          <th className="py-2.5 px-3" onClick={() => handleHeaderClick('name')}>Name</th>
                          <th className="py-2.5 px-3" onClick={() => handleHeaderClick('type')}>Kind</th>
                          <th className="py-2.5 px-3" onClick={() => handleHeaderClick('size')}>Size</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {explorerItems.map((item) => {
                          const isSelected = selectedItem?.id === item.id;
                          const isFolder = item.type === 'dept' || item.type === 'request';
                          return (
                            <tr key={item.id} onClick={() => setSelectedItem(item)} onDoubleClick={() => handleItemDoubleClick(item)} className={`cursor-pointer transition ${isSelected ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'}`}>
                              <td className="py-2.5 px-3 flex items-center gap-2.5 max-w-sm">{isFolder ? <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white fill-white' : 'text-blue-500 fill-blue-500/20'}`} /> : <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />}<span className="truncate" title={item.name}>{item.name}</span></td>
                              <td className={`py-2.5 px-3 capitalize ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>{item.type}</td>
                              <td className={`py-2.5 px-3 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>{isFolder ? `${item.itemCount} items` : formatFileSize(item.fileSize)}</td>
                              <td className="py-2.5 px-3 text-center">{item.status ? <StatusBadge status={item.status} size="sm" /> : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-row h-full overflow-x-auto divide-x divide-slate-200 dark:divide-slate-800 border rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="w-56 shrink-0 h-full overflow-y-auto p-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Departments</span>
                      {sidebarDepts.map(d => {
                        const isSel = currentPath.length > 0 && currentPath[0].id === d.id;
                        return (<div key={d.id} onClick={() => handleSidebarDeptClick(d)} className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${isSel ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><div className="flex items-center gap-2 truncate"><Folder className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-500'}`} /><span className="truncate">{d.name}</span></div><ChevronRight className={`w-3 h-3 ${isSel ? 'text-white' : 'text-slate-400'}`} /></div>);
                      })}
                    </div>
                    <div className="w-64 shrink-0 h-full overflow-y-auto p-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Contents</span>
                      {explorerItems.map(item => {
                        const isSel = selectedItem?.id === item.id;
                        const isFolder = item.type === 'dept' || item.type === 'request';
                        return (<div key={item.id} onClick={() => setSelectedItem(item)} onDoubleClick={() => handleItemDoubleClick(item)} className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${isSel ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><div className="flex items-center gap-2 truncate">{isFolder ? <Folder className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-500'}`} /> : <FileText className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-600'}`} />}<span className="truncate">{item.name}</span></div>{isFolder && <ChevronRight className={`w-3 h-3 ${isSel ? 'text-white' : 'text-slate-400'}`} />}</div>);
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Rows:</span>
                  <select value={limit} onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }} className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select>
                </div>
                <Pagination page={page} pages={pages} onPageChange={setPage} />
              </div>
            </div>
          )}
        </div>

        {!isMobile && <div className="w-1 cursor-col-resize shrink-0 bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 transition-colors" onMouseDown={handleResizeStart} />}

        {/* Right Inspector Details Panel */}
        <div ref={panelRef} style={isMobile ? undefined : { width: panelWidth }} className={panelClassName}>
          {selectedItem ? (
            <div className="flex flex-col h-full gap-4 overflow-y-auto scrollbar-none pr-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">File Details</span>
                <button onClick={() => setSelectedItem(null)} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-xs">
                {selectedItem.type === 'submission' || selectedItem.type === 'result' ? (
                  <FileText className="w-16 h-16 text-blue-600" />
                ) : (
                  <Folder className="w-16 h-16 text-blue-500 fill-blue-500/20" />
                )}
                <button onClick={() => setQuickLookItem(selectedItem)} className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs">
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  <span>Preview</span>
                </button>
              </div>

              <div className="space-y-3 text-xs border-t border-slate-200 dark:border-slate-800 pt-4">
                <div><span className="text-slate-400 block font-semibold text-[10px] uppercase">Name</span><span className="text-slate-900 dark:text-white font-bold break-all flex-1 text-sm">{selectedItem.name}</span></div>
                <div><span className="text-slate-400 block font-semibold text-[10px] uppercase">Kind</span><span className="text-slate-700 dark:text-slate-300 capitalize font-medium">{selectedItem.type}</span></div>
                {selectedItem.fileSize && <div><span className="text-slate-400 block font-semibold text-[10px] uppercase">Size</span><span className="text-slate-700 dark:text-slate-300 font-medium">{formatFileSize(selectedItem.fileSize)}</span></div>}
                {selectedItem.status && <div><span className="text-slate-400 block font-semibold text-[10px] uppercase mb-1">Status</span><StatusBadge status={selectedItem.status} /></div>}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto space-y-2">
                {(selectedItem.type === 'dept' || selectedItem.type === 'request') && (
                  <button onClick={() => handleItemDoubleClick(selectedItem)} className="w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-xs transition">Open Folder</button>
                )}
                {(selectedItem.type === 'submission' || selectedItem.type === 'result') && selectedItem.doc && (
                  <button onClick={() => handleDownload(selectedItem.doc, selectedItem.type)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition">
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 gap-2 py-12">
              <Info className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-semibold">Select an item to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Preview Modal Overlay */}
      {quickLookItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="h-12 px-5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <span className="font-bold text-sm text-slate-800 dark:text-white truncate">{quickLookItem.name}</span>
              </div>
              <button onClick={() => setQuickLookItem(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-center gap-4">
              <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800">
                <FileText className="w-24 h-24 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-white">{quickLookItem.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{quickLookItem.fileSize ? formatFileSize(quickLookItem.fileSize) : 'Folder Batch'}</p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">ESC</kbd> to close preview</span>
              {quickLookItem.doc && (
                <button onClick={() => handleDownload(quickLookItem.doc, quickLookItem.type)} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Blocked Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Payment Required">
        <div className="space-y-4 py-2">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto"><Lock className="w-6 h-6" /></div>
          <div className="text-center">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Document Locked</h3>
            <p className="text-xs text-gray-500 mt-1">Payment is pending for this completed work. Please complete payment or contact your CA firm to release the file.</p>
          </div>
          <button onClick={() => setShowPaymentModal(false)} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-xs hover:bg-blue-700 transition">Understood</button>
        </div>
      </Modal>
    </div>
  );
}
