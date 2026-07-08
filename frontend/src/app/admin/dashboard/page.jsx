'use client';
import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import SlaBadge from '@/components/ui/SlaBadge';
import { formatDateTime, getSlaStatus } from '@/lib/utils';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Users, Building2, UserCircle, FileText, Clipboard, AlertCircle, AlertTriangle } from 'lucide-react';

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getDashboard()
      .then((res) => setData(res.data.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}</div>;
  if (!data) return <p className="text-red-500">Failed to load dashboard</p>;

  const totalSla = (data.slaOverview || []).reduce((sum, d) => sum + d.overdue + d.approaching + d.withinSla, 0);
  const totalOverdue = (data.slaOverview || []).reduce((sum, d) => sum + d.overdue, 0);
  const totalApproaching = (data.slaOverview || []).reduce((sum, d) => sum + d.approaching, 0);
  const departmentsWithIssues = (data.slaOverview || []).filter(d => d.overdue > 0).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Customers" value={data.totalCustomers} icon={Users} color="blue" />
        <StatCard title="Departments" value={data.totalDepartments} icon={Building2} color="purple" />
        <StatCard title="Dept Users" value={data.totalDeptUsers} icon={UserCircle} color="green" />
        <StatCard title="Total Documents" value={data.totalDocuments} icon={FileText} color="yellow" />
      </div>

      <h2 className="text-lg font-semibold mb-4">SLA Overview (48hr Fulfillment)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Active Requests" value={totalSla} icon={Clipboard} color="blue" />
        <StatCard title="Depts w/ Issues" value={departmentsWithIssues} icon={Building2} color="purple" />
        <StatCard title="Overdue" value={totalOverdue} icon={AlertCircle} color="red" />
        <StatCard title="Approaching Deadline" value={totalApproaching} icon={AlertTriangle} color="yellow" />
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Documents per Department</h2>
        {data.deptStats?.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.deptStats.map(d => ({ name: d.deptName || 'Unknown', count: d.count }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No documents yet</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">SLA Compliance by Department</h2>
        {data.slaOverview?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Department</th>
                  <th className="px-4 py-3 text-center">Active Requests</th>
                  <th className="px-4 py-3 text-center text-green-600">Within SLA</th>
                  <th className="px-4 py-3 text-center text-yellow-600">Approaching</th>
                  <th className="px-4 py-3 text-center text-red-600">Overdue</th>
                  <th className="px-4 py-3 text-center rounded-tr-lg">Compliance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.slaOverview.map((dept) => {
                  const total = dept.overdue + dept.approaching + dept.withinSla;
                  const compliance = total > 0 ? Math.round((dept.withinSla / total) * 100) : 100;
                  return (
                    <tr key={dept._id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-800">{dept.deptName || 'Unknown'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-600">{total}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{dept.withinSla}</td>
                      <td className="px-4 py-3 text-center font-semibold text-yellow-600">{dept.approaching}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{dept.overdue}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${compliance >= 90 ? 'bg-green-100 text-green-700' : compliance >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {compliance}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No active requests</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Documents</h2>
        {data.recentDocs?.length > 0 ? (
          <div className="space-y-3">
            {data.recentDocs.map((doc) => {
              const sla = getSlaStatus(doc.createdAt, doc.paymentBlocked ? 'blocked' : doc.status);
              return (
                <div key={doc._id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title || doc.originalName}</p>
                    <p className="text-xs text-gray-500">{doc.customerId?.name}</p>
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
          <p className="text-gray-500 text-center py-8">No recent documents</p>
        )}
      </div>
    </div>
  );
}
