'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { departmentAPI } from '@/lib/api';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
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
} from 'lucide-react';

export default function DeptCustomerDocsExplorer() {
  const { user } = useAuth();
  const canRename = user?.canRename || false;
  const canDelete = user?.canDelete || false;
  const canCreate = user?.canCreate || user?.role === 'super_admin' || false;

  const { customerId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const openGroupId = searchParams.get('openGroup');
  const selectFileId = searchParams.get('selectFile');

  const [docs, setDocs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  // Navigation stack state
  const [currentPath, setCurrentPath] = useState([]); // [{ id, name, type: 'request' }]
  const [history, setHistory] = useState([[]]); // History stack
  const [historyIndex, setHistoryIndex] = useState(0); // Current pointer
  
  const [selectedItem, setSelectedItem] = useState(null); // Selected file or folder
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  // Create folder / upload state (dept user creating folders for the customer)
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showUploadFilesPanel, setShowUploadFilesPanel] = useState(false);
  const [uploadFilesList, setUploadFilesList] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const createFileInputRef = useRef(null);

  useEffect(() => {
    if (selectedItem) {
      setRenameValue(selectedItem.name);
      setIsRenaming(false);
    }
  }, [selectedItem]);

  // Helper to calculate request status from group files
  const getGroupStatus = (groupDocs) => {
    if (groupDocs.some(d => d.paymentBlocked || d.status === 'blocked')) return 'blocked';
    if (groupDocs.every(d => d.status === 'completed')) return 'completed';
    if (groupDocs.some(d => d.status === 'processing')) return 'processing';
    return 'pending';
  };

  const loadData = () => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      departmentAPI.getCustomerDocuments(customerId),
      departmentAPI.getCategories()
    ])
      .then(([docsRes, catRes]) => {
        setDocs(docsRes.data.data);
        setCategories(catRes.data.data);
        
        // If an item is currently selected, refresh its data reference
        if (selectedItem) {
          const freshDocs = docsRes.data.data;
          if (selectedItem.type === 'request') {
            const freshGroup = freshDocs.filter(d => (d.groupId || d._id) === selectedItem.id);
            if (freshGroup.length > 0) {
              setSelectedItem(prev => ({
                ...prev,
                docs: freshGroup,
                status: getGroupStatus(freshGroup)
              }));
            }
          } else {
            // It's a file
            const freshDoc = freshDocs.find(d => d._id === (selectedItem.doc?._id || selectedItem.id));
            if (freshDoc) {
              setSelectedItem(prev => ({
                ...prev,
                status: freshDoc.status,
                doc: freshDoc
              }));
              setNotes(freshDoc.notes || '');
            }
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (docs.length > 0 && openGroupId) {
        const requestDocs = docs.filter(d => (d.groupId || d._id) === openGroupId);
        if (requestDocs.length > 0) {
          const firstDoc = requestDocs[0];
          const dateStr = new Date(firstDoc.createdAt).toLocaleDateString();
          const descSnippet = firstDoc.description
            ? (firstDoc.description.slice(0, 20) + (firstDoc.description.length > 20 ? '...' : ''))
            : 'Submission';
          
          const path = [{
            id: openGroupId,
            name: `Request_${dateStr}_(${descSnippet})`,
            type: 'request'
          }];
          setCurrentPath(path);
          setHistory([[], path]);
          setHistoryIndex(1);

          if (selectFileId) {
            const selectedDoc = requestDocs.find(d => d._id === selectFileId);
            if (selectedDoc) {
              setSelectedItem({
                id: selectFileId,
                name: selectedDoc.title || selectedDoc.originalName,
                type: 'submission',
                fileSize: selectedDoc.fileSize,
                mimeType: selectedDoc.mimeType,
                status: selectedDoc.status,
                createdAt: selectedDoc.createdAt,
                doc: selectedDoc
              });
              setNotes(selectedDoc.notes || '');
            }
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, openGroupId, selectFileId]);

  const handleDownload = async (docId, type, fileName) => {
    try {
      const res = await departmentAPI.downloadFile(docId, type);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed');
    }
  };

  const handleStatusChange = async (docId, status) => {
    try {
      await departmentAPI.updateStatus(docId, { status });
      toast.success(`Status changed to ${status}`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleBlock = async (docId) => {
    try {
      await departmentAPI.blockDocument(docId);
      toast.success('Document blocked for payment');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block');
    }
  };

  const handleUnblock = async (docId) => {
    try {
      await departmentAPI.unblockDocument(docId);
      toast.success('Document unblocked');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unblock');
    }
  };

  const handleSaveNotes = async (docId) => {
    setSavingNotes(true);
    try {
      await departmentAPI.updateNotes(docId, { notes });
      toast.success('Notes saved');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleUploadResult = async (e, docId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedCat) {
      toast.error('Please select a category first');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('categoryId', selectedCat);
    try {
      await departmentAPI.uploadResult(docId, formData);
      toast.success('Result file uploaded');
      setSelectedCat('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePurgeFiles = async (docId) => {
    if (!confirm('Are you sure you want to purge all physical files for this request/group from storage? The database metadata logs will still be preserved.')) {
      return;
    }
    try {
      await departmentAPI.purgeDocumentFiles(docId);
      toast.success('Files successfully purged from storage');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Purge failed');
    }
  };

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleRenameSave = async () => {
    if (!renameValue.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setSavingRename(true);
    try {
      if (selectedItem.type === 'request') {
        await departmentAPI.renameGroup(selectedItem.id, { name: renameValue });
        toast.success('Folder renamed successfully');
      } else if (selectedItem.type === 'submission') {
        await departmentAPI.renameDocument(selectedItem.id, { name: renameValue, isResult: false });
        toast.success('File renamed successfully');
      } else if (selectedItem.type === 'result') {
        await departmentAPI.renameDocument(selectedItem.id.replace('_result', ''), { name: renameValue.replace(/^Result_/, ''), isResult: true });
        toast.success('Result file renamed successfully');
      }
      setIsRenaming(false);
      setSelectedItem(prev => ({ ...prev, name: renameValue }));
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename');
    } finally {
      setSavingRename(false);
    }
  };

  const handleDeleteClick = async () => {
    const isFolder = selectedItem.type === 'request';
    const message = isFolder
      ? 'Are you sure you want to delete this folder and all files inside? The files will be purged from storage, but database records will be kept.'
      : 'Are you sure you want to delete this file? The file content will be purged from storage, but the database record will be kept.';
      
    if (!confirm(message)) return;
    
    try {
      if (isFolder) {
        await departmentAPI.deleteGroup(selectedItem.id);
        toast.success('Folder deleted successfully');
      } else if (selectedItem.type === 'submission') {
        await departmentAPI.deleteDocument(selectedItem.id, { isResult: false });
        toast.success('File deleted successfully');
      } else if (selectedItem.type === 'result') {
        await departmentAPI.deleteDocument(selectedItem.id.replace('_result', ''), { isResult: true });
        toast.success('Result file deleted successfully');
      }
      setSelectedItem(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
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

  // Folder creation (dept user creates folders inside their assigned customer's workspace)
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { toast.error('Folder name is required'); return; }
    setCreatingFolder(true);
    try {
      // departmentId is the logged-in dept user's dept
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

  // File upload into a folder (dept user)
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

  if (loading && docs.length === 0) return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;

  const customerName = docs[0]?.customerId?.name || 'Customer';
  const customerEmail = docs[0]?.customerId?.email || '';

  // Group docs by groupId (or doc._id fallback)
  const groupedRequests = {};
  for (const d of docs) {
    const key = d.groupId || d._id;
    if (!groupedRequests[key]) groupedRequests[key] = [];
    groupedRequests[key].push(d);
  }

  // List of requests for the sidebar tree
  const sidebarRequests = Object.entries(groupedRequests).map(([groupId, groupDocs]) => {
    const firstDoc = groupDocs[0];
    const sla = getSlaStatus(firstDoc.createdAt, getGroupStatus(groupDocs));
    return {
      id: groupId,
      name: firstDoc.customGroupName || formatDateTime(firstDoc.createdAt),
      itemCount: groupDocs.length,
      slaStatus: sla,
      docs: groupDocs
    };
  });

  // Filter documents inside search if query exists
  const isSearching = searchQuery.trim() !== '';
  const searchResults = docs.filter(d =>
    d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get active items based on navigation path depth
  let explorerItems = [];
  const currentDepth = currentPath.length;

  if (currentDepth === 0) {
    // Root level: Show all Request Folders
    explorerItems = sidebarRequests.map(r => ({
      id: r.id,
      name: r.name,
      type: 'request',
      itemCount: r.itemCount,
      status: getGroupStatus(r.docs),
      slaStatus: r.slaStatus,
      docs: r.docs
    }));
  } else if (currentDepth === 1) {
    // Inside a Request Folder: Show files (exclude placeholder records)
    const activeGroupId = currentPath[0].id;
    const groupDocs = docs.filter(d => (d.groupId || d._id) === activeGroupId && !d.isPlaceholder && d.storedPath);
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
    }
  };

  const handleSidebarRequestClick = (req) => {
    setSearchQuery('');
    const folderItem = {
      id: req.id,
      name: req.name,
      type: 'request',
      itemCount: req.itemCount,
      docs: req.docs
    };
    navigateToPath([{ id: req.id, name: req.name, type: 'request' }]);
    setSelectedItem(folderItem);
  };

  return (
    <div className="flex flex-col -m-6 h-screen bg-[#f3f4f6] select-none overflow-hidden">
        
        {/* Top Address & Action Bar */}
        <div className="h-12 bg-white border-b border-[#e5e7eb] flex items-center px-3 justify-between gap-3 shrink-0">
          
          {/* Navigation arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleBack}
              disabled={historyIndex === 0}
              className="p-1 text-gray-700 hover:bg-[#f3f4f6] rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              onClick={handleForward}
              disabled={historyIndex === history.length - 1}
              className="p-1 text-gray-700 hover:bg-[#f3f4f6] rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
              title="Forward"
            >
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              onClick={handleUp}
              disabled={currentPath.length === 0}
              className="p-1 text-gray-700 hover:bg-[#f3f4f6] rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
              title="Up to Parent Folder"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Address Bar Breadcrumbs */}
          <div className="flex-1 max-w-2xl bg-[#f9fafb] border border-[#e5e7eb] rounded-md h-8 flex items-center px-2.5 overflow-x-auto whitespace-nowrap text-xs text-gray-600 gap-1 scrollbar-none font-medium">
            <HardDrive className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-gray-400 font-bold">This PC</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            
            <button
              onClick={() => navigateToPath([])}
              className="hover:text-blue-600 font-bold"
            >
              {customerName}
            </button>
            {currentPath.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-gray-300" />
                <button
                  onClick={() => navigateToPath(currentPath.slice(0, idx + 1))}
                  className={`hover:text-blue-600 truncate max-w-[150px] ${idx === currentPath.length - 1 ? 'text-gray-800 font-semibold' : ''}`}
                >
                  {item.name}
                </button>
              </div>
            ))}
          </div>

          {/* Search Bar Input */}
          <div className="relative w-48 bg-[#f9fafb] border border-[#e5e7eb] rounded-md h-8 flex items-center px-2.5 shrink-0">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search documents..."
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

          {/* Sort Controls */}
          <div className="flex items-center gap-1 border rounded bg-[#f3f4f6] p-0.5 shrink-0 text-xs text-gray-700">
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
              className="p-1 bg-white hover:bg-gray-100 rounded text-gray-600 font-bold text-[10px] w-6 text-center"
              title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortOrder === 'asc' ? '▲' : '▼'}
            </button>
          </div>

          {/* Layout Mode Toggles */}
          {!isSearching && (
            <div className="flex border rounded bg-[#f3f4f6] p-0.5 shrink-0">
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

        {/* Workspace split into Sidebar, Files List, Details */}
        <div className="flex flex-row flex-1 overflow-hidden">
          
          {/* Left Tree Directory Sidebar */}
          <div className="w-52 bg-white border-r border-[#e5e7eb] h-full overflow-y-auto shrink-0 flex flex-col p-2 text-xs text-gray-700">
            {/* Navigation Block */}
            <div className="mb-3 border-b pb-2">
              <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Navigation</span>
              <Link
                href="/department/customers"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-100 transition text-blue-600 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-blue-500" />
                <span>Back to Customers</span>
              </Link>
            </div>
            {/* Quick Access Block */}
            <div className="mb-4">
              <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Quick Access</span>
              <button
                onClick={() => navigateToPath([])}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${currentPath.length === 0 && !isSearching ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none' : 'hover:bg-gray-100'}`}
              >
                <Monitor className="w-3.5 h-3.5 text-blue-500" />
                <span>All Requests</span>
              </button>
            </div>

            {/* Folder list tree */}
            <div>
              <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Folders</span>
              <div className="space-y-0.5">
                {sidebarRequests.map(req => {
                  const isActive = currentPath.length > 0 && currentPath[0].id === req.id && !isSearching;
                  return (
                    <button
                      key={req.id}
                      onClick={() => handleSidebarRequestClick(req)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${isActive ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none' : 'hover:bg-gray-100'}`}
                    >
                      <Folder className="w-3.5 h-3.5 text-blue-400 fill-blue-50/50" />
                      <span className="truncate" title={req.name}>{req.name}</span>
                      {req.slaStatus && ['overdue', 'approaching'].includes(req.slaStatus) && (
                        <span className={`ml-auto text-[9px] font-bold px-1 py-0.5 rounded ${
                          req.slaStatus === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {req.slaStatus === 'overdue' ? 'OVR' : 'AT RISK'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Files Pane */}
          <div className="flex-1 bg-white h-full overflow-y-auto p-4 flex flex-col">

            {/* Create Folder / Upload File toolbar – visible for dept users with canCreate */}
            {!isSearching && canCreate && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {currentPath.length === 0 && (
                  <button
                    onClick={() => { setShowCreateFolder(true); setNewFolderName(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-xs font-semibold hover:bg-amber-100 transition"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New Folder
                  </button>
                )}
                {currentPath.length >= 1 && (
                  <button
                    onClick={() => { setShowUploadFilesPanel(true); setUploadFilesList([]); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-xs font-semibold hover:bg-blue-100 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload File
                  </button>
                )}
              </div>
            )}

            {/* Create Folder inline panel */}
            {showCreateFolder && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 flex-wrap">
                <FolderPlus className="w-4 h-4 text-amber-600 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowCreateFolder(false); }}
                  className="flex-1 min-w-0 px-2 py-1 border border-amber-300 rounded text-xs outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
                <button onClick={handleCreateFolder} disabled={creatingFolder} className="px-3 py-1 bg-amber-500 text-white rounded text-xs font-semibold hover:bg-amber-600 disabled:opacity-50">
                  {creatingFolder ? 'Creating...' : 'Create'}
                </button>
                <button onClick={() => setShowCreateFolder(false)} className="px-2 py-1 border rounded text-xs text-gray-600 hover:bg-gray-100">Cancel</button>
              </div>
            )}

            {/* Upload Files inline panel */}
            {showUploadFilesPanel && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-blue-700">Upload files into this folder</span>
                  <button onClick={() => setShowUploadFilesPanel(false)} className="ml-auto p-0.5 hover:bg-blue-100 rounded"><X className="w-3.5 h-3.5 text-blue-500" /></button>
                </div>
                <input
                  ref={createFileInputRef}
                  type="file"
                  multiple
                  onChange={e => setUploadFilesList(Array.from(e.target.files || []))}
                  className="block w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                />
                {uploadFilesList.length > 0 && <p className="text-[10px] text-blue-600">{uploadFilesList.length} file(s) selected</p>}
                <div className="flex gap-2">
                  <button onClick={handleUploadFilesToFolder} disabled={uploadingFiles || uploadFilesList.length === 0} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {uploadingFiles ? 'Uploading...' : 'Upload'}
                  </button>
                  <button onClick={() => setShowUploadFilesPanel(false)} className="px-2 py-1 border rounded text-xs text-gray-600 hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            )}

            {isSearching ? (

              /* Search results list */
              <div className="space-y-2 flex-1">
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
                          onClick={() => handleSelectItem({ id: d._id, name: d.title || d.originalName, type: 'submission', doc: d })}
                          className={`cursor-pointer ${selectedItem?.id === d._id ? 'bg-blue-50 font-medium' : 'hover:bg-gray-50/50'}`}
                        >
                          <td className="py-2.5 px-2 flex items-center gap-2 max-w-xs">
                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
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
              /* Folder navigation */
              <div className="flex-1">
                {explorerItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400 gap-2">
                    <Folder className="w-12 h-12 text-gray-200 stroke-1" />
                    <span className="text-xs font-semibold">Folder is empty</span>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* Grid view */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                      const isFolder = item.type === 'request';
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                          className={`flex flex-col items-center text-center p-3 border rounded-lg cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-blue-50/80 border-[#93c5fd] shadow-sm'
                              : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                          }`}
                        >
                          {isFolder ? (
                            <div className="relative">
                              <Folder className="w-12 h-12 text-[#3b82f6] fill-[#ebf8ff]" />
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
                              <FileText className="w-12 h-12 text-[#2563eb] fill-blue-50" />
                              {item.doc?.resultFile && (
                                <CheckCircle className="w-3 h-3 text-green-600 bg-white rounded-full absolute -bottom-0.5 -right-0.5" />
                              )}
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
                  /* Details list view */
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
                          const isFolder = item.type === 'request';
                          return (
                            <tr
                              key={item.id}
                              onClick={() => handleSelectItem(item)}
                              onDoubleClick={() => handleItemDoubleClick(item)}
                              className={`cursor-pointer ${
                                isSelected ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50/50'
                              }`}
                            >
                              <td className="py-2 px-3 flex items-center gap-2 max-w-sm">
                                {isFolder ? (
                                  <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                ) : item.type === 'result' ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                ) : (
                                  <File className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                )}
                                <span className="truncate">{item.name}</span>
                              </td>
                              <td className="py-2 px-3 text-gray-500 capitalize">{item.type === 'request' ? 'Request batch' : 'File'}</td>
                              <td className="py-2 px-3 text-gray-500">{isFolder ? `${item.itemCount} items` : formatFileSize(item.fileSize)}</td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {item.slaStatus && item.status !== 'completed' && item.status !== 'blocked' && <SlaBadge slaStatus={item.slaStatus} />}
                                  {item.status ? <StatusBadge status={item.status} /> : '-'}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Details Panel */}
          <div className={`w-72 bg-[#f9fafb] border-l border-[#e5e7eb] h-full p-4 overflow-y-auto shrink-0 flex flex-col gap-4 relative transition-all duration-300 ${selectedItem ? 'opacity-100 translate-x-0' : 'lg:opacity-90 lg:block hidden bg-gray-50/30'}`}>
            {selectedItem ? (
              <div className="flex flex-col h-full gap-4 overflow-y-auto max-h-[850px] scrollbar-none pr-1">
                
                {/* Header */}
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">File Properties</span>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-0.5 text-gray-400 hover:bg-[#e5e7eb] rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Preview Graphic */}
                <div className="p-8 bg-white border border-[#e5e7eb] rounded-lg flex items-center justify-center shadow-xs">
                  {selectedItem.type === 'request' ? (
                    <Folder className="w-12 h-12 text-blue-500" />
                  ) : selectedItem.type === 'result' ? (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-blue-500" />
                  )}
                </div>

                {/* Metadata Properties */}
                <div className="space-y-2.5 text-[11px] border-t border-[#e5e7eb] pt-3">
                  {isRenaming ? (
                  <div className="space-y-1">
                    <span className="text-gray-400 block font-semibold">Name:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-[11px] bg-white outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-800"
                        required
                      />
                      <button
                        onClick={handleRenameSave}
                        disabled={savingRename}
                        className="p-1 bg-green-500 hover:bg-green-600 text-white rounded shadow-xs"
                        title="Save"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsRenaming(false)}
                        className="p-1 bg-gray-400 hover:bg-gray-500 text-white rounded shadow-xs"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="truncate">
                    <span className="text-gray-400 block font-semibold">Name:</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-800 font-bold break-all flex-1" title={selectedItem.name}>{selectedItem.name}</span>
                      {canRename && ['request', 'submission', 'result'].includes(selectedItem.type) && (
                        <button
                          onClick={() => { setIsRenaming(true); setRenameValue(selectedItem.name); }}
                          className="p-1 hover:bg-[#e5e7eb] rounded text-gray-500 shrink-0"
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                  <div>
                    <span className="text-gray-400 block font-semibold">Type:</span>
                    <span className="text-gray-700 capitalize font-medium">{selectedItem.type === 'request' ? 'Request Batch' : selectedItem.type === 'submission' ? 'Submission File' : 'Result Response File'}</span>
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

                  {/* Customer Description */}
                  {(selectedItem.doc?.description || selectedItem.docs?.[0]?.description) && (
                    <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-900 mt-2">
                      <span className="text-[9px] uppercase font-extrabold tracking-wider">Customer Description</span>
                      <p className="mt-0.5 text-xs font-normal italic leading-relaxed whitespace-pre-wrap">
                        &ldquo;{selectedItem.doc?.description || selectedItem.docs[0].description}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                {/* Requires Result Callout */}
                {(selectedItem.type === 'submission' || selectedItem.type === 'result') && (
                  <div className="border-t border-[#e5e7eb] pt-3 text-[11px]">
                    {selectedItem.doc.requiresResult ? (
                      <div className="p-2 bg-blue-50 border border-blue-100 rounded-md text-blue-800 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span><strong>Expected:</strong> This request expects a response file.</span>
                      </div>
                    ) : (
                      <div className="p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span>No result file is expected.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Internal Notes Edit Area */}
                {(selectedItem.type === 'submission' || selectedItem.type === 'result') && (
                  <div className="border-t border-[#e5e7eb] pt-3 space-y-1.5">
                    <span className="text-[11px] font-semibold text-gray-755 block">Internal Notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Add internal notes..."
                      className="w-full p-2 border rounded-md text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <button
                      onClick={() => handleSaveNotes(selectedItem.doc._id)}
                      disabled={savingNotes}
                      className="w-full py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-semibold text-xs shadow-sm transition disabled:opacity-50"
                    >
                      {savingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                )}

                {/* Status and Payment Control Buttons */}
                {(selectedItem.type === 'submission' || selectedItem.type === 'result') && (
                  <div className="border-t border-[#e5e7eb] pt-3 space-y-3">
                    <div>
                      <span className="text-[11px] font-semibold text-gray-755 block mb-1">Update Status</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStatusChange(selectedItem.doc._id, 'pending')}
                          disabled={selectedItem.doc.status === 'pending'}
                          className="flex-1 py-1 px-1 border rounded text-[9px] font-medium hover:bg-gray-50 disabled:opacity-40"
                        >
                          Pending
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedItem.doc._id, 'processing')}
                          disabled={selectedItem.doc.status === 'processing'}
                          className="flex-1 py-1 px-1 border rounded text-[9px] font-medium hover:bg-gray-50 disabled:opacity-40"
                        >
                          Processing
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedItem.doc._id, 'completed')}
                          disabled={selectedItem.doc.status === 'completed'}
                          className="flex-1 py-1 px-1 border rounded text-[9px] font-medium hover:bg-gray-50 disabled:opacity-40"
                        >
                          Completed
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-gray-755 block mb-1">Payment Control</span>
                      {selectedItem.doc.paymentBlocked ? (
                        <button
                          onClick={() => handleUnblock(selectedItem.doc._id)}
                          className="w-full py-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Unblock File (Paid)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBlock(selectedItem.doc._id)}
                          className="w-full py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition"
                        >
                          <Ban className="w-3.5 h-3.5 text-red-600" /> Block for Payment
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Upload Result Block (Only for submission files, if result is expected) */}
                {selectedItem.type === 'submission' && selectedItem.doc.requiresResult && (
                  <div className="border-t border-[#e5e7eb] pt-3 space-y-2">
                    <span className="text-[11px] font-semibold text-gray-755 block">Upload Result File</span>
                    {!selectedItem.doc.resultFile ? (
                      <div className="space-y-1.5">
                        <div>
                          <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Result Category (Required)</label>
                          <select
                            value={selectedCat}
                            onChange={(e) => setSelectedCat(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-[11px] bg-white outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          >
                            <option value="">Select category</option>
                            {categories.map(c => (
                              <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Select File</label>
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={(e) => handleUploadResult(e, selectedItem.doc._id)}
                            disabled={uploading || !selectedCat}
                            className="block w-full text-[10px] text-gray-550 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                          />
                          {uploading && <p className="text-[9px] text-gray-500 mt-1">Uploading...</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-green-50 border border-green-150 rounded text-[11px] font-semibold text-green-800 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                        <span>Result uploaded successfully.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Storage Control */}
                {(selectedItem.type === 'submission' || selectedItem.type === 'result' || selectedItem.type === 'request') && (
                  <div className="border-t border-[#e5e7eb] pt-3 space-y-1.5">
                    <span className="text-[11px] font-semibold text-gray-755 block">Storage Control</span>
                    {selectedItem.type === 'request' ? (
                      selectedItem.docs?.every(d => d.fileDeletedFromStorage) ? (
                        <div className="p-2 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-medium">
                          <AlertTriangle size={12} className="inline mr-1" /> Files in this request have already been purged.
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePurgeFiles(selectedItem.docs[0]._id)}
                          className="w-full py-1.5 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded font-semibold text-xs shadow-xs transition"
                        >
                          Purge All Files in Request
                        </button>
                      )
                    ) : (
                      (selectedItem.type === 'submission' && selectedItem.doc.fileDeletedFromStorage) || (selectedItem.type === 'result' && selectedItem.doc.resultFileDeletedFromStorage) ? (
                        <div className="p-2 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-medium">
                          <AlertTriangle size={12} className="inline mr-1" /> Physical file purged from disk.
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePurgeFiles(selectedItem.doc._id)}
                          className="w-full py-1.5 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded font-semibold text-xs shadow-xs transition"
                        >
                          Purge File from Storage
                        </button>
                      )
                    )}
                  </div>
                )}

                {/* Download / Actions */}
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
                      {selectedItem.type === 'result' && selectedItem.doc.resultFileDeletedFromStorage ? (
                        <div className="p-2.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-medium">
                          Result file is purged.
                        </div>
                      ) : selectedItem.type === 'submission' && selectedItem.doc.fileDeletedFromStorage ? (
                        <div className="p-2.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-medium">
                          Submission file is purged.
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleDownload(
                              selectedItem.doc._id,
                              selectedItem.type,
                              selectedItem.type === 'result' ? selectedItem.doc.resultFile.originalName : selectedItem.doc.originalName
                            )
                          }
                          className="w-full py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Download File
                        </button>
                      )}
                    </>
                  )}
                  {canDelete && ['request', 'submission', 'result'].includes(selectedItem.type) && (
                    <button
                      onClick={handleDeleteClick}
                      className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition animate-in fade-in duration-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete {selectedItem.type === 'request' ? 'Folder' : 'File'}
                    </button>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-1.5 py-12">
                <Info className="w-8 h-8 text-gray-300 stroke-1.5" />
                <p className="text-xs font-semibold">Select a file or folder to view details.</p>
              </div>
            )}
          </div>

      </div>
    </div>
  );
}


