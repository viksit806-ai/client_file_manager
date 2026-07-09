'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { adminAPI } from '@/lib/api';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Pagination from '@/components/ui/Pagination';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import SlaBadge from '@/components/ui/SlaBadge';
import { formatDateTime, formatFileSize, getSlaStatus } from '@/lib/utils';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  Search,
  Ban,
  CheckCircle,
  Trash2,
  Save,
  Pencil,
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
  Download,
  Monitor,
  HardDrive,
  AlertCircle,
  AlertTriangle,
  FolderPlus,
  Upload,
  Eye,
  Maximize2,
  Clock,
  Sparkles,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';

export default function AdminDocumentsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [docs, setDocs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || '',
    departmentId: searchParams.get('departmentId') || '',
  }));
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'columns'

  const [page, setPage] = useState(() => parseInt(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(() => parseInt(searchParams.get('limit')) || 10);
  const [pages, setPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  
  // Navigation stack state
  const [currentPath, setCurrentPath] = useState([]); // [{ id, name, type }]
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [quickLookItem, setQuickLookItem] = useState(null);
  
  // Details pane edit form
  const [editForm, setEditForm] = useState({ title: '', notes: '', status: '' });
  const [saving, setSaving] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  // Create folder / upload state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showUploadFiles, setShowUploadFiles] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const isResizing = useRef(false);
  const [panelWidth, setPanelWidth] = useState(300);
  const [isMobile, setIsMobile] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

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

  useEffect(() => {
    if (selectedItem) {
      setRenameValue(selectedItem.name);
      setIsRenaming(false);
    }
  }, [selectedItem]);

  // Keyboard shortcuts (Spacebar for Quick Look, Delete, F2, etc.)
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
      if (e.key === 'Delete' && selectedItem) {
        if (selectedItem.type === 'file' || selectedItem.type === 'result_file') {
          setConfirmState({
            open: true,
            title: 'Delete Document',
            message: 'Are you sure you want to delete this document?',
            onConfirm: async () => {
              await adminAPI.deleteDocument(selectedItem.id);
              toast.success('Document deleted');
              setSelectedItem(null);
              load();
              setConfirmState(s => ({ ...s, open: false }));
            },
            variant: 'danger'
          });
        }
      }
      if (e.key === 'F2' && selectedItem) {
        setIsRenaming(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowCreateFolder(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setShowUploadFiles(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedItem, quickLookItem]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filters.status) params.set('status', filters.status);
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (page > 1) params.set('page', page.toString());
    if (limit !== 10) params.set('limit', limit.toString());
    
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [search, filters.status, filters.departmentId, page, limit, pathname, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, deptRes] = await Promise.all([
        adminAPI.getAllDocuments({
          ...filters,
          search,
          page,
          limit,
        }),
        adminAPI.getDepartments()
      ]);
      setDocs(docRes.data.data);
      setDepartments(deptRes.data.data);
      if (docRes.data.pagination) {
        setPages(docRes.data.pagination.pages);
        setTotalDocs(docRes.data.pagination.total);
      } else {
        setPages(1);
        setTotalDocs(docRes.data.data.length);
      }
      
      if (selectedItem && selectedItem.type === 'file') {
        const freshDoc = docRes.data.data.find(d => d._id === selectedItem.id);
        if (freshDoc) {
          setSelectedItem(prev => ({ ...prev, doc: freshDoc, status: freshDoc.status }));
          setEditForm({
            title: freshDoc.title || freshDoc.originalName || '',
            notes: freshDoc.notes || '',
            status: freshDoc.status || ''
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, search, page, limit, selectedItem]);

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
    });
  }, [filters, search, page, limit]);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    if (item.type === 'file') {
      setEditForm({
        title: item.doc.title || item.doc.originalName || '',
        notes: item.doc.notes || '',
        status: item.doc.status || ''
      });
    }
  };

  const handleSaveDoc = async (docId) => {
    setSaving(true);
    try {
      await adminAPI.updateDocument(docId, editForm);
      toast.success('Document updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = (docId) => {
    setConfirmState({
      open: true,
      title: 'Block Document for Payment?',
      message: 'This will block the customer from downloading this document until payment is received.',
      onConfirm: async () => {
        try {
          await adminAPI.blockDocument(docId);
          toast.success('Document blocked for payment');
          load();
        } catch (err) {
          toast.error('Failed to block document');
        } finally {
          setConfirmState(s => ({ ...s, open: false }));
        }
      },
      variant: 'warning'
    });
  };

  const handleUnblock = (docId) => {
    setConfirmState({
      open: true,
      title: 'Unblock Document?',
      message: 'This will allow the customer to download this document again.',
      onConfirm: async () => {
        try {
          await adminAPI.unblockDocument(docId);
          toast.success('Document unblocked');
          load();
        } catch (err) {
          toast.error('Failed to unblock document');
        } finally {
          setConfirmState(s => ({ ...s, open: false }));
        }
      },
      variant: 'warning'
    });
  };

  const handleDelete = (docId) => {
    setConfirmState({
      open: true,
      title: 'Purge Document Record',
      message: 'Are you sure you want to completely purge this document record from the system database?',
      onConfirm: async () => {
        try {
          await adminAPI.deleteDocument(docId);
          toast.success('Document record purged');
          setSelectedItem(null);
          load();
        } catch (err) {
          toast.error('Failed to purge document');
        } finally {
          setConfirmState(s => ({ ...s, open: false }));
        }
      },
      variant: 'danger'
    });
  };

  const handlePurgeFiles = (docId) => {
    setConfirmState({
      open: true,
      title: 'Purge Physical File Storage',
      message: 'Are you sure you want to purge the physical file disk storage? Metadata will remain intact.',
      onConfirm: async () => {
        try {
          await adminAPI.purgeDocumentFiles(docId);
          toast.success('Physical file storage purged');
          load();
        } catch (err) {
          toast.error('Failed to purge physical files');
        } finally {
          setConfirmState(s => ({ ...s, open: false }));
        }
      },
      variant: 'warning'
    });
  };

  const handleSoftDeleteClick = () => {
    if (!selectedItem) return;
    const isGroup = selectedItem.type === 'request';
    setConfirmState({
      open: true,
      title: isGroup ? 'Soft Delete Folder' : 'Soft Delete File',
      message: isGroup ? 'Move this request folder to trash?' : 'Move this file to trash?',
      onConfirm: async () => {
        try {
          if (isGroup) {
            await adminAPI.softDeleteGroup(selectedItem.id);
          } else {
            await adminAPI.softDeleteDocument(selectedItem.id, { isResult: selectedItem.type === 'result_file' });
          }
          toast.success('Moved to trash');
          setSelectedItem(null);
          load();
        } catch (err) {
          toast.error('Failed to delete item');
        } finally {
          setConfirmState(s => ({ ...s, open: false }));
        }
      },
      variant: 'danger'
    });
  };

  const handleRenameSave = async () => {
    if (!selectedItem || !renameValue.trim()) return;
    setSavingRename(true);
    try {
      if (selectedItem.type === 'request') {
        await adminAPI.renameGroup(selectedItem.id, { customGroupName: renameValue.trim() });
      } else if (selectedItem.type === 'file' || selectedItem.type === 'result_file') {
        await adminAPI.renameDocument(selectedItem.id, { title: renameValue.trim(), isResult: selectedItem.type === 'result_file' });
      }
      toast.success('Renamed successfully');
      setIsRenaming(false);
      load();
    } catch (err) {
      toast.error('Failed to rename');
    } finally {
      setSavingRename(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const activeCustomerId = currentPath[0]?.id;
      const activeDeptId = currentPath[1]?.id;
      await adminAPI.createFolder({
        customerId: activeCustomerId,
        departmentId: activeDeptId === 'general' ? null : activeDeptId,
        customGroupName: newFolderName.trim()
      });
      toast.success('Folder created');
      setShowCreateFolder(false);
      setNewFolderName('');
      load();
    } catch (err) {
      toast.error('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUploadFiles = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      const activeGroupId = currentPath[2]?.id;
      const formData = new FormData();
      uploadFiles.forEach(f => formData.append('files', f));
      await adminAPI.uploadFilesToFolder(activeGroupId, formData);
      toast.success('Files uploaded');
      setShowUploadFiles(false);
      setUploadFiles([]);
      load();
    } catch (err) {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  // Stack navigation helpers
  const navigateToPath = (newPath) => {
    setCurrentPath(newPath);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPath);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSelectedItem(null);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setCurrentPath(history[newIdx]);
      setSelectedItem(null);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setCurrentPath(history[newIdx]);
      setSelectedItem(null);
    }
  };

  const handleUp = () => {
    if (currentPath.length > 0) {
      navigateToPath(currentPath.slice(0, -1));
    }
  };

  // Grouping documents into tree structure
  const groupedByCustomer = {};
  for (const doc of docs) {
    const custId = doc.customerId?._id || 'unknown';
    const custName = doc.customerId?.name || 'Unknown Customer';
    if (!groupedByCustomer[custId]) {
      groupedByCustomer[custId] = {
        id: custId,
        name: custName,
        docs: []
      };
    }
    groupedByCustomer[custId].docs.push(doc);
  }

  const sidebarCustomers = Object.values(groupedByCustomer);

  const getGroupStatus = (groupDocs) => {
    if (!groupDocs || groupDocs.length === 0) return 'pending';
    if (groupDocs.every(d => d.status === 'completed')) return 'completed';
    if (groupDocs.some(d => d.status === 'blocked' || d.paymentBlocked)) return 'blocked';
    if (groupDocs.some(d => d.status === 'processing')) return 'processing';
    return 'pending';
  };

  const isSearchOrFilterActive = Boolean(search || filters.status || filters.departmentId);
  let searchedDocs = docs;

  // Derive items for current directory view
  let explorerItems = [];
  const currentDepth = currentPath.length;

  if (!isSearchOrFilterActive) {
    if (currentDepth === 0) {
      explorerItems = sidebarCustomers.map(c => ({
        id: c.id,
        name: c.name,
        type: 'customer',
        itemCount: c.docs.length,
        docs: c.docs
      }));
    } else if (currentDepth === 1) {
      const activeCustomerId = currentPath[0].id;
      const customerData = groupedByCustomer[activeCustomerId];
      if (customerData) {
        const depts = {};
        for (const d of customerData.docs) {
          const deptId = d.departmentId?._id || 'general';
          const deptName = d.departmentId?.name || 'General';
          if (!depts[deptId]) {
            depts[deptId] = { id: deptId, name: deptName, docs: [] };
          }
          depts[deptId].docs.push(d);
        }
        explorerItems = Object.values(depts).map(dept => ({
          id: dept.id,
          name: dept.name,
          type: 'dept',
          itemCount: dept.docs.length,
          docs: dept.docs
        }));
      }
    } else if (currentDepth === 2) {
      const activeCustomerId = currentPath[0].id;
      const activeDeptId = currentPath[1].id;
      const customerData = groupedByCustomer[activeCustomerId];
      if (customerData) {
        const deptDocs = customerData.docs.filter(d => (d.departmentId?._id || 'general') === activeDeptId);
        const groups = {};
        for (const d of deptDocs) {
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
    } else if (currentDepth === 3) {
      const activeCustomerId = currentPath[0].id;
      const activeDeptId = currentPath[1].id;
      const activeGroupId = currentPath[2].id;
      const customerData = groupedByCustomer[activeCustomerId];
      if (customerData) {
        const groupDocs = customerData.docs.filter(d =>
          (d.groupId || d._id) === activeGroupId &&
          (d.departmentId?._id || 'general') === activeDeptId &&
          !d.isPlaceholder && d.storedPath
        );
        for (const d of groupDocs) {
          explorerItems.push({
            id: d._id,
            name: d.title || d.originalName,
            type: 'file',
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
              type: 'result_file',
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
  }

  const handleItemDoubleClick = (item) => {
    if (item.type === 'customer') {
      navigateToPath([{ id: item.id, name: item.name, type: 'customer' }]);
    } else if (item.type === 'dept') {
      navigateToPath([...currentPath, { id: item.id, name: item.name, type: 'dept' }]);
    } else if (item.type === 'request') {
      navigateToPath([...currentPath, { id: item.id, name: item.name, type: 'request' }]);
    } else if (item.type === 'file' || item.type === 'result_file') {
      setQuickLookItem(item);
    }
  };

  const handleSidebarCustomerClick = (c) => {
    setSearch('');
    const folderItem = { id: c.id, name: c.name, type: 'customer', itemCount: c.docs.length, docs: c.docs };
    navigateToPath([{ id: c.id, name: c.name, type: 'customer' }]);
    setSelectedItem(folderItem);
  };

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const panelClassName = 'bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full p-4 overflow-y-auto flex flex-col gap-4 relative shadow-sm ' + (isMobile
    ? 'fixed inset-y-0 right-0 z-50 w-[85vw] max-w-sm transition-transform duration-300 ' + (selectedItem ? 'translate-x-0' : 'translate-x-full')
    : 'shrink-0 ' + (selectedItem ? 'opacity-100' : 'lg:opacity-90 lg:block hidden'));

  return (
    <div className="flex flex-col -m-6 h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-[#0b0f19] select-none overflow-hidden font-sans">
      
      {/* Clean Modern Header Toolbar */}
      <div className="h-13 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 justify-between gap-4 shrink-0 z-20">
        
        {/* Navigation Arrows */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleBack}
            disabled={historyIndex === 0}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            onClick={handleForward}
            disabled={historyIndex === history.length - 1}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            onClick={handleUp}
            disabled={currentPath.length === 0}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Up Enclosing Folder"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Clean Breadcrumb Path Bar */}
        <div className="flex-1 max-w-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl h-8 flex items-center px-3 overflow-x-auto whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 gap-1.5 scrollbar-none font-medium">
          <HardDrive className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-slate-400 dark:text-slate-500 font-semibold">Storage</span>
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          
          <button
            onClick={() => navigateToPath([])}
            className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition"
          >
            All Customers
          </button>
          {currentPath.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              <button
                onClick={() => navigateToPath(currentPath.slice(0, idx + 1))}
                className={`hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[140px] transition ${idx === currentPath.length - 1 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search & Layout Toggles */}
        <div className="flex items-center gap-2.5">
          {/* Search Input Bar */}
          <div className="relative w-44 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-8 flex items-center px-2.5 shrink-0 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-blue-500 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs ml-1.5 outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          {!isSearchOrFilterActive && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                title="Icon View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('columns')}
                className={`p-1.5 rounded-lg transition ${viewMode === 'columns' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                title="Column View (Miller Columns)"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
</div>

              {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl shadow-2xl px-6 py-3.5 flex items-center gap-6 z-50 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <span className="text-xs font-semibold text-slate-300">{selectedIds.size} document(s) selected</span>
                  <div className="h-4 w-px bg-slate-800" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Change Status:</span>
                    {['pending', 'processing', 'completed', 'blocked'].map((status) => (
                      <button
                        key={status}
                        disabled={batchLoading}
                        onClick={async () => {
                          setBatchLoading(true);
                          try {
                            await adminAPI.batchDocuments({ ids: Array.from(selectedIds), action: 'status', status });
                            toast.success(`Updated ${selectedIds.size} document(s) to ${status}`);
                            setSelectedIds(new Set());
                            load();
                          } catch (err) {
                            toast.error('Failed to update documents');
                          } finally {
                            setBatchLoading(false);
                          }
                        }}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg capitalize transition-colors disabled:opacity-50 ${
                          status === 'completed' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                          status === 'blocked' ? 'bg-rose-600 hover:bg-rose-700 text-white' :
                          status === 'processing' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                          'bg-slate-700 hover:bg-slate-650 text-slate-200'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  <div className="h-4 w-px bg-slate-800" />
                  <button
                    disabled={batchLoading}
                    onClick={async () => {
                      setBatchLoading(true);
                      try {
                        await adminAPI.batchDocuments({ ids: Array.from(selectedIds), action: 'delete' });
                        toast.success(`Deleted ${selectedIds.size} document(s)`);
                        setSelectedIds(new Set());
                        setSelectedItem(null);
                        load();
                      } catch (err) {
                        toast.error('Failed to delete documents');
                      } finally {
                        setBatchLoading(false);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <div className="h-4 w-px bg-slate-800" />
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-white font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>

      {/* Filter Toolbar Sub-header */}
      <div className="h-9 bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <SlidersHorizontal className="w-3 h-3 text-blue-500" />
            <span>Filters:</span>
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 transition"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={filters.departmentId}
            onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
            className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 transition"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>

        {(search || filters.status || filters.departmentId) && (
          <button
            onClick={() => { setSearch(''); setFilters({ status: '', departmentId: '' }); }}
            className="text-[11px] text-red-500 hover:underline font-bold"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Workspace split into Sidebar, Explorer view, Details panel */}
      <div className="flex flex-row flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <div className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full overflow-y-auto shrink-0 flex flex-col p-3 text-xs text-slate-700 dark:text-slate-300 select-none">
          <div className="mb-4">
            <span className="font-bold text-slate-400 dark:text-slate-500 block px-2 mb-2 uppercase text-[9px] tracking-wider">Navigation</span>
            <button
              onClick={() => navigateToPath([])}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition ${currentPath.length === 0 && !isSearchOrFilterActive ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <Monitor className={`w-4 h-4 ${currentPath.length === 0 && !isSearchOrFilterActive ? 'text-white' : 'text-blue-500'}`} />
              <span>All Customers</span>
            </button>
          </div>

          <div>
            <span className="font-bold text-slate-400 dark:text-slate-500 block px-2 mb-2 uppercase text-[9px] tracking-wider">Client Spaces</span>
            <div className="space-y-0.5">
              {sidebarCustomers.map(c => {
                const isActive = currentPath.length > 0 && currentPath[0].id === c.id && !isSearchOrFilterActive;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSidebarCustomerClick(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition ${isActive ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <Folder className={`w-4 h-4 ${isActive ? 'text-white fill-white' : 'text-blue-500 fill-blue-500/20'}`} />
                    <span className="truncate" title={c.name}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Files Pane */}
        <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 h-full p-4 flex flex-col overflow-hidden relative">

          {/* Action Toolbar for creation & upload */}
          {!isSearchOrFilterActive && (
            <div className="flex items-center gap-2 mb-3 flex-wrap z-10">
              {currentPath.length >= 2 && (
                <button
                  onClick={() => { setShowCreateFolder(true); setNewFolderName(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold hover:bg-blue-50 dark:hover:bg-slate-700 transition shadow-xs"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>New Folder</span>
                </button>
              )}
              {currentPath.length >= 3 && (
                <button
                  onClick={() => { setShowUploadFiles(true); setUploadFiles([]); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold hover:bg-blue-50 dark:hover:bg-slate-700 transition shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
              )}
            </div>
          )}

          {/* Inline Create Folder form */}
          {showCreateFolder && (
            <div className="mb-3 p-3 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center gap-2 flex-wrap shadow-xs">
              <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowCreateFolder(false); }}
                className="flex-1 min-w-0 px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
              <button onClick={handleCreateFolder} disabled={creatingFolder} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5">
                {creatingFolder ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</> : 'Create'}
              </button>
              <button onClick={() => setShowCreateFolder(false)} className="px-3 py-1.5 border rounded-xl text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition">Cancel</button>
            </div>
          )}

          {/* Inline Upload Files modal */}
          {showUploadFiles && (
            <div className="mb-3 p-4 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/50 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">Upload files into this directory</span>
                <button onClick={() => setShowUploadFiles(false)} className="ml-auto p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-4 h-4 text-slate-500" /></button>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const droppedFiles = Array.from(e.dataTransfer.files || []); if (droppedFiles.length > 0) setUploadFiles(prev => [...prev, ...droppedFiles]); }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition ${isDragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}
              >
                {isDragOver && <p className="text-sm text-blue-600 font-semibold mb-2">Drop files to upload</p>}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={e => setUploadFiles(Array.from(e.target.files || []))}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>
              {uploadFiles.length > 0 && (
                <p className="text-xs text-blue-600 font-semibold">{uploadFiles.length} file(s) selected for upload</p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={handleUploadFiles} disabled={uploading || uploadFiles.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5">
                  {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</> : 'Upload Files'}
                </button>
                <button onClick={() => setShowUploadFiles(false)} className="px-3 py-2 border rounded-xl text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition">Cancel</button>
              </div>
            </div>
          )}

          {/* Render Explorer Views */}
          {isSearchOrFilterActive ? (
            <div className="space-y-2 flex-1 overflow-y-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Matches ({searchedDocs.length} items found)</span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-800 font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                      <th className="py-2.5 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={searchedDocs.length > 0 && selectedIds.size === searchedDocs.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(searchedDocs.map(d => d._id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('name')}>Name {sortField === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('size')}>Size {sortField === 'size' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="py-2.5 px-3 text-center hover:text-blue-600" onClick={() => handleHeaderClick('status')}>Status {sortField === 'status' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {[...searchedDocs].sort((a, b) => {
                      let comp = (a.title || a.originalName).localeCompare(b.title || b.originalName);
                      return sortOrder === 'asc' ? comp : -comp;
                    }).map((doc) => (
<tr
                          key={doc._id}
                          onClick={() => handleSelectItem({ id: doc._id, name: doc.title || doc.originalName, type: 'file', doc })}
                          onDoubleClick={() => setQuickLookItem({ id: doc._id, name: doc.title || doc.originalName, type: 'file', doc })}
                          className={`cursor-pointer transition ${selectedItem?.id === doc._id ? 'bg-blue-600 text-white font-medium rounded-xl' : selectedIds.has(doc._id) ? 'bg-blue-50/75 font-medium' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-gray-200'}`}
                        >
                          <td className="py-2.5 px-3 w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(doc._id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedIds);
                                if (e.target.checked) newSelected.add(doc._id);
                                else newSelected.delete(doc._id);
                                setSelectedIds(newSelected);
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 flex items-center gap-2 max-w-xs">
                          <FileText className={`w-4 h-4 shrink-0 ${selectedItem?.id === doc._id ? 'text-white' : 'text-blue-500'}`} />
                          <span className="truncate">{doc.title || doc.originalName}</span>
                        </td>
                        <td className={`py-2.5 px-3 ${selectedItem?.id === doc._id ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{doc.customerId?.name || 'Unknown'}</td>
                        <td className={`py-2.5 px-3 ${selectedItem?.id === doc._id ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{doc.departmentId?.name || 'General'}</td>
                        <td className={`py-2.5 px-3 ${selectedItem?.id === doc._id ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{formatFileSize(doc.fileSize)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge status={doc.paymentBlocked ? 'blocked' : doc.status} size="sm" />
                        </td>
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
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Folder is empty</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Upload files or navigate to subfolders</p>
                    </div>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* Icons View */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-2">
                    {[...explorerItems].sort((a, b) => {
                      const aFolder = ['customer', 'dept', 'request'].includes(a.type);
                      const bFolder = ['customer', 'dept', 'request'].includes(b.type);
                      if (aFolder && !bFolder) return -1;
                      if (!aFolder && bFolder) return 1;
                      return a.name.localeCompare(b.name);
                    }).map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const isFolder = item.type !== 'file' && item.type !== 'result_file';
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                          className={`flex flex-col items-center text-center p-3.5 rounded-2xl cursor-pointer transition-all select-none group ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]'
                              : 'bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80 text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {isFolder ? (
                            <div className="relative mb-2">
                              <Folder className={`w-14 h-14 transition-transform group-hover:scale-105 ${isSelected ? 'text-white fill-white/20' : 'text-blue-500 fill-blue-500/20'}`} />
                              <span className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-xs ${isSelected ? 'bg-white text-blue-600 border-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                                {item.itemCount}
                              </span>
                            </div>
                          ) : item.type === 'result_file' ? (
                            <div className="relative mb-2">
                              <FileText className={`w-14 h-14 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                              <CheckCircle className="w-4 h-4 text-emerald-500 bg-white rounded-full absolute -bottom-1 -right-1" />
                            </div>
                          ) : (
                            <div className="relative mb-2">
                              <FileText className={`w-14 h-14 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                            </div>
                          )}
                          <span className="text-xs font-semibold truncate w-full px-1" title={item.name}>
                            {item.name}
                          </span>
                          <div className="mt-1 flex items-center gap-1">
                            {item.status && <StatusBadge status={item.status} size="sm" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : viewMode === 'list' ? (
                  /* List View */
                  <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                          <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('name')}>Name {sortField === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                          <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('type')}>Kind {sortField === 'type' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                          <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => handleHeaderClick('size')}>Size {sortField === 'size' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                          <th className="py-2.5 px-3 text-center hover:text-blue-600" onClick={() => handleHeaderClick('status')}>Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {explorerItems.map((item) => {
                          const isSelected = selectedItem?.id === item.id;
                          const isFolder = item.type !== 'file' && item.type !== 'result_file';
                          return (
                            <tr
                              key={item.id}
                              onClick={() => handleSelectItem(item)}
                              onDoubleClick={() => handleItemDoubleClick(item)}
                              className={`cursor-pointer transition ${
                                isSelected ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <td className="py-2.5 px-3 flex items-center gap-2.5 max-w-sm">
                                {isFolder ? (
                                  <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white fill-white' : 'text-blue-500 fill-blue-500/20'}`} />
                                ) : (
                                  <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                                )}
                                <span className="truncate" title={item.name}>{item.name}</span>
                              </td>
                              <td className={`py-2.5 px-3 capitalize ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{item.type}</td>
                              <td className={`py-2.5 px-3 ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{isFolder ? `${item.itemCount} items` : formatFileSize(item.fileSize)}</td>
                              <td className="py-2.5 px-3 text-center">
                                {item.status ? <StatusBadge status={item.status} size="sm" /> : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Miller Columns View */
                  <div className="flex flex-row h-full overflow-x-auto divide-x divide-slate-200 dark:divide-slate-800 border rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {/* Column 1: Customers */}
                    <div className="w-56 shrink-0 h-full overflow-y-auto p-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Customers</span>
                      {sidebarCustomers.map(c => {
                        const isSel = currentPath.length > 0 && currentPath[0].id === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSidebarCustomerClick(c)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${isSel ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Folder className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-500'}`} />
                              <span className="truncate">{c.name}</span>
                            </div>
                            <ChevronRight className={`w-3 h-3 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Column 2: Current Explorer Items */}
                    <div className="w-64 shrink-0 h-full overflow-y-auto p-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Contents</span>
                      {explorerItems.map(item => {
                        const isSel = selectedItem?.id === item.id;
                        const isFolder = item.type !== 'file' && item.type !== 'result_file';
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectItem(item)}
                            onDoubleClick={() => handleItemDoubleClick(item)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${isSel ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {isFolder ? <Folder className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-500'}`} /> : <FileText className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-600'}`} />}
                              <span className="truncate">{item.name}</span>
                            </div>
                            {isFolder && <ChevronRight className={`w-3 h-3 ${isSel ? 'text-white' : 'text-slate-400'}`} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination controls */}
              <div className="mt-auto flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Rows:</span>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <Pagination page={page} pages={pages} onPageChange={setPage} />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Resize handle */}
        {!isMobile && (
          <div
            className="w-1 cursor-col-resize shrink-0 bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 transition-colors"
            onMouseDown={handleResizeStart}
          />
        )}

        {/* Right Inspector Details Panel */}
        <div ref={panelRef} style={isMobile ? undefined : { width: panelWidth }} className={panelClassName}>
          {selectedItem ? (
            <div className="flex flex-col h-full gap-4 overflow-y-auto scrollbar-none pr-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">File Inspector</span>
                <button onClick={() => setSelectedItem(null)} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-xs">
                {selectedItem.type === 'file' ? (
                  <FileText className="w-16 h-16 text-blue-600" />
                ) : selectedItem.type === 'result_file' ? (
                  <CheckCircle className="w-16 h-16 text-emerald-500" />
                ) : (
                  <Folder className="w-16 h-16 text-blue-500 fill-blue-500/20" />
                )}
                <button
                  onClick={() => setQuickLookItem(selectedItem)}
                  className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  <span>Preview</span>
                </button>
              </div>

              <div className="space-y-3 text-xs border-t border-slate-200 dark:border-slate-800 pt-4">
                {isRenaming ? (
                  <div className="space-y-1.5">
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Rename:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-xl text-xs bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                      <button onClick={handleRenameSave} disabled={savingRename} className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs"><CheckCircle className="w-4 h-4" /></button>
                      <button onClick={() => setIsRenaming(false)} className="p-2 bg-slate-400 text-white rounded-xl shadow-xs"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Name</span>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-slate-900 dark:text-white font-bold break-all flex-1 text-sm">{selectedItem.name}</span>
                      <button onClick={() => { setIsRenaming(true); setRenameValue(selectedItem.name); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Kind</span>
                  <span className="text-slate-700 dark:text-slate-300 capitalize font-medium">{selectedItem.type}</span>
                </div>

                {selectedItem.fileSize && (
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Size</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{formatFileSize(selectedItem.fileSize)}</span>
                  </div>
                )}

                {selectedItem.status && (
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase mb-1">Status</span>
                    <StatusBadge status={selectedItem.status} />
                  </div>
                )}
              </div>

              {/* Download / Open Action */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto space-y-2">
                {(selectedItem.type === 'customer' || selectedItem.type === 'dept' || selectedItem.type === 'request') && (
                  <button onClick={() => handleItemDoubleClick(selectedItem)} className="w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-xs transition">
                    Open Folder
                  </button>
                )}
                {(selectedItem.type === 'file' || selectedItem.type === 'result_file') && selectedItem.doc && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/admin/documents/${selectedItem.doc._id}/download${selectedItem.type === 'result_file' ? '?type=result' : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Document</span>
                  </a>
                )}
                {(selectedItem.type === 'file' || selectedItem.type === 'result_file' || selectedItem.type === 'request') && (
                  <button onClick={handleSoftDeleteClick} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-semibold transition mt-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete {selectedItem.type === 'request' ? 'Folder' : 'Document'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 gap-2 py-12">
              <Info className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-semibold">Select an item to view inspection details</p>
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
              <button onClick={() => setQuickLookItem(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
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
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/admin/documents/${quickLookItem.doc._id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.open} onClose={() => setConfirmState(s => ({ ...s, open: false }))} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} confirmText={confirmState.confirmText || 'Confirm'} variant={confirmState.variant} />
    </div>
  );
}
