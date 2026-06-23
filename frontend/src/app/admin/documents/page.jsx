'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { adminAPI } from '@/lib/api';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import SlaBadge from '@/components/ui/SlaBadge';
import { formatDateTime, formatFileSize, getSlaStatus } from '@/lib/utils';
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
  PanelRight,
  PanelRightClose,
} from 'lucide-react';

export default function AdminDocumentsExplorer() {
  const [docs, setDocs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', departmentId: '' });
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  // Navigation stack state
  const [currentPath, setCurrentPath] = useState([]); // [{ id, name, type }]
  const [history, setHistory] = useState([[]]); // History stack
  const [historyIndex, setHistoryIndex] = useState(0); // Current pointer
  
  const [selectedItem, setSelectedItem] = useState(null); // selected folder or file
  const [panelOpen, setPanelOpen] = useState(true);
  
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

  useEffect(() => {
    if (selectedItem) {
      setRenameValue(selectedItem.name);
      setIsRenaming(false);
    }
  }, [selectedItem]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, deptRes] = await Promise.all([
        adminAPI.getAllDocuments(filters),
        adminAPI.getDepartments()
      ]);
      setDocs(docRes.data.data);
      setDepartments(deptRes.data.data);
      
      // If we have a selected file, refresh its state
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
  }, [filters, selectedItem]);

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setPanelOpen(true);
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
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = async (docId) => {
    try {
      await adminAPI.blockDocument(docId);
      toast.success('Document blocked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block');
    }
  };

  const handleUnblock = async (docId) => {
    try {
      await adminAPI.unblockDocument(docId);
      toast.success('Document unblocked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unblock');
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await adminAPI.deleteDocument(docId);
      toast.success('Document deleted');
      setSelectedItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handlePurgeFiles = async (docId) => {
    if (!confirm('Are you sure you want to purge all physical files for this request/group from storage? The database metadata logs will still be preserved.')) {
      return;
    }
    try {
      await adminAPI.purgeDocumentFiles(docId);
      toast.success('Files successfully purged from storage');
      load();
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
      if (selectedItem.type === 'customer') {
        const custData = groupedByCustomer[selectedItem.id];
        await adminAPI.updateCustomer(selectedItem.id, {
          name: renameValue,
          email: custData?.email || '',
          isActive: custData?.isActive !== false
        });
        toast.success('Customer folder renamed successfully');
      } else if (selectedItem.type === 'dept') {
        const dept = departments.find(d => d._id === selectedItem.id);
        await adminAPI.updateDepartment(selectedItem.id, {
          name: renameValue,
          description: dept?.description || '',
          isActive: dept?.isActive !== false,
          permissions: dept?.permissions
        });
        toast.success('Department folder renamed successfully');
      } else if (selectedItem.type === 'request') {
        await adminAPI.renameGroup(selectedItem.id, { name: renameValue });
        toast.success('Folder renamed successfully');
      } else if (selectedItem.type === 'file') {
        await adminAPI.renameDocument(selectedItem.id, { name: renameValue, isResult: false });
        toast.success('File renamed successfully');
      } else if (selectedItem.type === 'result_file') {
        await adminAPI.renameDocument(selectedItem.id.replace('_result', ''), { name: renameValue.replace(/^Result_/, ''), isResult: true });
        toast.success('Result file renamed successfully');
      }
      setIsRenaming(false);
      setSelectedItem(prev => ({ ...prev, name: renameValue }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename');
    } finally {
      setSavingRename(false);
    }
  };

  const handleSoftDeleteClick = async () => {
    const isFolder = selectedItem.type === 'request';
    const message = isFolder
      ? 'Are you sure you want to soft delete this folder and all files inside? The files will be purged from storage, but database records will be kept.'
      : 'Are you sure you want to soft delete this file? The file content will be purged from storage, but the database record will be kept.';
      
    if (!confirm(message)) return;
    
    try {
      if (isFolder) {
        await adminAPI.softDeleteGroup(selectedItem.id);
        toast.success('Folder soft deleted');
      } else if (selectedItem.type === 'file') {
        await adminAPI.softDeleteDocument(selectedItem.id, { isResult: false });
        toast.success('File soft deleted');
      } else if (selectedItem.type === 'result_file') {
        await adminAPI.softDeleteDocument(selectedItem.id.replace('_result', ''), { isResult: true });
        toast.success('Result file soft deleted');
      }
      setSelectedItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Soft delete failed');
    }
  };

  // Folder creation handler (admin: needs to know the target customerId + departmentId from current path)
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { toast.error('Folder name is required'); return; }
    // Admin needs depth >= 2: customer + dept selected
    const customerId = currentPath[0]?.id;
    const departmentId = currentPath[1]?.id;
    if (!customerId || !departmentId) { toast.error('Navigate into a customer department before creating a folder'); return; }
    setCreatingFolder(true);
    try {
      await adminAPI.createFolder({ folderName: newFolderName.trim(), customerId, departmentId });
      toast.success('Folder created successfully');
      setNewFolderName('');
      setShowCreateFolder(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  // File upload handler (into an existing request folder)
  const handleUploadFiles = async () => {
    if (uploadFiles.length === 0) { toast.error('Select at least one file'); return; }
    const groupId = currentPath[currentPath.length - 1]?.id;
    if (!groupId) { toast.error('Navigate into a request folder before uploading'); return; }
    setUploading(true);
    const formData = new FormData();
    uploadFiles.forEach(f => formData.append('files', f));
    try {
      await adminAPI.uploadFilesToFolder(groupId, formData);
      toast.success('Files uploaded successfully');
      setUploadFiles([]);
      setShowUploadFiles(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
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

  // Helper to calculate request status from group files
  const getGroupStatus = (groupDocs) => {
    if (groupDocs.some(d => d.paymentBlocked || d.status === 'blocked')) return 'blocked';
    if (groupDocs.every(d => d.status === 'completed')) return 'completed';
    if (groupDocs.some(d => d.status === 'processing')) return 'processing';
    return 'pending';
  };

  // Check if search filters are active. If so, display a flat search results details list (like Windows Explorer).
  const isSearchOrFilterActive = search.trim() !== '' || filters.status !== '' || filters.departmentId !== '';

  const searchedDocs = docs.filter(d =>
    (!search || d.customerId?.name?.toLowerCase().includes(search.toLowerCase()) || d.title?.toLowerCase().includes(search.toLowerCase()) || d.originalName?.toLowerCase().includes(search.toLowerCase()))
  );

  // Grouping structures for hierarchical folder navigation
  const groupedByCustomer = {};
  for (const d of docs) {
    const custId = d.customerId?._id || 'unknown';
    const custName = d.customerId?.name || 'Unknown';
    const custEmail = d.customerId?.email || '';
    const folderName = custName;
    
    if (!groupedByCustomer[custId]) {
      groupedByCustomer[custId] = {
        id: custId,
        name: folderName,
        realName: custName,
        email: custEmail,
        docs: []
      };
    }
    groupedByCustomer[custId].docs.push(d);
  }

  // Customers list for sidebar tree navigation
  const sidebarCustomers = Object.values(groupedByCustomer);

  // Active items in explorer
  let explorerItems = [];
  const currentDepth = currentPath.length;

  if (currentDepth === 0) {
    // Level 1: Customer Folders
    explorerItems = sidebarCustomers.map(c => ({
      id: c.id,
      name: c.name,
      type: 'customer',
      itemCount: c.docs.length,
      docs: c.docs
    }));
  } else if (currentDepth === 1) {
    // Level 2: Inside Customer -> show Departments
    const activeCustomerId = currentPath[0].id;
    const customerData = groupedByCustomer[activeCustomerId];
    if (customerData) {
      const depts = {};
      for (const d of customerData.docs) {
        const deptId = d.departmentId?._id || 'general';
        const deptName = d.departmentId?.name || 'General';
        if (!depts[deptId]) {
          depts[deptId] = {
            id: deptId,
            name: deptName,
            docs: []
          };
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
    // Level 3: Inside Customer > Dept -> show Request folders
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
    // Level 4: Inside Request Folder -> show Files
    const activeCustomerId = currentPath[0].id;
    const activeDeptId = currentPath[1].id;
    const activeGroupId = currentPath[2].id;
    const customerData = groupedByCustomer[activeCustomerId];
    if (customerData) {
      const groupDocs = customerData.docs.filter(d =>
        (d.groupId || d._id) === activeGroupId &&
        (d.departmentId?._id || 'general') === activeDeptId &&
        !d.isPlaceholder && d.storedPath  // exclude folder placeholders with no file
      );
      for (const d of groupDocs) {
        // Submission file
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
        // Result file if exists
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

  const handleItemDoubleClick = (item) => {
    if (item.type === 'customer') {
      navigateToPath([{ id: item.id, name: item.name, type: 'customer' }]);
    } else if (item.type === 'dept') {
      navigateToPath([...currentPath, { id: item.id, name: item.name, type: 'dept' }]);
    } else if (item.type === 'request') {
      navigateToPath([...currentPath, { id: item.id, name: item.name, type: 'request' }]);
    }
  };

  const handleSidebarCustomerClick = (c) => {
    setSearch('');
    const folderItem = {
      id: c.id,
      name: c.name,
      type: 'customer',
      itemCount: c.docs.length,
      docs: c.docs
    };
    navigateToPath([{ id: c.id, name: c.name, type: 'customer' }]);
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
              All Customers
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
              placeholder="Search customers/files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs ml-1.5 outline-none text-gray-700"
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-0.5 hover:bg-[#e5e7eb] rounded-full text-gray-400">
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
          {!isSearchOrFilterActive && (
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

          {/* Panel Toggle */}
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-1.5 rounded hover:bg-gray-200 transition text-gray-500 hover:text-gray-700 shrink-0"
            title={panelOpen ? 'Close panel' : 'Open panel'}
          >
            {panelOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
          </button>
        </div>

        {/* Windows Explorer Style Sub-Toolbar for Filters */}
        <div className="h-10 bg-white border-b border-[#e5e7eb] px-3 flex items-center gap-2 justify-between shrink-0 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider mr-1">Filters:</span>
            
            {/* Quick Status Select */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-2 py-1 border rounded text-[11px] outline-none bg-[#f9fafb] focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
            </select>

            {/* Quick Department Select */}
            <select
              value={filters.departmentId}
              onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
              className="px-2 py-1 border rounded text-[11px] outline-none bg-[#f9fafb] focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>

          {(search || filters.status || filters.departmentId) && (
            <button
              onClick={() => {
                setSearch('');
                setFilters({ status: '', departmentId: '' });
              }}
              className="text-[11px] text-red-600 hover:underline font-bold"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Workspace split into Sidebar, Files List, Details */}
        <div className="flex flex-row flex-1 overflow-hidden">
          
          {/* Left Tree Directory Sidebar */}
          <div className="w-52 bg-white border-r border-[#e5e7eb] h-full overflow-y-auto shrink-0 flex flex-col p-2 text-xs text-gray-700">
            {/* Quick Access Block */}
            <div className="mb-4">
              <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Quick Access</span>
              <button
                onClick={() => navigateToPath([])}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${currentPath.length === 0 && !isSearchOrFilterActive ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none' : 'hover:bg-gray-100'}`}
              >
                <Monitor className="w-3.5 h-3.5 text-blue-500" />
                <span>All Customers</span>
              </button>
            </div>

            {/* Customers list tree */}
            <div>
              <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Customer Spaces</span>
              <div className="space-y-0.5">
                {sidebarCustomers.map(c => {
                  const isActive = currentPath.length > 0 && currentPath[0].id === c.id && !isSearchOrFilterActive;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSidebarCustomerClick(c)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${isActive ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none' : 'hover:bg-gray-100'}`}
                    >
                      <Folder className="w-3.5 h-3.5 text-amber-600 fill-amber-200/80" />
                      <span className="truncate" title={c.name}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Files Pane */}
          <div className="flex-1 bg-white h-full overflow-y-auto p-4 flex flex-col">

            {/* Create Folder / Upload File action toolbar – visible for admin at appropriate depth */}
            {!isSearchOrFilterActive && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {/* New Folder: only at depth 2 (inside customer > dept) */}
                {currentPath.length >= 2 && (
                  <button
                    onClick={() => { setShowCreateFolder(true); setNewFolderName(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-xs font-semibold hover:bg-amber-100 transition"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New Folder
                  </button>
                )}
                {/* Upload File: only inside a request folder (depth 3) */}
                {currentPath.length >= 3 && (
                  <button
                    onClick={() => { setShowUploadFiles(true); setUploadFiles([]); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-xs font-semibold hover:bg-blue-100 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload File
                  </button>
                )}
              </div>
            )}

            {/* Create Folder inline modal */}
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

            {/* Upload Files inline modal */}
            {showUploadFiles && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-blue-700">Upload files into this folder</span>
                  <button onClick={() => setShowUploadFiles(false)} className="ml-auto p-0.5 hover:bg-blue-100 rounded"><X className="w-3.5 h-3.5 text-blue-500" /></button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={e => setUploadFiles(Array.from(e.target.files || []))}
                  className="block w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                />
                {uploadFiles.length > 0 && (
                  <p className="text-[10px] text-blue-600">{uploadFiles.length} file(s) selected</p>
                )}
                <div className="flex gap-2">
                  <button onClick={handleUploadFiles} disabled={uploading || uploadFiles.length === 0} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <button onClick={() => setShowUploadFiles(false)} className="px-2 py-1 border rounded text-xs text-gray-600 hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            )}

            {isSearchOrFilterActive ? (

              /* Flat search results list */
              <div className="space-y-2 flex-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Search Results ({searchedDocs.length} matches)</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#e5e7eb] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer">
                        <th className="py-2 px-2 hover:text-blue-600" onClick={() => handleHeaderClick('name')}>Name {sortField === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                        <th className="py-2 px-2">Customer</th>
                        <th className="py-2 px-2">Department</th>
                        <th className="py-2 px-2 hover:text-blue-600" onClick={() => handleHeaderClick('size')}>Size {sortField === 'size' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                        <th className="py-2 px-2 text-center hover:text-blue-600" onClick={() => handleHeaderClick('status')}>Status {sortField === 'status' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e7eb]">
                      {[...searchedDocs].sort((a, b) => {
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
                      }).map((doc) => {
                        const isSelected = selectedItem?.id === doc._id;
                        return (
                          <tr
                            key={doc._id}
                            onClick={() => handleSelectItem({ id: doc._id, name: doc.title || doc.originalName, type: 'file', doc })}
                            className={`cursor-pointer ${selectedItem?.id === doc._id ? 'bg-blue-50 font-medium' : 'hover:bg-gray-50/50'}`}
                          >
                            <td className="py-2.5 px-2 flex items-center gap-2 max-w-xs">
                              <FileText className="w-3.5 h-3.5 text-blue-600 fill-white shrink-0" />
                              <span className="truncate">{doc.title || doc.originalName}</span>
                            </td>
                            <td className="py-2.5 px-2 text-gray-600">{doc.customerId?.name || 'Unknown'}</td>
                            <td className="py-2.5 px-2 text-gray-600">{doc.departmentId?.name || 'General'}</td>
                            <td className="py-2.5 px-2 text-gray-500">{formatFileSize(doc.fileSize)}</td>
                            <td className="py-2.5 px-2 text-center">
                              <StatusBadge status={doc.paymentBlocked ? 'blocked' : doc.status} size="sm" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Folder navigation */
              <div className="flex-1">
                {explorerItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400 gap-2">
                    <Folder className="w-12 h-12 text-amber-300 fill-amber-100/50" />
                    <span className="text-xs font-semibold">Folder is empty</span>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* Grid view */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {[...explorerItems].sort((a, b) => {
                      const aFolder = ['customer', 'dept', 'request'].includes(a.type);
                      const bFolder = ['customer', 'dept', 'request'].includes(b.type);
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
                      const isFolder = item.type !== 'file' && item.type !== 'result_file';
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
                              <Folder
                                className={`w-12 h-12 ${
                                  item.type === 'customer'
                                    ? 'text-amber-600 fill-amber-200/80'
                                    : item.type === 'dept'
                                    ? 'text-amber-600 fill-amber-200/80'
                                    : 'text-amber-600 fill-amber-200/80'
                                }`}
                              />
                              <span className="absolute bottom-2 right-1.5 bg-white text-[8px] font-extrabold text-gray-500 px-0.5 border border-[#d1d5db] rounded shadow-xs">
                                {item.itemCount}
                              </span>
                            </div>
                          ) : item.type === 'result_file' ? (
                            <div className="relative">
                              <FileText className="w-12 h-12 text-green-500 fill-green-50" />
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 bg-white rounded-full absolute -bottom-0.5 -right-0.5" />
                            </div>
                          ) : (
                            <div className="relative">
                              <FileText className="w-12 h-12 text-blue-600 fill-white" />
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
                          const aFolder = ['customer', 'dept', 'request'].includes(a.type);
                          const bFolder = ['customer', 'dept', 'request'].includes(b.type);
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
                          const isFolder = item.type !== 'file' && item.type !== 'result_file';
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
                                  <Folder
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      item.type === 'customer'
                                        ? 'text-amber-600 fill-amber-200/80'
                                        : item.type === 'dept'
                                        ? 'text-amber-600 fill-amber-200/80'
                                        : 'text-amber-600 fill-amber-200/80'
                                    }`}
                                  />
                                ) : item.type === 'result_file' ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                ) : (
                                  <File className="w-3.5 h-3.5 text-blue-600 fill-white shrink-0" />
                                )}
                                <span className="truncate">{item.name}</span>
                              </td>
                              <td className="py-2 px-3 text-gray-500 capitalize">{item.type === 'customer' ? 'Customer Space' : item.type === 'dept' ? 'Department Folder' : item.type === 'request' ? 'Request Batch' : 'Document File'}</td>
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
          <div className={`${panelOpen ? 'w-72' : 'w-0 overflow-hidden'} bg-[#f9fafb] border-l border-[#e5e7eb] h-full p-4 overflow-y-auto shrink-0 flex flex-col gap-4 relative transition-all duration-300`}>
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
                  {selectedItem.type === 'file' ? (
                    <FileText className="w-12 h-12 text-blue-600 fill-white" />
                  ) : selectedItem.type === 'result_file' ? (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  ) : (
                    <Folder
                      className={`w-12 h-12 text-amber-600 fill-amber-200/80`}
                    />
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
                        {['customer', 'dept', 'request', 'file', 'result_file'].includes(selectedItem.type) && (
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
                    <span className="text-gray-700 capitalize font-medium">{selectedItem.type === 'customer' ? 'Customer Folder' : selectedItem.type === 'dept' ? 'Department Folder' : selectedItem.type === 'request' ? 'Request Batch' : selectedItem.type === 'file' ? 'Submission File' : 'Result Response File'}</span>
                  </div>
                  {selectedItem.doc && (
                    <>
                      <div>
                        <span className="text-gray-400 block font-semibold">Customer Name:</span>
                        <span className="text-gray-700 font-medium">{selectedItem.doc.customerId?.name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Customer Email:</span>
                        <span className="text-gray-700 font-medium">{selectedItem.doc.customerId?.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Department Assigned:</span>
                        <span className="text-gray-700 font-medium">{selectedItem.doc.departmentId?.name || 'N/A'}</span>
                      </div>
                    </>
                  )}
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
                      <span className="text-gray-400 block font-semibold">Uploaded At:</span>
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

                {/* Edit Form (Only for Files) */}
                {selectedItem.type === 'file' && (
                  <div className="border-t border-[#e5e7eb] pt-3 space-y-2">
                    <span className="text-[11px] font-semibold text-gray-755 block">Edit Metadata</span>
                    
                    <div>
                      <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Document Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-2 py-1.5 border rounded text-[11px] bg-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Update Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-2 py-1.5 border rounded text-[11px] bg-white outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Internal Notes</label>
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1.5 border rounded text-[11px] bg-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <button
                      onClick={() => handleSaveDoc(selectedItem.doc._id)}
                      disabled={saving}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs shadow-xs transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}

                {/* Payment Blocking Actions (Only for Files) */}
                {selectedItem.type === 'file' && (
                  <div className="border-t border-[#e5e7eb] pt-3 space-y-1.5">
                    <span className="text-[11px] font-semibold text-gray-755 block">Payment Control</span>
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
                        <Ban className="w-3.5 h-3.5 text-red-650" /> Block for Payment
                      </button>
                    )}
                  </div>
                )}

                {/* Physical Storage Controls */}
                {(selectedItem.type === 'file' || selectedItem.type === 'result_file' || selectedItem.type === 'request') && (
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
                      (selectedItem.type === 'file' && selectedItem.doc.fileDeletedFromStorage) || (selectedItem.type === 'result_file' && selectedItem.doc.resultFileDeletedFromStorage) ? (
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

                {/* Admin Deletion Controls */}
                {['request', 'file', 'result_file'].includes(selectedItem.type) && (
                  <div className="border-t border-[#e5e7eb] pt-3 space-y-1.5">
                    <span className="text-[11px] font-semibold text-gray-755 block">Deletion Controls</span>
                    
                    {/* Soft Delete */}
                    <button
                      onClick={handleSoftDeleteClick}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Soft Delete {selectedItem.type === 'request' ? 'Folder' : 'File'}
                    </button>

                    {/* Hard Delete (Only for submission files) */}
                    {selectedItem.type === 'file' && (
                      <button
                        onClick={() => handleDelete(selectedItem.doc._id)}
                        className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition mt-1"
                      >
                        <X className="w-3.5 h-3.5" /> Purge Record Completely
                      </button>
                    )}
                  </div>
                )}

                {/* Download / Folder exploration buttons */}
                <div className="border-t border-[#e5e7eb] pt-3 mt-auto space-y-1.5">
                  {(selectedItem.type === 'customer' || selectedItem.type === 'dept' || selectedItem.type === 'request') && (
                    <button
                      onClick={() => handleItemDoubleClick(selectedItem)}
                      className="w-full text-center py-1.5 bg-[#2563eb] text-white rounded font-semibold text-xs shadow-sm hover:bg-blue-700 transition"
                    >
                      Open Folder
                    </button>
                  )}
                  {(selectedItem.type === 'file' || selectedItem.type === 'result_file') && (
                    <>
                      {selectedItem.type === 'result_file' && selectedItem.doc.resultFileDeletedFromStorage ? (
                        <div className="p-2.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-semibold">
                          Result file is purged.
                        </div>
                      ) : selectedItem.type === 'file' && selectedItem.doc.fileDeletedFromStorage ? (
                        <div className="p-2.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-semibold">
                          Submission file is purged.
                        </div>
                      ) : (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/admin/documents/${selectedItem.doc._id}/download${selectedItem.type === 'result_file' ? '?type=result' : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition"
                        >
                          <Download className="w-4 h-4" /> Download File (New Tab)
                        </a>
                      )}
                    </>
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

