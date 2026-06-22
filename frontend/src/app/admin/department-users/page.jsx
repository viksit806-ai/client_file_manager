'use client';
import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { formatDate, copyToClipboard } from '@/lib/utils';

export default function DepartmentUsersPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', departmentId: '', isActive: true, password: '', canRename: false, canDelete: false, canCreate: false });
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState(null);
  const [passwordMode, setPasswordMode] = useState('auto');

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, deptRes] = await Promise.all([adminAPI.getDepartmentUsers(), adminAPI.getDepartments()]);
      setUsers(usersRes.data.data);
      setDepartments(deptRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
      const payload = {
        name: form.name,
        email: form.email,
        departmentId: form.departmentId,
        isActive: form.isActive,
        canRename: form.canRename,
        canDelete: form.canDelete,
        canCreate: form.canCreate,
      };
      if (passwordMode === 'manual' && form.password) {
        payload.password = form.password;
      }

      if (editUser) {
        await adminAPI.updateDepartmentUser(editUser._id, payload);
        if (passwordMode === 'manual' && form.password) {
          await adminAPI.setDeptUserPassword(editUser._id, { password: form.password });
        }
        toast.success('User updated');
        setShowModal(false);
        setEditUser(null);
      } else {
        const res = await adminAPI.createDepartmentUser(payload);
        setNewPassword(res.data.data.plainPassword);
        toast.success('User created');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await adminAPI.deleteDepartmentUser(id);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleResetPassword = async (id) => {
    try {
      const res = await adminAPI.resetDeptUserPassword(id);
      setNewPassword(res.data.data.plainPassword);
      toast.success('Password reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset');
    }
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({
      name: user.name,
      email: user.email,
      departmentId: user.departmentId?._id || user.departmentId || '',
      isActive: user.isActive,
      password: '',
      canRename: user.canRename || false,
      canDelete: user.canDelete || false,
      canCreate: user.canCreate || false,
    });
    setPasswordMode('auto');
    setShowModal(true);
    setNewPassword(null);
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', departmentId: departments[0]?._id || '', isActive: true, password: '', canRename: false, canDelete: false, canCreate: false });
    setPasswordMode('auto');
    setShowModal(true);
    setNewPassword(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Department Users</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {newPassword && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">Password: <span className="font-mono text-lg">{newPassword}</span></p>
          <button onClick={() => { copyToClipboard(newPassword); toast.success('Copied!'); }} className="text-xs text-green-600 underline mt-1">Copy</button>
          <button onClick={() => setNewPassword(null)} className="ml-3 text-xs text-green-600 underline mt-1">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Department</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No users yet</td></tr>
            ) : users.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-600">{u.departmentId?.name || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-gray-100 rounded" title="Edit"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleResetPassword(u._id)} className="p-1.5 hover:bg-gray-100 rounded" title="Reset Password">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(u._id)} className="p-1.5 hover:bg-red-100 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setNewPassword(null); }} title={editUser ? 'Edit Department User' : 'Create Department User'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required>
              <option value="">Select department</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-4 border-y py-2.5 my-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={form.canRename} onChange={(e) => setForm({ ...form, canRename: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
              Allow Rename
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={form.canDelete} onChange={(e) => setForm({ ...form, canDelete: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
              Allow Delete
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={form.canCreate} onChange={(e) => setForm({ ...form, canCreate: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
              Allow Create
            </label>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm font-medium">Password Mode</label>
              <select value={passwordMode} onChange={(e) => setPasswordMode(e.target.value)} className="text-sm border rounded px-2 py-1 outline-none">
                <option value="auto">Auto-generate</option>
                <option value="manual">Set manually</option>
              </select>
            </div>
            {passwordMode === 'manual' && (
              <div>
                <label className="block text-sm font-medium mb-1">{editUser ? 'New Password' : 'Password'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min 8 characters" minLength={8} />
              </div>
            )}
            {passwordMode === 'auto' && (
              <p className="text-xs text-gray-500">{editUser ? 'Password will not be changed unless you choose "Set manually".' : 'A random password will be generated and shown after creation.'}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setNewPassword(null); }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editUser ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
