'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  LayoutDashboard, Users, ChevronLeft, Menu, LogOut, X,
} from 'lucide-react';

const navItems = [
  { href: '/department/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/department/customers', label: 'Customers', icon: Users },
];

export default function DepartmentLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'department')) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const closeSidebar = () => {
    if (isMobile) setSidebarOpen(false);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`
          bg-gray-900 text-white flex flex-col transition-all duration-300 shrink-0 z-40
          ${isMobile
            ? `fixed inset-y-0 left-0 ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'}`
            : `${sidebarOpen ? 'w-64' : 'w-16'} relative`}
        `}
      >
        <div className="h-16 flex items-center px-4 border-b border-gray-700">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-gray-700 rounded-lg">
            {sidebarOpen ? (isMobile ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />) : <Menu className="w-5 h-5" />}
          </button>
          {sidebarOpen && <span className="ml-3 font-semibold text-sm">CA Portal - Dept</span>}
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-sm font-bold">
              {user.name?.[0]}
            </div>
            {sidebarOpen && (
              <div className="text-sm truncate">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-gray-400">{user.departmentId?.name || 'Dept User'}</p>
              </div>
            )}
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white w-full px-2 py-1.5 rounded hover:bg-gray-800">
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-50 p-2.5 bg-gray-900 text-white rounded-xl shadow-lg active:scale-95 transition"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <main className="flex-1 overflow-auto min-w-0">
        <div className={`${isMobile && !sidebarOpen ? 'pt-14' : ''} p-4 sm:p-6`}>{children}</div>
      </main>
    </div>
  );
}
