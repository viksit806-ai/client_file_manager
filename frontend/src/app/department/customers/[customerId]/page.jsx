'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { departmentAPI } from '@/lib/api';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SlaBadge from '@/components/ui/SlaBadge';
import { formatDateTime, formatFileSize, getSlaStatus } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Folder,
  File,
  ChevronRight,
  LayoutGrid,
  List,
  Columns,
  Info,
  X,
  FileText,
  Download,
  Ban,
  CheckCircle,
  Upload,
  AlertCircle,
  AlertTriangle,
  Monitor,
  HardDrive,
  Search,
  Lock,
  Pencil,
  Trash2,
  FolderPlus,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

export default function DeptCustomerDocsExplorer() {
  const { user } = useAuth();
  const canRename = user?.canRename || false;
  const canDelete = user?.canDelete || false;
  const canCreate = user?.canCreate || user?.role === 'super_admin' || false;

  const { customerId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'columns'
  const [quickLookItem, setQuickLookItem] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Navigation stack state
  const [currentPath, setCurrentPath] = useState([]); // [{ id, name, type: 'request' }]
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Folder & Upload State
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showUploadFilesPanel, setShowUploadFilesPanel] = useState(false);
  const [uploadFilesList, setUploadFilesList] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  // Create Response state
  const [fileCategories, setFileCategories] = useState([]);
  const [selectedFileCategory, setSelectedFileCategory] = useState('');
  const [responseNotes, setResponseNotes] = useState('');
  const [responseFile, setResponseFile] = useState(null);
  const [creatingResponse, setCreatingResponse] = useState(false);
  const [showCreateResponseModal, setShowCreateResponseModal] = useState(false);
  const responseFileInputRef = useRef(null);

  // Toggle between Requests and Responses view
  const [explorerMode, setExplorerMode] = useState('requests'); // 'requests' | 'responses'
  const [responseDocs, setResponseDocs] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
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

  const panelRef = useRef(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      departmentAPI.getCustomerDocuments(customerId, { _t: Date.now() }),
      departmentAPI.getFileCategories()
    ])
      .then(([docRes, catRes]) => {
        setDocs(docRes.data.data);
        setFileCategories(catRes.data.data);
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  };

  const loadResponses = () => {
    setLoadingResponses(true);
    departmentAPI.getResponses({ customerId })
      .then(res => setResponseDocs(res.data.data))
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load responses'))
      .finally(() => setLoadingResponses(false));
  };

  useEffect(() => {
    loadData();
    loadResponses();
  }, [customerId]);

  useEffect(() => {
    if (selectedItem) {
      setRenameValue(selectedItem.name);
      setIsRenaming(false);
    }
  }, [selectedItem]);

  const getGroupStatus = (groupDocs) => {
    if (!groupDocs || groupDocs.length === 0) return 'pending';
    const mainDoc = groupDocs.find(d => d.direction === 'submission') || groupDocs[0];
    return mainDoc?.status || 'pending';
  };

  const navigateToPath = (newPath) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newPath);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setCurrentPath(newPath);
    setSelectedItem(null);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setCurrentPath(history[idx]);
      setSelectedItem(null);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      setCurrentPath(history[idx]);
      setSelectedItem(null);
    }
  };

  const handleUp = () => {
    if (currentPath.length > 0) {
      navigateToPath(currentPath.slice(0, -1));
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { toast.error('Folder name is required'); return; }
    setCreatingFolder(true);
    try {
      await departmentAPI.createFolder({ folderName: newFolderName.trim(), customerId });
      toast.success('Folder created successfully');
      setNewFolderName('');
      setShowCreateFolder(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUploadFilesToFolder = async () => {
    if (uploadFilesList.length === 0) { toast.error('Select at least one file'); return; }
    const groupId = currentPath[currentPath.length - 1]?.id;
    if (!groupId) { toast.error('Navigate into a request folder before uploading'); return; }
    setUploadingFiles(true);
    const formData = new FormData();
    uploadFilesList.forEach(f => formData.append('files', f));
    try {
      await departmentAPI.uploadFilesToFolder(groupId, formData);
      toast.success('Files uploaded successfully');
      setUploadFilesList([]);
      setShowUploadFilesPanel(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleCreateResponse = async () => {
    if (!selectedFileCategory) { toast.error('Please select a file category'); return; }
    if (!responseFile) { toast.error('Please select a file to upload'); return; }
    const groupId = currentPath[currentPath.length - 1]?.id || currentPath[0]?.id;
    if (!groupId) { toast.error('Please navigate into a request folder to upload a response'); return; }
    setCreatingResponse(true);
    try {
      const formData = new FormData();
      formData.append('file', responseFile);
      formData.append('customerId', customerId);
      formData.append('fileCategoryId', selectedFileCategory);
      formData.append('notes', responseNotes);
      formData.append('groupId', groupId);
      await departmentAPI.createResponse(formData);
      toast.success('Response uploaded successfully');
      setResponseFile(null);
      setSelectedFileCategory('');
      setResponseNotes('');
      setShowCreateResponseModal(false);
      if (responseFileInputRef.current) responseFileInputRef.current.value = '';
      loadResponses();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create response');
    } finally {
      setCreatingResponse(false);
    }
  };

  const handleDeleteItem = (item) => {
    setConfirmState({
      open: true,
      title: item.type === 'request' ? 'Delete Folder' : 'Delete Document',
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          if (item.type === 'request') {
            await departmentAPI.deleteGroup(item.id);
          } else {
            await departmentAPI.batchDocuments({ ids: [item.id], action: 'delete' });
          }
          toast.success(`${item.type === 'request' ? 'Folder' : 'Document'} deleted successfully`);
          setSelectedItem(null);
          loadData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to delete item');
        } finally {
          setConfirmState(s => ({ ...s, open: false }));
        }
      }
    });
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedItem) return;
    try {
      let idsToUpdate = [];
      if (selectedItem.type === 'request') {
        idsToUpdate = selectedItem.docs.map(d => d._id);
      } else if (selectedItem.doc) {
        idsToUpdate = [selectedItem.doc._id];
      } else {
        return;
      }
      
      await departmentAPI.batchDocuments({
        ids: idsToUpdate,
        action: 'status',
        status: newStatus,
        groupId: selectedItem.type === 'request' ? selectedItem.id : undefined
      });
      
      toast.success(`Status updated to ${newStatus}`);
      loadData();
      
      setSelectedItem(prev => ({
        ...prev,
        status: newStatus
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleBlockResponse = async () => {
    if (!selectedItem || selectedItem.type !== 'response' || !selectedItem.doc) return;
    try {
      const isBlocked = selectedItem.doc.paymentBlocked;
      await departmentAPI.batchDocuments({
        ids: [selectedItem.doc._id],
        action: isBlocked ? 'unblock' : 'block'
      });
      toast.success(isBlocked ? 'Response unblocked' : 'Response blocked');
      loadData();
      if (explorerMode === 'responses') loadResponses();
      
      setSelectedItem(prev => ({
        ...prev,
        doc: {
          ...prev.doc,
          paymentBlocked: !isBlocked
        }
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update block status');
    }
  };

  // Keyboard shortcuts
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

  if (loading && docs.length === 0) return <div className="animate-pulse h-64 bg-gray-200 dark:bg-slate-800 rounded-2xl" />;

  const customerName = docs[0]?.customerId?.name || 'Customer';

  const groupedRequests = {};
  for (const d of docs) {
    const key = d.groupId || d._id;
    if (!groupedRequests[key]) groupedRequests[key] = [];
    groupedRequests[key].push(d);
  }

  const sidebarRequests = Object.entries(groupedRequests).map(([groupId, groupDocs]) => {
    const firstDoc = groupDocs[0];
    const mainDoc = groupDocs.find(d => d.direction === 'submission') || firstDoc;
    const sla = getSlaStatus(firstDoc.createdAt, getGroupStatus(groupDocs));
    return {
      id: groupId,
      name: firstDoc.customGroupName || formatDateTime(firstDoc.createdAt),
      description: mainDoc.description,
      itemCount: groupDocs.length,
      slaStatus: sla,
      docs: groupDocs
    };
  });

  const isSearching = searchQuery.trim() !== '';
  const searchResults = docs.filter(d =>
    d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  let explorerItems = [];
  const currentDepth = currentPath.length;

  if (currentDepth === 0) {
    explorerItems = sidebarRequests.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      type: 'request',
      itemCount: r.itemCount,
      status: getGroupStatus(r.docs),
      slaStatus: r.slaStatus,
      docs: r.docs
    }));
  } else if (currentDepth === 1) {
    const activeGroupId = currentPath[0].id;
    const groupDocs = docs.filter(d => (d.groupId || d._id) === activeGroupId && !d.isPlaceholder && d.storedPath);
    for (const d of groupDocs) {
      explorerItems.push({
        id: d._id,
        name: d.title || d.originalName,
        type: d.direction === 'response' ? 'response' : 'submission',
        fileCategory: d.fileCategoryId?.name,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        status: d.status,
        createdAt: d.createdAt,
        description: d.description,
        notes: d.notes,
        doc: d
      });
    }
  }

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    if (item.type === 'submission' || item.type === 'result') {
      setNotes(item.doc.notes || '');
    } else {
      setNotes(item.docs?.[0]?.notes || '');
    }
  };

  const handleItemDoubleClick = (item) => {
    if (item.type === 'request') {
      navigateToPath([{ id: item.id, name: item.name, type: 'request' }]);
    } else if (item.type === 'submission' || item.type === 'result') {
      setQuickLookItem(item);
    }
  };

  const handleSidebarRequestClick = (req) => {
    setSearchQuery('');
    const folderItem = { id: req.id, name: req.name, type: 'request', itemCount: req.itemCount, docs: req.docs };
    navigateToPath([{ id: req.id, name: req.name, type: 'request' }]);
    setSelectedItem(folderItem);
  };

  const handleResponseClick = (r) => {
    setSelectedItem({
      id: r._id,
      name: r.originalName,
      type: 'response',
      fileSize: r.fileSize,
      createdAt: r.createdAt,
      fileCategory: r.fileCategoryId?.name,
      notes: r.notes,
      doc: r,
    });
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
          <button onClick={() => navigateToPath([])} className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition">{customerName}</button>
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
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none text-xs ml-1.5 outline-none text-slate-700 dark:text-slate-200" />
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

      {/* Workspace Area */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {explorerMode === 'requests' && (
          <div className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full overflow-y-auto shrink-0 flex flex-col p-3 text-xs text-slate-700 dark:text-slate-300 select-none">
            <div className="mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Link href="/department/customers" className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition text-blue-600 dark:text-blue-400 font-semibold">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Customers</span>
              </Link>
            </div>
            <div className="mb-4">
              <span className="font-bold text-slate-400 dark:text-slate-500 block px-2 mb-2 uppercase text-[9px] tracking-wider">Navigation</span>
              <button onClick={() => navigateToPath([])} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition ${currentPath.length === 0 && !isSearching ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <Monitor className={`w-4 h-4 ${currentPath.length === 0 && !isSearching ? 'text-white' : 'text-blue-500'}`} />
                <span>All Requests</span>
              </button>
            </div>

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 block px-2 mb-2 uppercase text-[9px] tracking-wider">Folders</span>
              <div className="space-y-0.5">
                {sidebarRequests.map(req => {
                  const isActive = currentPath.length > 0 && currentPath[0].id === req.id && !isSearching;
                  return (
                    <button key={req.id} onClick={() => handleSidebarRequestClick(req)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition ${isActive ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      <Folder className={`w-4 h-4 ${isActive ? 'text-white fill-white' : 'text-blue-500 fill-blue-500/20'}`} />
                      <span className="truncate">{req.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Center Files Pane */}
        <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 h-full p-4 flex flex-col overflow-hidden relative">
          <div className="flex items-center gap-1 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button onClick={() => { setExplorerMode('requests'); setSelectedItem(null); }} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${explorerMode === 'requests' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800'}`}>Requests</button>
            <button onClick={() => { setExplorerMode('responses'); setSelectedItem(null); }} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${explorerMode === 'responses' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800'}`}>Responses</button>
          </div>

          {explorerMode === 'requests' ? (
            <div className="flex-1 flex flex-col min-h-0">
              {!isSearching && canCreate && (
                <div className="flex items-center gap-2 mb-3 flex-wrap z-10">
                  {currentPath.length === 0 && (
                    <button onClick={() => { setShowCreateFolder(true); setNewFolderName(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold hover:bg-blue-50 transition shadow-xs">
                      <FolderPlus className="w-3.5 h-3.5" /><span>New Folder</span>
                    </button>
                  )}
                  {currentPath.length >= 1 && (
                    <button onClick={() => { setShowUploadFilesPanel(true); setUploadFilesList([]); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold hover:bg-blue-50 transition shadow-xs">
                      <Upload className="w-3.5 h-3.5" /><span>Upload File</span>
                    </button>
                  )}
                  {currentPath.length >= 1 && (
                    <button onClick={() => setShowCreateResponseModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold hover:bg-emerald-50 transition shadow-xs">
                      <FileText className="w-3.5 h-3.5" /><span>Add Response</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto min-h-0">
                {explorerItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-24 text-slate-400 gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700"><Folder className="w-8 h-8 text-blue-500 fill-blue-500/20" /></div>
                    <div><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Folder is empty</p></div>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-2">
                    {explorerItems.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const isFolder = item.type === 'request';
                      return (
                        <div key={item.id} onClick={() => handleSelectItem(item)} onDoubleClick={() => handleItemDoubleClick(item)} className={`flex flex-col items-center text-center p-3.5 rounded-2xl cursor-pointer transition-all select-none group ${isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]' : 'bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80 text-gray-700 dark:text-gray-200'}`}>
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
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Kind</th>
                          <th className="py-2.5 px-3">Size</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {explorerItems.map((item) => {
                          const isSelected = selectedItem?.id === item.id;
                          const isFolder = item.type === 'request';
                          return (
                            <tr key={item.id} onClick={() => handleSelectItem(item)} onDoubleClick={() => handleItemDoubleClick(item)} className={`cursor-pointer transition ${isSelected ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'}`}>
                              <td className="py-2.5 px-3 flex items-center gap-2.5 max-w-sm">{isFolder ? <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white fill-white' : 'text-blue-500 fill-blue-500/20'}`} /> : <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />}<span className="truncate">{item.name}</span></td>
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Requests</span>
                      {sidebarRequests.map(r => {
                        const isSel = currentPath.length > 0 && currentPath[0].id === r.id;
                        return (<div key={r.id} onClick={() => handleSidebarRequestClick(r)} className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${isSel ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><div className="flex items-center gap-2 truncate"><Folder className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-500'}`} /><span className="truncate">{r.name}</span></div><ChevronRight className={`w-3 h-3 ${isSel ? 'text-white' : 'text-slate-400'}`} /></div>);
                      })}
                    </div>
                    <div className="w-64 shrink-0 h-full overflow-y-auto p-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Contents</span>
                      {explorerItems.map(item => {
                        const isSel = selectedItem?.id === item.id;
                        const isFolder = item.type === 'request';
                        return (<div key={item.id} onClick={() => handleSelectItem(item)} onDoubleClick={() => handleItemDoubleClick(item)} className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${isSel ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><div className="flex items-center gap-2 truncate">{isFolder ? <Folder className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-500'}`} /> : <FileText className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-600'}`} />}<span className="truncate">{item.name}</span></div>{isFolder && <ChevronRight className={`w-3 h-3 ${isSel ? 'text-white' : 'text-slate-400'}`} />}</div>);
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Response Documents List */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="font-bold text-sm mb-3">Response Documents</h3>
                <div className="space-y-2">
                  {(() => {
                    const visibleResponses = currentPath.length === 1 
                      ? responseDocs.filter(r => (r.groupId || r.group_id || r._id) === currentPath[0].id)
                      : responseDocs;
                      
                    if (visibleResponses.length === 0) {
                      return <p className="text-xs text-slate-400 text-center py-6">No response documents found</p>;
                    }
                    
                    return visibleResponses.map(r => {
                      const isResponseSelected = selectedItem?.id === r._id;
                      return (
                      <div
                        key={r._id}
                        onClick={() => handleResponseClick(r)}
                        className={`p-3 border rounded-xl flex items-center justify-between transition cursor-pointer ${isResponseSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className={`w-4 h-4 shrink-0 ${isResponseSelected ? 'text-white' : 'text-emerald-500'}`} />
                          <div className="min-w-0">
                            <p className={`font-semibold text-xs truncate ${isResponseSelected ? 'text-white' : ''}`}>{r.originalName}</p>
                            <p className={`text-[10px] ${isResponseSelected ? 'text-white/70' : 'text-slate-400'}`}>{formatDateTime(r.createdAt)}{r.fileCategoryId?.name ? ` • ${r.fileCategoryId.name}` : ''}</p>
                          </div>
                        </div>
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/department/documents/${r._id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`p-1.5 border rounded transition shrink-0 ${isResponseSelected ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      );
                    });
                  })()}
                </div>
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
                {selectedItem.type === 'response' ? (
                  <FileText className="w-16 h-16 text-emerald-500" />
                ) : selectedItem.type === 'submission' || selectedItem.type === 'result' ? (
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
                {selectedItem.fileCategory && <div><span className="text-slate-400 block font-semibold text-[10px] uppercase">File Category</span><span className="text-slate-700 dark:text-slate-300 font-medium">{selectedItem.fileCategory}</span></div>}
                {selectedItem.createdAt && <div><span className="text-slate-400 block font-semibold text-[10px] uppercase">Date</span><span className="text-slate-700 dark:text-slate-300 font-medium">{formatDateTime(selectedItem.createdAt)}</span></div>}
                {selectedItem.fileSize && <div><span className="text-slate-400 block font-semibold text-[10px] uppercase">Size</span><span className="text-slate-700 dark:text-slate-300 font-medium">{formatFileSize(selectedItem.fileSize)}</span></div>}
                {selectedItem.status && (
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase mb-1">Status</span>
                    {selectedItem.type === 'response' ? (
                      <StatusBadge status={selectedItem.status} />
                    ) : (
                      <select
                        value={selectedItem.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className={`text-xs border rounded-lg px-2.5 py-1.5 outline-none font-semibold capitalize transition-colors ${
                          selectedItem.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500'
                            : selectedItem.status === 'processing'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 focus:ring-purple-500'
                            : 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-500'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                      </select>
                    )}
                  </div>
                )}
                {selectedItem.type === 'response' && selectedItem.notes && (
                  <div><span className="text-slate-400 block font-semibold text-[10px] uppercase">Notes</span><span className="text-slate-700 dark:text-slate-300 font-medium text-xs whitespace-pre-wrap">{selectedItem.notes}</span></div>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto space-y-2">
                {selectedItem.type === 'request' && (
                  <button onClick={() => handleItemDoubleClick(selectedItem)} className="w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-xs transition">Open Folder</button>
                )}
                {selectedItem.doc && (
                  <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/department/documents/${selectedItem.doc._id}/download`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition">
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </a>
                )}
                {selectedItem.type === 'response' && selectedItem.doc && (
                  <button onClick={handleBlockResponse} className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition ${selectedItem.doc.paymentBlocked ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}>
                    <span>{selectedItem.doc.paymentBlocked ? 'Unblock Response' : 'Block Response'}</span>
                  </button>
                )}
                {(canDelete || user?.role === 'super_admin') && (
                  <button onClick={() => handleDeleteItem(selectedItem)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-semibold transition mt-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete {selectedItem.type === 'request' ? 'Folder' : 'File'}</span>
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
                <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/department/documents/${quickLookItem.doc._id}/download`} target="_blank" rel="noopener noreferrer" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Response Modal */}
      {showCreateResponseModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Upload New Response</h3>
              <button onClick={() => setShowCreateResponseModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">File Category</label>
                <select
                  value={selectedFileCategory}
                  onChange={(e) => setSelectedFileCategory(e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a category...</option>
                  {fileCategories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Notes (optional)</label>
                <textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="Add notes about this response..."
                  rows={3}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">File</label>
                <input
                  ref={responseFileInputRef}
                  type="file"
                  onChange={(e) => setResponseFile(e.target.files[0])}
                  className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button onClick={() => setShowCreateResponseModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition">Cancel</button>
              <button
                onClick={handleCreateResponse}
                disabled={creatingResponse || !selectedFileCategory || !responseFile}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <Upload className="w-4 h-4" />
                <span>{creatingResponse ? 'Uploading...' : 'Upload Response'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.open} onClose={() => setConfirmState(s => ({ ...s, open: false }))} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} confirmText={confirmState.confirmText || 'Confirm'} variant={confirmState.variant} />

    </div>
  );
}
