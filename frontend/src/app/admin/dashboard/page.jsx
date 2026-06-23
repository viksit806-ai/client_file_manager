'use client';
import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import SlaBadge from '@/components/ui/SlaBadge';
import { formatDateTime, getSlaStatus } from '@/lib/utils';
import { Users, Building2, UserCircle, FileText, Clipboard, AlertCircle, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getDashboard()
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}</div>;
  if (!data) return <p className="text-red-500">Failed to load dashboard</p>;

  const totalSla = (data.slaOverview || []).reduce((sum, d) => sum + d.overdue + d.approaching + d.withinSla, 0);
  const totalOverdue = (data.slaOverview || []).reduce((sum, d) => sum + d.overdue, 0);
  const totalApproaching = (data.slaOverview || []).reduce((sum, d) => sum + d.approaching, 0);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Total Active Requests" value={totalSla} icon={Clipboard} color="blue" />
        <StatCard title="Overdue" value={totalOverdue} icon={AlertCircle} color="red" />
        <StatCard title="Approaching Deadline" value={totalApproaching} icon={AlertTriangle} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
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

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">SLA by Department</h2>
          {data.slaOverview?.length > 0 ? (
            <div className="space-y-3">
              {data.slaOverview.map((dept) => {
                const total = dept.overdue + dept.approaching + dept.withinSla;
                const compliance = total > 0 ? Math.round((dept.withinSla / total) * 100) : 100;
                return (
                  <div key={dept._id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{dept.deptName || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{total} active requests</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-600 font-medium">{dept.overdue} overdue</span>
                      <span className="text-yellow-600 font-medium">{dept.approaching} at risk</span>
                      <span className="text-green-600 font-medium">{compliance}% SLA</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No active requests</p>
          )}
        </div>
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
                    <p className="text-xs text-gray-500">{doc.customerId?.name} • {doc.categoryId?.name}</p>
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
