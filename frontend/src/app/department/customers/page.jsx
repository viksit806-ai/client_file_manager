'use client';
import { useState, useEffect, useCallback } from 'react';
import { departmentAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Search, Folder, FileText, ArrowLeft, ArrowRight, ArrowUp,
  ChevronRight, LayoutGrid, List, Info, X, Monitor, HardDrive, Pencil, Save,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'non_completed', label: 'Non-completed' },
  { value: 'near_deadline', label: 'Near Deadline' },
  { value: 'completed', label: 'Completed' },
];

export default function DeptCustomersExplorer() {
  const { user } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [editValue, setEditValue] = useState('');

  const canRename = user?.canRename;

  const loadData = useCallback(() => {
    setLoading(true);
    const params = activeFilter !== 'all' ? { filter: activeFilter } : {};
    departmentAPI.getCustomers(params)
      .then(res => setCustomers(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleItemClick = (item) => setSelectedItem(item);

  const handleItemDoubleClick = (item) => {
    router.push(`/department/customers/${item.id}`);
  };

  const handleRenameStart = () => {
    setEditValue(selectedItem.name);
    setEditingName(true);
  };

  const handleRenameSave = async () => {
    if (!editValue.trim()) return toast.error('Name cannot be empty');
    try {
      await departmentAPI.renameCustomer(selectedItem.id, { name: editValue.trim() });
      toast.success('Customer renamed');
      setEditingName(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename');
    }
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') handleRenameSave();
    if (e.key === 'Escape') setEditingName(false);
  };

  const getSortValue = (c, field) => {
    if (field === 'name') return c.name?.toLowerCase() || '';
    if (field === 'docs') return c.totalDocs || 0;
    if (field === 'pending') return c.pendingDocs || 0;
    if (field === 'date') return new Date(c.lastDoc || 0).getTime();
    return 0;
  };

  const sorted = [...filtered].sort((a, b) => {
    const va = getSortValue(a, sortField);
    const vb = getSortValue(b, sortField);
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="flex flex-col -m-6 h-screen bg-[#f3f4f6] select-none overflow-hidden">

      {/* Top Address & Action Bar */}
      <div className="h-12 bg-white border-b border-[#e5e7eb] flex items-center px-3 justify-between gap-3 shrink-0">

        <div className="flex items-center gap-1">
          <button className="p-1 text-gray-400 cursor-not-allowed" disabled title="Back">
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button className="p-1 text-gray-400 cursor-not-allowed" disabled title="Forward">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button className="p-1 text-gray-400 cursor-not-allowed" disabled title="Up to Parent Folder">
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex-1 max-w-2xl bg-[#f9fafb] border border-[#e5e7eb] rounded-md h-8 flex items-center px-2.5 overflow-x-auto whitespace-nowrap text-xs text-gray-600 gap-1 scrollbar-none font-medium">
          <HardDrive className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-400 font-bold">This PC</span>
          <ChevronRight className="w-3 h-3 text-gray-300" />
          <span className="text-gray-800 font-semibold">Customers</span>
        </div>

        <div className="relative w-48 bg-[#f9fafb] border border-[#e5e7eb] rounded-md h-8 flex items-center px-2.5 shrink-0">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search customers..."
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

        <div className="flex items-center gap-1 border rounded bg-[#f3f4f6] p-0.5 shrink-0 text-xs text-gray-700">
          <span className="px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="bg-white rounded px-1.5 py-0.5 outline-none text-[11px] border border-gray-200"
          >
            <option value="name">Name</option>
            <option value="docs">Documents</option>
            <option value="pending">Pending</option>
            <option value="date">Last Activity</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-1 bg-white hover:bg-gray-100 rounded text-gray-600 font-bold text-[10px] w-6 text-center"
            title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
          >
            {sortOrder === 'asc' ? '▲' : '▼'}
          </button>
        </div>

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
      </div>

      {/* Filter Chips */}
      <div className="h-10 bg-white border-b border-[#e5e7eb] flex items-center px-3 gap-2 shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Filter:</span>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setActiveFilter(f.value); setSelectedItem(null); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              activeFilter === f.value
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Workspace */}
      <div className="flex flex-row flex-1 overflow-hidden">

        {/* Left Sidebar Tree */}
        <div className="w-52 bg-white border-r border-[#e5e7eb] h-full overflow-y-auto shrink-0 hidden md:flex flex-col p-2 text-xs text-gray-700">
          <div className="mb-3 border-b pb-2">
            <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Navigation</span>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none">
              <Monitor className="w-3.5 h-3.5 text-blue-500" />
              <span>All Customers</span>
            </button>
          </div>

          <div>
            <span className="font-semibold text-gray-400 block px-2 mb-1.5 uppercase text-[9px] tracking-wider">Customers</span>
            <div className="space-y-0.5">
              {sorted.map(c => (
                <button
                  key={c._id}
                  onClick={() => handleItemClick({ id: c._id, name: c.name, ...c })}
                  onDoubleClick={() => handleItemDoubleClick({ id: c._id, name: c.name })}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${
                    selectedItem?.id === c._id ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-500 rounded-l-none' : 'hover:bg-gray-100'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate" title={c.name}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Pane */}
        <div className="flex-1 bg-white h-full overflow-y-auto p-4 flex flex-col">
          {loading ? (
            <div className="animate-pulse grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-gray-100 rounded-lg" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400 gap-2">
              <Folder className="w-12 h-12 text-gray-200 stroke-1" />
              <span className="text-xs font-semibold">No customers found</span>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sorted.map(c => {
                const isSelected = selectedItem?.id === c._id;
                return (
                  <div
                    key={c._id}
                    onClick={() => handleItemClick({ id: c._id, name: c.name, ...c })}
                    onDoubleClick={() => handleItemDoubleClick({ id: c._id, name: c.name })}
                    className={`flex flex-col items-center text-center p-3 border rounded-lg cursor-pointer transition select-none ${
                      isSelected ? 'bg-blue-50/80 border-[#93c5fd] shadow-sm' : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <div className="relative">
                      <Folder className="w-12 h-12 text-[#3b82f6] fill-[#ebf8ff]" />
                      <span className="absolute bottom-2 right-1.5 bg-white text-[8px] font-extrabold text-gray-500 px-0.5 border border-[#d1d5db] rounded shadow-xs">
                        {c.totalDocs}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-700 mt-2 truncate w-full" title={c.name}>{c.name}</span>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                      {c.pendingDocs > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-yellow-100 text-yellow-700">
                          {c.pendingDocs} pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                    <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => { setSortField('name'); }}>Name {sortField === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => { setSortField('docs'); }}>Documents {sortField === 'docs' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => { setSortField('pending'); }}>Pending {sortField === 'pending' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th className="py-2.5 px-3 hover:text-blue-600" onClick={() => { setSortField('date'); }}>Last Activity {sortField === 'date' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {sorted.map(c => (
                    <tr
                      key={c._id}
                      onClick={() => handleItemClick({ id: c._id, name: c.name, ...c })}
                      onDoubleClick={() => handleItemDoubleClick({ id: c._id, name: c.name })}
                      className={`cursor-pointer ${selectedItem?.id === c._id ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50/50'}`}
                    >
                      <td className="py-2 px-3 flex items-center gap-2 max-w-sm">
                        <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-500">{c.totalDocs || 0}</td>
                      <td className="py-2 px-3">
                        {c.pendingDocs > 0 ? (
                          <span className="text-yellow-600 font-semibold">{c.pendingDocs}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-500">{formatDate(c.lastDoc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Details Panel */}
        <div className={`w-72 bg-[#f9fafb] border-l border-[#e5e7eb] h-full p-4 overflow-y-auto shrink-0 flex flex-col gap-4 relative transition-all duration-300 ${selectedItem ? 'opacity-100 translate-x-0' : 'lg:opacity-90 lg:block hidden bg-gray-50/30'}`}>
          {selectedItem ? (
            <div className="flex flex-col h-full gap-4 overflow-y-auto max-h-[850px] scrollbar-none pr-1">

              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Customer Info</span>
                <button onClick={() => setSelectedItem(null)} className="p-0.5 text-gray-400 hover:bg-[#e5e7eb] rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-white border border-[#e5e7eb] rounded-lg flex items-center justify-center shadow-xs">
                <Folder className="w-14 h-14 text-blue-400 fill-blue-50/50" />
              </div>

              <div className="space-y-2">
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      className="flex-1 px-2 py-1 border border-blue-300 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    />
                    <button onClick={handleRenameSave} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Save">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingName(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800 truncate">{selectedItem.name}</span>
                    {canRename && (
                      <button onClick={handleRenameStart} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Rename">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 truncate">{selectedItem.email}</p>
              </div>

              <div className="border-t border-[#e5e7eb] pt-3 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Total Documents</span><span className="font-semibold">{selectedItem.totalDocs || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Pending</span><span className="font-semibold text-yellow-600">{selectedItem.pendingDocs || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Last Activity</span><span className="font-semibold">{formatDate(selectedItem.lastDoc)}</span></div>
              </div>

              <div className="border-t border-[#e5e7eb] pt-3 mt-auto">
                <button
                  onClick={() => router.push(`/department/customers/${selectedItem.id}`)}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-1.5"
                >
                  <Folder className="w-3.5 h-3.5" />
                  Open Customer Folder
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Info className="w-8 h-8" />
              <span className="text-xs font-semibold">Select a customer</span>
              <span className="text-[10px] text-center">Click a customer folder to view details and rename</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
