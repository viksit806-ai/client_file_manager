'use client';
import { useState, useEffect } from 'react';
import { customerAPI } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import { Clock, RefreshCw, CheckCircle, Ban, Upload, FileText } from 'lucide-react';
import Link from 'next/link';

export default function CustomerDashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerAPI.getDocuments()
      .then(res => setDocuments(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pending = documents.filter(d => d.status === 'pending').length;
  const processing = documents.filter(d => d.status === 'processing').length;
  const completed = documents.filter(d => d.status === 'completed' && !d.paymentBlocked).length;
  const blocked = documents.filter(d => d.paymentBlocked).length;

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Pending" value={pending} icon={Clock} color="yellow" />
        <StatCard title="Processing" value={processing} icon={RefreshCw} color="purple" />
        <StatCard title="Completed" value={completed} icon={CheckCircle} color="green" />
        <StatCard title="Blocked" value={blocked} icon={Ban} color="red" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link href="/customer/upload" className="bg-blue-600 text-white rounded-lg p-6 hover:bg-blue-700 transition flex items-center gap-3">
          <Upload size={24} className="shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Upload Documents</h2>
            <p className="text-sm opacity-80 mt-0.5">Submit your documents to any department</p>
          </div>
        </Link>
        <Link href="/customer/documents" className="bg-gray-800 text-white rounded-lg p-6 hover:bg-gray-700 transition flex items-center gap-3">
          <FileText size={24} className="shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">My Documents</h2>
            <p className="text-sm opacity-80 mt-0.5">View status and download processed files</p>
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Documents</h2>
        {documents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No documents yet. Upload your first document.</p>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => (
              <div key={doc._id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.title || doc.originalName}</p>
                  <p className="text-xs text-gray-500">
                    {doc.departmentId?.name || 'No Department'}
                    {doc.categoryId?.name ? ` • ${doc.categoryId.name}` : ''}
                    {" • "}{formatDateTime(doc.createdAt)}
                  </p>
                </div>
                <StatusBadge status={doc.paymentBlocked ? 'blocked' : doc.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
