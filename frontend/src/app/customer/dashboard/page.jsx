'use client';
import { useState, useEffect } from 'react';
import { customerAPI } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import { Clock, RefreshCw, CheckCircle, Ban, Upload, FileText, BarChart3, PieChart as PieIcon } from 'lucide-react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts';

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

  // Chart data setup
  const statusData = [
    { name: 'Pending', value: pending, color: '#eab308' },
    { name: 'Processing', value: processing, color: '#a855f7' },
    { name: 'Completed', value: completed, color: '#22c55e' },
    { name: 'Blocked', value: blocked, color: '#ef4444' },
  ].filter(item => item.value > 0);

  const deptCounts = {};
  documents.forEach(d => {
    const deptName = d.departmentId?.name || 'General';
    deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
  });
  const deptData = Object.entries(deptCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">My Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending" value={pending} icon={Clock} color="yellow" />
        <StatCard title="Processing" value={processing} icon={RefreshCw} color="purple" />
        <StatCard title="Completed" value={completed} icon={CheckCircle} color="green" />
        <StatCard title="Blocked" value={blocked} icon={Ban} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Link href="/customer/upload" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6 hover:shadow-lg transition flex items-center gap-4 group">
          <div className="p-3 bg-white/10 rounded-lg group-hover:scale-110 transition">
            <Upload size={24} className="shrink-0" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Upload Documents</h2>
            <p className="text-sm opacity-80 mt-0.5">Submit new files to CA departments</p>
          </div>
        </Link>
        <Link href="/customer/documents" className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-6 hover:shadow-lg transition flex items-center gap-4 group">
          <div className="p-3 bg-white/10 rounded-lg group-hover:scale-110 transition">
            <FileText size={24} className="shrink-0" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">My Documents</h2>
            <p className="text-sm opacity-80 mt-0.5">Browse submissions, responses, and folders</p>
          </div>
        </Link>
      </div>

      {/* Analytics Charts Row */}
      {documents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Doughnut Chart */}
          <div className="bg-white dark:bg-[#131b2e] p-5 rounded-xl shadow-xs border border-gray-100 dark:border-slate-800 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Document Status Breakdown</h2>
            </div>
            <div className="h-64 relative flex items-center justify-center">
              {statusData.length === 0 ? (
                <span className="text-xs text-gray-400">No active documents</span>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} document(s)`, 'Count']} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Submissions by Dept Bar Chart */}
          <div className="bg-white dark:bg-[#131b2e] p-5 rounded-xl shadow-xs border border-gray-100 dark:border-slate-800 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Submissions by Department</h2>
            </div>
            <div className="h-64">
              {deptData.length === 0 ? (
                <span className="text-xs text-gray-400">No department data</span>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <Tooltip formatter={(value) => [`${value} file(s)`, 'Submissions']} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {deptData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#3b82f6" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity List */}
      <div className="bg-white dark:bg-[#131b2e] rounded-xl shadow-xs border border-gray-100 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">Recent Documents</h2>
        {documents.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400 gap-3">
            <FileText className="w-12 h-12 text-gray-300" />
            <p className="text-sm font-medium">No documents yet</p>
            <Link href="/customer/upload" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition mt-1">
              Upload Your First Document
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => (
              <div key={doc._id} className="flex items-center justify-between p-3 border dark:border-slate-800 rounded-lg hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-gray-700 dark:text-slate-200">{doc.title || doc.originalName}</p>
                  <p className="text-xs text-gray-400">
                    {doc.departmentId?.name || 'No Department'}
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

