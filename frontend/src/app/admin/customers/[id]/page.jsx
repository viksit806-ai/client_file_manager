'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { adminAPI } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CustomerDocumentsPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    adminAPI.getCustomers({}).then(res => {
      const found = res.data.data.find(c => c._id === id);
      setCustomer(found);
      if (found) {
        const item = { id, name: found.name, path: `/admin/customers/${id}`, time: Date.now() };
        let items = JSON.parse(localStorage.getItem('recent_admin') || '[]');
        items = items.filter(i => i.id !== id);
        items.unshift(item);
        items = items.slice(0, 5);
        localStorage.setItem('recent_admin', JSON.stringify(items));
      }
    }).catch(console.error);

    adminAPI.getCustomerDocuments(id)
      .then(res => setDocs(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;

  return (
    <div>
      <Link href="/admin/customers" className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </Link>

      <h1 className="text-2xl font-bold mb-1">{customer?.name || 'Customer'}</h1>
      <p className="text-gray-500 mb-6">{customer?.email}</p>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 text-blue-900 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Department</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {docs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No documents</td></tr>
            ) : docs.map((doc) => (
              <tr key={doc._id} className="hover:bg-blue-50/50">
                <td className="px-4 py-3 font-medium">
                  <div>{doc.title || doc.originalName}</div>
                  {doc.description && (
                    <div className="text-xs text-gray-400 font-normal italic mt-0.5 max-w-md whitespace-pre-wrap">
                      {doc.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{doc.departmentId?.name}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={doc.paymentBlocked ? 'blocked' : doc.status} />
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDateTime(doc.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
