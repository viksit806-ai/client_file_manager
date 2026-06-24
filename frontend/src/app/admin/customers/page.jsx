'use client';
import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Plus, Search, Eye, Trash2, RefreshCw, Pencil, Users } from 'lucide-react';
import { formatDate, copyToClipboard } from '@/lib/utils';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SkeletonTable from '@/components/ui/SkeletonTable';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', isActive: true, password: '', canRename: false, canDelete: false, canCreate: false });
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState(null);
  const [passwordMode, setPasswordMode] = useState('auto');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  const router = useRouter();

  const loadCustomers = () => {
    setLoading(true);
    adminAPI.getCustomers({ search, status: '' })
      .then((res) => setCustomers(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadCustomers();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        isActive: form.isActive,
        canRename: form.canRename,
        canDelete: form.canDelete,
        canCreate: form.canCreate,
      };
      if (passwordMode === 'manual' && form.password) {
        payload.password = form.password;
      }

      if (editCustomer) {
        await adminAPI.updateCustomer(editCustomer._id, payload);
        if (passwordMode === 'manual' && form.password) {
          await adminAPI.setPassword(editCustomer._id, { password: form.password });
        }
        toast.success('Customer updated');
        setShowModal(false);
        setEditCustomer(null);
      } else {
        const res = await adminAPI.createCustomer(payload);
        setNewPassword(res.data.data.plainPassword);
        toast.success('Customer created');
      }
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDelete({ open: true, id });
  };

  const handleResetPassword = async (id) => {
    try {
      const res = await adminAPI.resetPassword(id);
      setNewPassword(res.data.data.plainPassword);
      toast.success('Password reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset');
    }
  };

  const openEdit = (customer) => {
    setEditCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email,
      isActive: customer.isActive,
      password: '',
      canRename: customer.canRename || false,
      canDelete: customer.canDelete || false,
      canCreate: customer.canCreate || false,
    });
    setPasswordMode('auto');
    setShowModal(true);
    setNewPassword(null);
  };

  const openCreate = () => {
    setEditCustomer(null);
    setForm({ name: '', email: '', isActive: true, password: '', canRename: false, canDelete: false, canCreate: false });
    setPasswordMode('auto');
    setShowModal(true);
    setNewPassword(null);
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <nav className="flex items-center gap-1 text-xs text-gray-500 mb-4"><Link href="/admin/dashboard" className="hover:text-blue-600">Dashboard</Link><span>/</span><span className="text-gray-800 font-medium">Customers</span></nav>

      <div className="mb-4 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
      </div>

      {newPassword && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">Password: <span className="font-mono text-lg">{newPassword}</span></p>
          <button onClick={() => { copyToClipboard(newPassword); toast.success('Copied!'); }} className="text-xs text-green-600 underline mt-1">Copy</button>
          <button onClick={() => setNewPassword(null)} className="ml-3 text-xs text-green-600 underline mt-1">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 text-blue-900 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500"><SkeletonTable rows={5} cols={5} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5}><div className="flex flex-col items-center py-12 text-gray-400"><Users className="w-12 h-12 mb-3 text-gray-300" /><p className="text-sm font-medium">No customers yet</p><p className="text-xs mt-1">Click "Add Customer" to get started</p></div></td></tr>
            ) : filtered.map((c) => (
              <tr key={c._id} className="hover:bg-blue-50/50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => router.push(`/admin/customers/${c._id}`)} className="p-1.5 hover:bg-blue-50 rounded" title="View Documents">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-blue-50 rounded" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleResetPassword(c._id)} className="p-1.5 hover:bg-blue-50 rounded" title="Reset Password">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(c._id)} className="p-1.5 hover:bg-red-100 rounded text-red-600" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setNewPassword(null); }} title={editCustomer ? 'Edit Customer' : 'Create Customer'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
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

          <div className="pt-1">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm font-medium">Password Mode</label>
              <select value={passwordMode} onChange={(e) => setPasswordMode(e.target.value)} className="text-sm border rounded px-2 py-1 outline-none">
                <option value="auto">Auto-generate</option>
                <option value="manual">Set manually</option>
              </select>
            </div>
            {passwordMode === 'manual' && (
              <div>
                <label className="block text-sm font-medium mb-1">{editCustomer ? 'New Password' : 'Password'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min 8 characters" minLength={8} />
              </div>
            )}
            {passwordMode === 'auto' && (
              <p className="text-xs text-gray-500">{editCustomer ? 'Password will not be changed unless you choose "Set manually".' : 'A random password will be generated and shown after creation.'}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setNewPassword(null); }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editCustomer ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal isOpen={confirmDelete.open} onClose={() => setConfirmDelete({ open: false, id: null })} onConfirm={async () => { await adminAPI.deleteCustomer(confirmDelete.id); toast.success('Customer deleted'); loadCustomers(); setConfirmDelete({ open: false, id: null }); }} title="Delete Customer" message="Delete this customer and all their documents?" confirmText="Delete" variant="danger" />

    </div>
  );
}
