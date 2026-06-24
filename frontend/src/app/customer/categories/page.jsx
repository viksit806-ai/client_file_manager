'use client';
import { useState, useEffect, useMemo } from 'react';
import { customerAPI } from '@/lib/api';
import { formatDateTime, formatFileSize } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Building2,
  FolderOpen,
  FileText,
  Download,
  Clock,
  ChevronRight,
  ArrowLeft,
  Folder,
} from 'lucide-react';

export default function CustomerResponseCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState(null);
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    customerAPI.getResponseCategories()
      .then(res => setCategories(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (doc) => {
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

  const sortedDocs = useMemo(() => {
    if (!selectedCat?.documents) return [];
    const docs = [...selectedCat.documents];
    docs.sort((a, b) => {
      let comp = 0;
      if (sortField === 'date') {
        comp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else if (sortField === 'name') {
        comp = (a.title || a.originalName || '').localeCompare(b.title || b.originalName || '');
      } else if (sortField === 'size') {
        comp = (a.fileSize || 0) - (b.fileSize || 0);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
    return docs;
  }, [selectedCat, sortField, sortOrder]);

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-lg" />)}</div>;

  if (selectedCat) {
    return (
      <div>
        <button
          onClick={() => setSelectedCat(null)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Categories
        </button>

        <div className="bg-white rounded-lg shadow">
          <div className="flex items-center gap-2 px-5 py-4 border-b bg-blue-50 text-blue-900 rounded-t-lg">
            <Folder className="w-5 h-5 text-blue-500" />
            <div>
              <h1 className="text-lg font-bold text-gray-800">{selectedCat.name}</h1>
              <p className="text-xs text-gray-500">{selectedCat.departmentName}</p>
            </div>
            <span className="ml-auto text-xs text-gray-400">{sortedDocs.length} document{sortedDocs.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="px-5 py-3 border-b bg-white flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="text-xs border rounded px-2 py-1 outline-none bg-white"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1 border rounded text-xs bg-white hover:bg-blue-50 font-medium"
            >
              {sortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
            </button>
          </div>

          <div className="divide-y">
            {sortedDocs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <Clock className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No documents in this category yet</p>
              </div>
            ) : (
              sortedDocs.map((doc) => (
                <div key={doc._id} className="px-5 py-3.5 flex items-center justify-between hover:bg-blue-50/50 transition">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.title || doc.originalName}</p>
                      <p className="text-[10px] text-gray-400">
                        {formatDateTime(doc.createdAt)}
                        {doc.fileSize ? ` • ${formatFileSize(doc.fileSize)}` : ''}
                        {doc.departmentId?.name ? ` • ${doc.departmentId.name}` : ''}
                        {doc.notes ? ` • ${doc.notes.substring(0, 40)}${doc.notes.length > 40 ? '...' : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 bg-blue-50 border border-blue-200 rounded text-blue-700 hover:bg-blue-100 transition"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">My Documents</h1>
      <p className="text-gray-500 mb-6">Response documents from departments, grouped by file category</p>

      {categories.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No documents available yet</p>
          <p className="text-xs mt-1">When a department uploads a response document, it will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setSelectedCat(cat)}
              className="w-full bg-white rounded-lg shadow hover:shadow-md transition text-left"
            >
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{cat.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {cat.documents?.length || 0} document{(cat.documents?.length || 0) !== 1 ? 's' : ''}
                    {cat.departmentName ? ` • ${cat.departmentName}` : ''}
                    {cat.documents?.[0]?.createdAt ? ` • Latest: ${formatDateTime(cat.documents[0].createdAt)}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
