'use client';
import { useState, useEffect, useRef } from 'react';
import { notificationAPI } from '@/lib/api';
import { Bell, X, FileText, Upload } from 'lucide-react';
import Link from 'next/link';

const typeIcons = {
  new_request: Upload,
  new_response: FileText,
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const abortRef = useRef(null);

  const fetchData = () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    notificationAPI.getCount({ signal }).then(res => {
      if (!signal.aborted) setCount(res.data.data.count);
    }).catch(err => {
      if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') console.error('Failed to fetch notifications:', err);
    });
    notificationAPI.getAll({ signal }).then(res => {
      if (!signal.aborted) setNotifications(res.data.data);
    }).catch(err => {
      if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') console.error('Failed to fetch notifications:', err);
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDismiss = async (id) => {
    try {
      await notificationAPI.dismiss(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleDismissAll = async () => {
    for (const n of notifications) {
      try { await notificationAPI.dismiss(n.id); } catch {}
    }
    setNotifications([]);
    setCount(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg hover:bg-blue-50 transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Notifications</span>
            {notifications.length > 0 && (
              <button onClick={handleDismissAll} className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold">
                Dismiss all
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-1">
                <Bell className="w-6 h-6 text-gray-300" />
                <span className="text-xs font-medium">No notifications</span>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = typeIcons[n.type] || Bell;
                return (
                  <div key={n.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-blue-50/50 border-b border-gray-100 last:border-0">
                    <div className={`p-1.5 rounded-full shrink-0 ${n.type === 'new_request' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={n.link || '#'}
                        onClick={() => { handleDismiss(n.id); setOpen(false); }}
                        className="text-xs text-gray-800 font-medium hover:text-blue-600 line-clamp-2"
                      >
                        {n.message}
                      </Link>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismiss(n.id)}
                      className="p-0.5 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
