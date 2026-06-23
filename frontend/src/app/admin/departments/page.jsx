'use client';
import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', isActive: true, permissions: { blockDocuments: true, viewCustomers: true } });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminAPI.getDepartments().then(res => setDepartments(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => {
    Promise.resolve().then(() => {
      load();
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editDept) {
        await adminAPI.updateDepartment(editDept._id, form);
        toast.success('Department updated');
      } else {
        await adminAPI.createDepartment(form);
        toast.success('Department created');
      }
      setShowModal(false);
      setEditDept(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this department? Related users and categories will be deactivated.')) return;
    try {
      await adminAPI.deleteDepartment(id);
      toast.success('Department deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const togglePermission = async (id, field, value) => {
    try {
      await adminAPI.updatePermissions(id, { [field]: value });
      toast.success('Permission updated');
      load();
    } catch (err) {
      toast.error('Failed to update permission');
    }
  };

  const openEdit = (dept) => {
    setEditDept(dept);
    setForm({ name: dept.name, description: dept.description, isActive: dept.isActive, permissions: dept.permissions });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditDept(null);
    setForm({ name: '', description: '', isActive: true, permissions: { blockDocuments: true, viewCustomers: true } });
    setShowModal(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Departments</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-lg" />)}</div>
        ) : departments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No departments yet</p>
        ) : departments.map((dept) => (
          <div key={dept._id} className="bg-white rounded-lg shadow p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{dept.name}</h3>
                <p className="text-sm text-gray-500">{dept.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dept.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {dept.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => openEdit(dept)} className="p-1.5 hover:bg-gray-100 rounded" title="Edit"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(dept._id)} className="p-1.5 hover:bg-red-100 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dept.permissions?.blockDocuments} onChange={(e) => togglePermission(dept._id, 'blockDocuments', e.target.checked)} className="rounded" />
                Can Block Documents
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dept.permissions?.viewCustomers} onChange={(e) => togglePermission(dept._id, 'viewCustomers', e.target.checked)} className="rounded" />
                Can View Customers
              </label>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditDept(null); }} title={editDept ? 'Edit Department' : 'Create Department'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setEditDept(null); }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editDept ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
