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
  Info,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  X,
  FileText,
  Search,
  Monitor,
  HardDrive,
} from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function CustomerDocumentsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  // Navigation stack state
  const [currentPath, setCurrentPath] = useState([]); // [{ id, name, type }]
  const [history, setHistory] = useState([[]]); // History stack
  const [historyIndex, setHistoryIndex] = useState(0); // Current pointer
  
  const [selectedItem, setSelectedItem] = useState(null); // selected folder or file
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
  const [panelWidth, setPanelWidth] = useState(288);
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
      setPanelWidth(Math.max(200, Math.min(500, rect.right - e.clientX)));
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
      .catch(console.error)
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

  useEffect(() => {
    if (selectedItem && (selectedItem.type === 'submission' || selectedItem.type === 'result')) {
      const item = {
        id: selectedItem.id,
        name: selectedItem.name,
        path: `/customer/documents?search=${searchQuery}&selectFile=${selectedItem.id}`,
        time: Date.now()
      };
      let items = JSON.parse(localStorage.getItem('recent_customer') || '[]');
      items = items.filter(i => i.id !== selectedItem.id);
      items.unshift(item);
      items = items.slice(0, 5);
      localStorage.setItem('recent_customer', JSON.stringify(items));
    }
  }, [selectedItem, searchQuery]);

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

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') { e.preventDefault(); handleUp(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); handleBack(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); handleForward(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUp, handleBack, handleForward]);

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };



  if (loading) return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;

  // Helper to calculate request status from group files
  const getGroupStatus = (groupDocs) => {
    if (groupDocs.some(d => d.paymentBlocked || d.status === 'blocked')) return 'blocked';
    if (groupDocs.every(d => d.status === 'completed')) return 'completed';
    if (groupDocs.some(d => d.status === 'processing')) return 'processing';
    return 'pending';
  };

  // Group all documents by department first
  const groupedByDept = {};
  for (const doc of documents) {
    const deptId = doc.departmentId?._id || 'general';
    const deptName = doc.departmentId?.name || 'General';
    if (!groupedByDept[deptId]) {
      groupedByDept[deptId] = {
        id: deptId,
        name: deptName,
        docs: []
      };
    }
    groupedByDept[deptId].docs.push(doc);
  }

  // Get customer departments list for sidebar
  const sidebarDepts = Object.values(groupedByDept);

  // Filter documents inside search if query exists
  const isSearching = searchQuery.trim() !== '';
  const searchResults = documents.filter(d =>
    d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Folder path items resolution
  let explorerItems = [];
  const currentDepth = currentPath.length;

  if (currentDepth === 0) {
    // Root level: Show department folders
    explorerItems = Object.values(groupedByDept).map(dept => ({
      id: dept.id,
      name: dept.name,
      type: 'dept',
      itemCount: dept.docs.length,
      docs: dept.docs
    }));
  } else if (currentDepth === 1) {
    // Inside Department folder: Show Request folders
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
    // Inside Request Folder: Show individual files (submissions & results)
    const activeDeptId = currentPath[0].id;
    const activeGroupId = currentPath[1].id;
    const deptData = groupedByDept[activeDeptId];
    if (deptData) {
      const groupDocs = deptData.docs.filter(d => (d.groupId || d._id) === activeGroupId && !d.isPlaceholder && d.storedPath);
      for (const d of groupDocs) {
        // Submission file
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
        // Result file
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
    }
  };

  const handleSidebarDeptClick = (dept) => {
    setSearchQuery('');
    const folderItem = {
      id: dept.id,
      name: dept.name,
      type: 'dept',
      itemCount: dept.itemCount,
      docs: dept.docs
    };
    navigateToPath([{ id: dept.id, name: dept.name, type: 'dept' }]);
    setSelectedItem(folderItem);
  };

  const panelClassName = 'bg-white border-l border-[#e5e7eb] h-full p-4 overflow-y-auto flex flex-col gap-4 relative ' + (isMobile
    ? 'fixed inset-y-0 right-0 z-50 w-[85vw] max-w-sm shadow-xl transition-transform duration-300 ' + (selectedItem ? 'translate-x-0' : 'translate-x-full')
    : 'shrink-0 ' + (selectedItem ? 'opacity-100' : 'lg:opacity-90 lg:block hidden bg-white'));

  return (
    <>
    <div className="flex flex-col -m-6 h-screen bg-white select-none overflow-hidden">
      
      {/* Top Address & Action Bar */}
      <div className="h-12 bg-white border-b border-[#e5e7eb] flex items-center px-3 justify-between gap-3 shrink-0">
        
        {/* Navigation arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            disabled={historyIndex === 0}
            className="p-1 text-gray-700 hover:bg-blue-50 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={handleForward}
            disabled={historyIndex === history.length - 1}
            className="p-1 text-gray-700 hover:bg-blue-50 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={handleUp}
            disabled={currentPath.length === 0}
            className="p-1 text-gray-700 hover:bg-blue-50 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
            title="Up to Parent Folder"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Address Bar Breadcrumbs */}
        <div className="flex-1 max-w-2xl bg-white border border-[#e5e7eb] rounded-md h-8 flex items-center px-2.5 overflow-x-auto whitespace-nowrap text-xs text-gray-600 gap-1 scrollbar-none font-medium">
          <HardDrive className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-400 font-bold">This PC</span>
          <ChevronRight className="w-3 h-3 text-gray-300" />
          
          <button
            onClick={() => navigateToPath([])}
            className="hover:text-blue-600 font-bold"
          >
            My Documents
          </button>
          {currentPath.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <button
                onClick={() => navigateToPath(currentPath.slice(0, idx + 1))}
                className={`hover:text-blue-600 truncate max-w-[120px] ${idx === currentPath.length - 1 ? 'text-gray-800 font-semibold' : ''}`}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search Bar Input */}
        <div className="relative w-48 bg-white border border-[#e5e7eb] rounded-md h-8 flex items-center px-2.5 shrink-0">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search request..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-xs ml-1.5 outline-none text-gray-700"
          />
          {isSearching && (
            <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-[#e5e7eb] rounded-full text-gray-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Sort Dropdown Selector */}
        <div className="flex items-center gap-1 border rounded bg-white p-0.5 shrink-0 text-xs text-gray-700">
          <span className="px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="bg-white rounded px-1.5 py-0.5 outline-none text-[11px] border border-gray-200"
          >
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="size">Size</option>
            <option value="status">Status</option>
            <option value="date">Date Modified</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-1 bg-white hover:bg-blue-50 rounded text-gray-600 font-bold text-[10px] w-6 text-center"
            title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
          >
            {sortOrder === 'asc' ? '▲' : '▼'}
          </button>
        </div>

          {/* Layout Mode Toggles */}
          {!isSearching && (
            <div className="flex border rounded bg-white p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

      {/* Workspace Area split into Sidebar, Files List, Details */}
      <div className="flex flex-row flex-1 overflow-hidden">
        
        {/* Left Tree Directory Sidebar */}
        <div className="w-52 bg-white border-r border-[#e5e7eb] h-full overflow-y-auto shrink-0 flex flex-col p-2 text-xs text-gray-700">
          {/* Quick Access Block */}
          <div className="mb-4">
            <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Quick Access</span>
            <button
              onClick={() => navigateToPath([])}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${currentPath.length === 0 && !isSearching ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none' : 'hover:bg-blue-50'}`}
            >
              <Monitor className="w-3.5 h-3.5 text-blue-500" />
              <span>My Documents</span>
            </button>
          </div>

          {/* Department List Folder Tree */}
          <div>
            <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Departments</span>
            <div className="space-y-0.5">
              {sidebarDepts.map(dept => {
                const isActive = currentPath.length > 0 && currentPath[0].id === dept.id && !isSearching;
                return (
                  <button
                    key={dept.id}
                    onClick={() => handleSidebarDeptClick(dept)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${isActive ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none' : 'hover:bg-blue-50'}`}
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-600 fill-amber-200/80" />
                    <span className="truncate">{dept.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Files Pane */}
        <div className="flex-1 bg-white h-full p-4 flex flex-col overflow-hidden">



          {isSearching ? (

            /* Flat search view */
            <div className="space-y-2 flex-1 overflow-y-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Search Results ({searchResults.length} matches)</span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer">
                      <th className="py-2 px-2 hover:text-blue-600" onClick={() => handleHeaderClick('name')}>Name {sortField === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2 hover:text-blue-600" onClick={() => handleHeaderClick('size')}>Size {sortField === 'size' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="py-2 px-2 text-center hover:text-blue-600" onClick={() => handleHeaderClick('status')}>Status {sortField === 'status' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {[...searchResults].sort((a, b) => {
                      let comp = 0;
                      if (sortField === 'name') {
                        comp = (a.title || a.originalName).localeCompare(b.title || b.originalName);
                      } else if (sortField === 'size') {
                        comp = (a.fileSize || 0) - (b.fileSize || 0);
                      } else if (sortField === 'status') {
                        comp = (a.status || '').localeCompare(b.status || '');
                      } else if (sortField === 'date') {
                        comp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                      }
                      return sortOrder === 'asc' ? comp : -comp;
                    }).map((d) => (
                      <tr
                        key={d._id}
                        title={`Name: ${d.title || d.originalName}\nType: Submission File\nStatus: ${d.status}\nSize: ${formatFileSize(d.fileSize)}\nDate: ${formatDateTime(d.createdAt)}`}
                        onClick={() => setSelectedItem({ id: d._id, name: d.title || d.originalName, type: 'submission', doc: d })}
                        className={`cursor-pointer ${selectedItem?.id === d._id ? 'bg-blue-50 font-medium' : 'hover:bg-blue-50/50'}`}
                      >
                        <td className="py-2.5 px-2 flex items-center gap-2 max-w-xs">
                          <FileText className="w-3.5 h-3.5 text-blue-600 fill-white shrink-0" />
                          <span className="truncate">{d.title || d.originalName}</span>
                        </td>
                        <td className="py-2.5 px-2 text-gray-500 capitalize">Submission File</td>
                        <td className="py-2.5 px-2 text-gray-500">{formatFileSize(d.fileSize)}</td>
                        <td className="py-2.5 px-2 text-center">
                          <StatusBadge status={d.paymentBlocked ? 'blocked' : d.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Explorer content folder navigator */
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto min-h-0">
                {explorerItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400 gap-3">
                    <Folder className="w-16 h-16 text-amber-300 fill-amber-100/50" />
                    <div><p className="text-sm font-medium text-gray-500">This folder is empty</p><p className="text-xs text-gray-400 mt-0.5">Upload documents to get started</p></div>
                    <Link href="/customer/upload" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition">Upload Documents</Link>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* Grid view folder icon layout */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                    {[...explorerItems].sort((a, b) => {
                      const aFolder = ['dept', 'request', 'customer'].includes(a.type);
                      const bFolder = ['dept', 'request', 'customer'].includes(b.type);
                      if (aFolder && !bFolder) return -1;
                      if (!aFolder && bFolder) return 1;
                      let comp = 0;
                      if (sortField === 'name') {
                        comp = a.name.localeCompare(b.name);
                      } else if (sortField === 'type') {
                        comp = a.type.localeCompare(b.type);
                      } else if (sortField === 'size') {
                        comp = (a.fileSize || 0) - (b.fileSize || 0);
                      } else if (sortField === 'status') {
                        comp = (a.status || '').localeCompare(b.status || '');
                      } else if (sortField === 'date') {
                        comp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                      }
                      return sortOrder === 'asc' ? comp : -comp;
                    }).map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const isFolder = item.type === 'dept' || item.type === 'request';
                      return (
                        <div
                          key={item.id}
                          title={`Name: ${item.name}\nType: ${item.type === 'dept' ? 'Department Folder' : item.type === 'request' ? 'Request Batch' : item.type === 'submission' ? 'Submission File' : 'Result Document'}${item.status ? `\nStatus: ${item.status}` : ''}${item.fileSize ? `\nSize: ${formatFileSize(item.fileSize)}` : ''}${item.createdAt ? `\nDate: ${formatDateTime(item.createdAt)}` : ''}${item.itemCount ? `\nItems: ${item.itemCount}` : ''}`}
                              onClick={() => setSelectedItem(item)}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                          className={`flex flex-col items-center text-center p-3 border rounded-lg cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-blue-50/80 border-[#93c5fd] shadow-sm'
                              : 'border-transparent hover:bg-blue-50 hover:border-gray-200'
                          }`}
                        >
                          {isFolder ? (
                            <div className="relative">
                              <Folder className={`w-12 h-12 text-amber-600 fill-amber-200/80`} />
                              <span className="absolute bottom-2 right-1.5 bg-white text-[8px] font-extrabold text-gray-500 px-0.5 border border-[#d1d5db] rounded shadow-xs">
                                {item.itemCount}
                              </span>
                            </div>
                          ) : item.type === 'result' ? (
                            <div className="relative">
                              <FileText className="w-12 h-12 text-green-500 fill-green-50" />
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 bg-white rounded-full absolute -bottom-0.5 -right-0.5" />
                            </div>
                          ) : (
                            <div className="relative">
                              <FileText className="w-12 h-12 text-blue-600 fill-white" />
                            </div>
                          )}
                          <span className="text-[11px] font-medium text-gray-700 mt-2 truncate w-full" title={item.name}>
                            {item.name}
                          </span>
                          <div className="mt-1 flex flex-col items-center gap-0.5">
                            {item.slaStatus && item.status !== 'completed' && item.status !== 'blocked' && <SlaBadge slaStatus={item.slaStatus} />}
                            {item.status && <StatusBadge status={item.status} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Details List View */
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#e5e7eb] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                          <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('name')}>Name {sortField === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                          <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('type')}>Type {sortField === 'type' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                          <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('size')}>Size {sortField === 'size' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                          <th className="py-2.5 px-3 text-center hover:text-blue-600" onClick={() => handleHeaderClick('status')}>Status {sortField === 'status' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7eb]">
                        {[...explorerItems].sort((a, b) => {
                          const aFolder = ['dept', 'request', 'customer'].includes(a.type);
                          const bFolder = ['dept', 'request', 'customer'].includes(b.type);
                          if (aFolder && !bFolder) return -1;
                          if (!aFolder && bFolder) return 1;
                          let comp = 0;
                          if (sortField === 'name') {
                            comp = a.name.localeCompare(b.name);
                          } else if (sortField === 'type') {
                            comp = a.type.localeCompare(b.type);
                          } else if (sortField === 'size') {
                            comp = (a.fileSize || 0) - (b.fileSize || 0);
                          } else if (sortField === 'status') {
                            comp = (a.status || '').localeCompare(b.status || '');
                          } else if (sortField === 'date') {
                            comp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                          }
                          return sortOrder === 'asc' ? comp : -comp;
                        }).map((item) => {
                          const isSelected = selectedItem?.id === item.id;
                          const isFolder = item.type === 'dept' || item.type === 'request';
                          return (
                            <tr
                              key={item.id}
                              title={`Name: ${item.name}\nType: ${item.type === 'dept' ? 'Department Folder' : item.type === 'request' ? 'Request Batch' : item.type === 'submission' ? 'Submission File' : 'Result Document'}${item.status ? `\nStatus: ${item.status}` : ''}${item.fileSize ? `\nSize: ${formatFileSize(item.fileSize)}` : ''}${item.createdAt ? `\nDate: ${formatDateTime(item.createdAt)}` : ''}${item.itemCount ? `\nItems: ${item.itemCount}` : ''}`}
                          onClick={() => setSelectedItem(item)}
                              onDoubleClick={() => handleItemDoubleClick(item)}
                              className={`cursor-pointer ${
                                isSelected ? 'bg-blue-50 font-semibold' : 'hover:bg-blue-50/50'
                              }`}
                            >
                              <td className="py-2 px-3 flex items-center gap-2 max-w-sm">
                                {isFolder ? (
                                  <Folder className={`w-3.5 h-3.5 shrink-0 text-amber-600 fill-amber-200/80`} />
                                ) : item.type === 'result' ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                ) : (
                                  <File className="w-3.5 h-3.5 text-blue-600 fill-white shrink-0" />
                                )}
                                <span className="truncate">{item.name}</span>
                              </td>
                              <td className="py-2 px-3 text-gray-500 capitalize">{item.type === 'dept' ? 'Department folder' : item.type === 'request' ? 'Request batch' : 'File'}</td>
                              <td className="py-2 px-3 text-gray-500">{isFolder ? `${item.itemCount} items` : formatFileSize(item.fileSize)}</td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {item.slaStatus && item.status !== 'completed' && item.status !== 'blocked' && <SlaBadge slaStatus={item.slaStatus} />}
                                  {item.status ? <StatusBadge status={item.status} /> : '-'}
                                </div>
                              </td>
                            </tr>
                          );
                        }).filter(Boolean)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {/* Pagination Controls */}
              <div className="mt-auto flex items-center justify-between border-t pt-3 shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Rows per page:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(parseInt(e.target.value));
                      setPage(1);
                    }}
                    className="text-xs border rounded px-2 py-1 outline-none bg-white font-semibold text-gray-700 hover:bg-blue-50 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <Pagination page={page} pages={pages} onPageChange={setPage} />
              </div>
            </div>
          )}
        </div>

        {/* Mobile backdrop */}
        {isMobile && selectedItem && (
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedItem(null)} />
        )}

        {/* Resize handle (desktop only) */}
        {!isMobile && (
          <div
            className="w-1.5 cursor-col-resize shrink-0 hover:bg-blue-400/30 active:bg-blue-400/50 transition-colors"
            onMouseDown={handleResizeStart}
          />
        )}

        {/* Right Details Explorer Sidebar Panel */}
        <div
          ref={panelRef}
          style={isMobile ? undefined : { width: panelWidth }}
            className={panelClassName}
        >
          {selectedItem ? (
            <>
              {/* Sidebar Header Title */}
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">File Properties</span>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-0.5 text-gray-400 hover:bg-[#e5e7eb] rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Large Preview Graphic / Inline Preview */}
              <div className="p-1 bg-white border border-[#e5e7eb] rounded-lg flex items-center justify-center shadow-xs overflow-hidden h-48 w-full relative">
                {loadingPreview ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    <span className="text-[10px] text-gray-400">Loading preview...</span>
                  </div>
                ) : selectedItem.type === 'dept' || selectedItem.type === 'request' ? (
                  <Folder className="w-12 h-12 text-amber-600 fill-amber-200/80" />
                ) : previewUrl ? (
                  selectedItem.mimeType?.startsWith('image/') ? (
                    <img src={previewUrl} alt={selectedItem.name} className="max-h-full max-w-full object-contain" />
                  ) : selectedItem.mimeType === 'application/pdf' ? (
                    <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none" title="PDF Preview" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <FileText className="w-12 h-12 text-blue-600 fill-white mb-2" />
                      <span className="text-[10px] text-gray-500 font-semibold truncate max-w-[150px]">{selectedItem.name}</span>
                      <span className="text-[9px] text-gray-400 mt-0.5">No preview available</span>
                    </div>
                  )
                ) : selectedItem.type === 'result' ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                    <span className="text-[9px] text-gray-400 mt-1">Result uploaded</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <FileText className="w-12 h-12 text-blue-600 fill-white" />
                    <span className="text-[9px] text-gray-400 mt-1">No preview</span>
                  </div>
                )}
              </div>

              {/* Attributes lists */}
              <div className="space-y-2.5 text-[11px] border-t border-[#e5e7eb] pt-3">
                <div className="truncate">
                  <span className="text-gray-400 block font-semibold">Name:</span>
                  <span className="text-gray-800 font-bold break-all" title={selectedItem.name}>{selectedItem.name}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-semibold">Type:</span>
                  <span className="text-gray-700 capitalize font-medium">{selectedItem.type === 'dept' ? 'Department Folder' : selectedItem.type === 'request' ? 'Request Batch' : selectedItem.type === 'submission' ? 'Submission File' : 'Result Document'}</span>
                </div>
                {selectedItem.status && (
                  <div>
                    <span className="text-gray-400 block font-semibold">Status:</span>
                    <div className="mt-0.5">
                      <StatusBadge status={selectedItem.status} />
                    </div>
                  </div>
                )}
                {selectedItem.fileSize && (
                  <div>
                    <span className="text-gray-400 block font-semibold">Size:</span>
                    <span className="text-gray-700 font-medium">{formatFileSize(selectedItem.fileSize)}</span>
                  </div>
                )}
                {selectedItem.createdAt && (
                  <div>
                    <span className="text-gray-400 block font-semibold">Date modified:</span>
                    <span className="text-gray-700 font-medium">{formatDateTime(selectedItem.createdAt)}</span>
                  </div>
                )}

                {/* Description snippet */}
                {(selectedItem.doc?.description || selectedItem.docs?.[0]?.description) && (
                  <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-900 mt-2">
                    <span className="text-[9px] uppercase font-extrabold tracking-wider">Description</span>
                    <p className="mt-0.5 text-xs font-normal italic leading-relaxed whitespace-pre-wrap">
                      &ldquo;{selectedItem.doc?.description || selectedItem.docs[0].description}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Sidebar Action Buttons */}
              <div className="border-t border-[#e5e7eb] pt-3 mt-auto space-y-1.5">
                {selectedItem.type === 'request' && (
                  <button
                    onClick={() => handleItemDoubleClick(selectedItem)}
                    className="w-full text-center py-1.5 bg-[#2563eb] text-white rounded font-semibold text-xs shadow-sm hover:bg-blue-700 transition"
                  >
                    Open Folder
                  </button>
                )}
                {(selectedItem.type === 'submission' || selectedItem.type === 'result') && (
                  <>
                    {selectedItem.doc?.paymentBlocked && selectedItem.type === 'result' ? (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-semibold flex items-center justify-center gap-1.5 hover:bg-red-100 transition"
                      >
                        <Lock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        Payment Due - Click for Details
                      </button>
                    ) : (selectedItem.type === 'submission' && selectedItem.doc?.fileDeletedFromStorage) || (selectedItem.type === 'result' && selectedItem.doc?.resultFileDeletedFromStorage) ? (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 font-medium flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>File content has been purged by the administrator.</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(selectedItem.doc, selectedItem.type)}
                        className="w-full py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Download File
                      </button>
                    )}
                  </>
                )}

              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-1.5 py-20">
              <Info className="w-8 h-8 text-gray-300 stroke-1.5" />
              <p className="text-xs font-semibold">Select a file or folder to view details.</p>
            </div>
          )}
        </div>

      </div>
    </div>

      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Payment Required" size="sm">
        <div className="text-center py-4">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Payment is Due</h3>
          <p className="text-sm text-gray-600 mb-6">
            This document is blocked due to pending payment. Please visit the Categories section to view your documents and contact the firm regarding payment.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setShowPaymentModal(false); router.push('/customer/categories'); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
            >
              Go to Categories
            </button>
            <button
              onClick={() => setShowPaymentModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-blue-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

