'use client';
import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FolderOpen, X, Save } from 'lucide-react';

export default function AdminFileCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', departmentId: '' });
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      adminAPI.getFileCategories(),
      adminAPI.getDepartments(),
    ])
      .then(([catRes, deptRes]) => {
        setCategories(catRes.data.data);
        setDepartments(deptRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', departmentId: departments[0]?._id || '' });
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditing(cat._id);
    setForm({ name: cat.name, description: cat.description || '', departmentId: cat.departmentId?._id || cat.departmentId || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.departmentId) {
      toast.error('Name and department are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await adminAPI.updateFileCategory(editing, form);
        toast.success('File category updated');
      } else {
        await adminAPI.createFileCategory(form);
        toast.success('File category created');
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this file category?')) return;
    try {
      await adminAPI.deleteFileCategory(id);
      toast.success('File category deleted');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">File Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Categories for response documents that departments upload to customers</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
          <Plus className="w-4 h-4" /> Add File Category
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-white border rounded-lg shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">{editing ? 'Edit File Category' : 'New File Category'}</span>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-blue-50 rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Tax Return File"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm(f => ({ ...f, departmentId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">Select department</option>
                {departments.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-blue-50">Cancel</button>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400 gap-2">
          <FolderOpen className="w-12 h-12 text-gray-300" />
          <p className="text-sm font-medium">No file categories yet</p>
          <p className="text-xs">Create file categories that departments can use when uploading response documents</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b bg-blue-50 text-blue-900 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map(cat => (
                  <tr key={cat._id} className="hover:bg-blue-50/50">
                    <td className="py-3 px-4 font-medium text-gray-800">{cat.name}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{cat.description || '-'}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{cat.departmentId?.name || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(cat)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(cat._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
