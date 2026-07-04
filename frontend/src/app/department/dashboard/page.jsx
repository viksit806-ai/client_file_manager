'use client';
import { useState, useEffect } from 'react';
import { departmentAPI } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import SlaBadge from '@/components/ui/SlaBadge';
import { formatDateTime, getSlaStatus } from '@/lib/utils';
import { toast } from 'sonner';
import { FileText, Clock, RefreshCw, CheckCircle, Ban, AlertCircle, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';

const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });


export default function DeptDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    departmentAPI.getDashboard()
      .then(res => setData(res.data.data))
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}</div>;
  if (!data) return <p className="text-red-500 text-center py-12">Failed to load dashboard</p>;

  const totalCompleted = (data?.slaMet || 0) + (data?.slaMissed || 0);
  const slaCompliance = totalCompleted > 0 ? Math.round((data.slaMet / totalCompleted) * 100) : 100;

  // Chart data setup
  const statusData = [
    { name: 'Pending', value: data?.pending || 0, color: '#eab308' },
    { name: 'Processing', value: data?.processing || 0, color: '#a855f7' },
    { name: 'Completed', value: data?.completed || 0, color: '#22c55e' },
    { name: 'Blocked', value: data?.blocked || 0, color: '#ef4444' },
  ].filter(item => item.value > 0);

  const slaData = [
    { name: 'Overdue', value: data?.slaOverdue || 0, color: '#ef4444' },
    { name: 'At Risk', value: data?.slaApproaching || 0, color: '#eab308' },
    { name: 'Within SLA', value: data?.slaWithin || 0, color: '#22c55e' },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Dashboard — {user?.departmentId?.name || 'Department'}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Documents" value={data?.totalDocs || 0} icon={FileText} color="blue" />
        <StatCard title="Pending" value={data?.pending || 0} icon={Clock} color="yellow" />
        <StatCard title="Processing" value={data?.processing || 0} icon={RefreshCw} color="purple" />
        <StatCard title="Completed" value={data?.completed || 0} icon={CheckCircle} color="green" />
        <StatCard title="Blocked" value={data?.blocked || 0} icon={Ban} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Status Distribution */}
        <div className="bg-white dark:bg-[#131b2e] p-5 rounded-xl shadow-xs border border-gray-100 dark:border-slate-800 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Workload Status Distribution</h2>
          </div>
          <div className="h-60 relative flex items-center justify-center">
            {statusData.length === 0 ? (
              <span className="text-xs text-gray-400">No active work</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} file(s)`, 'Count']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* SLA Compliance breakdown */}
        <div className="bg-white dark:bg-[#131b2e] p-5 rounded-xl shadow-xs border border-gray-100 dark:border-slate-800 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Active SLA Status Breakdown</h2>
          </div>
          <div className="h-60 relative flex items-center justify-center">
            {slaData.length === 0 ? (
              <span className="text-xs text-gray-400">No active SLA tracked documents</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {slaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} file(s)`, 'Count']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#131b2e] p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">SLA Compliance (48hr Fulfillment)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Active — Overdue" value={data?.slaOverdue || 0} icon={AlertCircle} color="red" />
          <StatCard title="Active — At Risk" value={data?.slaApproaching || 0} icon={AlertTriangle} color="yellow" />
          <StatCard title="Active — Within SLA" value={data?.slaWithin || 0} icon={CheckCircle} color="green" />
          <StatCard title="Fulfilled on Time" value={data?.slaMet || 0} icon={CheckCircle} color="blue" />
          <StatCard title="SLA Compliance" value={totalCompleted > 0 ? `${slaCompliance}%` : '—'} icon={null} color={slaCompliance >= 80 ? 'green' : slaCompliance >= 50 ? 'yellow' : 'red'} />
        </div>
      </div>

      <div className="bg-white dark:bg-[#131b2e] rounded-xl shadow-xs border border-gray-100 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">Recent Documents</h2>
        {data?.recentDocs?.length > 0 ? (
          <div className="space-y-2">
            {data.recentDocs.map((doc) => {
              const sla = getSlaStatus(doc.createdAt, doc.paymentBlocked ? 'blocked' : doc.status);
              return (
                <div
                  key={doc._id}
                  className="flex items-center justify-between p-3 border dark:border-slate-800 rounded-lg hover:bg-blue-50/50 dark:hover:bg-slate-850/20 cursor-pointer transition"
                  onClick={() => router.push(`/department/documents/${doc._id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-gray-700 dark:text-slate-200">{doc.title || doc.originalName}</p>
                    <p className="text-xs text-gray-400">
                      {doc.customerId?.name}
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

