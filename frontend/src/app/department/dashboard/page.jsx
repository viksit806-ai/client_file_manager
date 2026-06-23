'use client';
import { useState, useEffect } from 'react';
import { departmentAPI } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import SlaBadge from '@/components/ui/SlaBadge';
import { formatDateTime, getSlaStatus } from '@/lib/utils';
import { FileText, Clock, RefreshCw, CheckCircle, Ban, AlertCircle, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function DeptDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    departmentAPI.getDashboard()
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}</div>;

  const totalCompleted = (data?.slaMet || 0) + (data?.slaMissed || 0);
  const slaCompliance = totalCompleted > 0 ? Math.round((data.slaMet / totalCompleted) * 100) : 100;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard — {user?.departmentId?.name || 'Department'}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total Documents" value={data?.totalDocs || 0} icon={FileText} color="blue" />
        <StatCard title="Pending" value={data?.pending || 0} icon={Clock} color="yellow" />
        <StatCard title="Processing" value={data?.processing || 0} icon={RefreshCw} color="purple" />
        <StatCard title="Completed" value={data?.completed || 0} icon={CheckCircle} color="green" />
        <StatCard title="Blocked" value={data?.blocked || 0} icon={Ban} color="red" />
      </div>

      <h2 className="text-lg font-semibold mb-4">SLA Compliance (48hr Fulfillment)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Active — Overdue" value={data?.slaOverdue || 0} icon={AlertCircle} color="red" />
        <StatCard title="Active — At Risk" value={data?.slaApproaching || 0} icon={AlertTriangle} color="yellow" />
        <StatCard title="Active — Within SLA" value={data?.slaWithin || 0} icon={CheckCircle} color="green" />
        <StatCard title="Fulfilled on Time" value={data?.slaMet || 0} icon={CheckCircle} color="blue" />
        <StatCard title="SLA Compliance" value={totalCompleted > 0 ? `${slaCompliance}%` : '—'} icon={null} color={slaCompliance >= 80 ? 'green' : slaCompliance >= 50 ? 'yellow' : 'red'} />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Documents</h2>
        {data?.recentDocs?.length > 0 ? (
          <div className="space-y-2">
            {data.recentDocs.map((doc) => {
              const sla = getSlaStatus(doc.createdAt, doc.paymentBlocked ? 'blocked' : doc.status);
              return (
                <div
                  key={doc._id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/department/documents/${doc._id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.title || doc.originalName}</p>
                    <p className="text-xs text-gray-500">
                      {doc.customerId?.name}
                      {doc.categoryId?.name ? ` • ${doc.categoryId.name}` : ''}
                      {doc.description ? ` • "${doc.description.substring(0, 50)}${doc.description.length > 50 ? '...' : ''}"` : ''}
                      {" • "}{formatDateTime(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!['completed', 'blocked'].includes(sla) && <SlaBadge slaStatus={sla} />}
                    <StatusBadge status={doc.paymentBlocked ? 'blocked' : doc.status} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No documents yet</p>
        )}
      </div>
    </div>
  );
}
