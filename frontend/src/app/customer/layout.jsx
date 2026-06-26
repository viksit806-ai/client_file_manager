'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ScrollToTop from '@/components/ui/ScrollToTop';
import NotificationBell from '@/components/ui/NotificationBell';
import GlobalSearchHeader from '@/components/ui/GlobalSearchHeader';
import Link from 'next/link';

import TourOverlay from '@/components/ui/TourOverlay';
import { motion } from 'framer-motion';
import {
  AlertCircle, LayoutDashboard, FolderTree, Upload, FileText, ChevronLeft, Menu, LogOut, X,
} from 'lucide-react';

const navItems = [
  { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customer/categories', label: 'Categories', icon: FolderTree },
  { href: '/customer/responses', label: 'Responses', icon: FileText },
  { href: '/customer/upload', label: 'Upload', icon: Upload },
  { href: '/customer/documents', label: 'My Documents', icon: FileText },
];

export default function CustomerLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [recentItems, setRecentItems] = useState([]);

  useEffect(() => {
    const loadRecent = () => {
      const items = JSON.parse(localStorage.getItem('recent_customer') || '[]');
      setRecentItems(items);
    };
    loadRecent();
  }, [pathname]);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'customer')) {
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
          bg-navy-950 text-white flex flex-col transition-all duration-300 shrink-0 z-40 overflow-x-hidden
          ${isMobile
            ? `fixed inset-y-0 left-0 ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'}`
            : `${sidebarOpen ? 'w-64' : 'w-16'} relative`}
        `}
      >
        <div className="h-16 flex items-center px-4 border-b border-navy-900/40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-navy-800/40 rounded-lg">
            {sidebarOpen ? (isMobile ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />) : <Menu className="w-5 h-5" />}
          </button>
          <span className={`font-semibold text-sm transition-all duration-300 whitespace-nowrap overflow-hidden ${sidebarOpen ? 'opacity-100 max-w-64 ml-3' : 'opacity-0 max-w-0 ml-0 pointer-events-none'}`}>
            Customer Portal
          </span>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-navy-200/80 hover:bg-navy-800/30 hover:text-white'} overflow-hidden`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${sidebarOpen ? 'opacity-100 max-w-64 ml-3' : 'opacity-0 max-w-0 ml-0 pointer-events-none'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {recentItems.length > 0 && (
          <div className={`transition-all duration-300 overflow-hidden px-4 ${sidebarOpen ? 'opacity-100 max-h-48 py-3 border-t border-navy-900/20' : 'opacity-0 max-h-0 py-0 border-transparent pointer-events-none'}`}>
            <span className="text-[10px] font-bold text-navy-300 block mb-2 whitespace-nowrap">Recent Items</span>
            <div className="space-y-1.5">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.path}
                  className="text-xs text-navy-200/60 hover:text-white block truncate hover:underline whitespace-nowrap"
                  title={item.name}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-navy-900/40">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
              {user.name?.[0]}
            </div>
            <div className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${sidebarOpen ? 'opacity-100 max-w-64 ml-3' : 'opacity-0 max-w-0 ml-0 pointer-events-none'}`}>
              <div className="text-sm truncate">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-navy-300/80">Customer</p>
              </div>
            </div>
          </div>
          <a href="mailto:support@cafirm.com?subject=Report a Problem" className="flex items-center text-sm text-navy-300/60 hover:text-navy-100 w-full px-2 py-1.5 rounded hover:bg-navy-800/30 mt-1 overflow-hidden">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${sidebarOpen ? 'opacity-100 max-w-64 ml-3' : 'opacity-0 max-w-0 ml-0 pointer-events-none'}`}>
              Report a Problem
            </span>
          </a>
          <button onClick={logout} className="flex items-center text-sm text-navy-300 hover:text-white w-full px-2 py-1.5 rounded hover:bg-navy-800/40 overflow-hidden">
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${sidebarOpen ? 'opacity-100 max-w-64 ml-3' : 'opacity-0 max-w-0 ml-0 pointer-events-none'}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-50 p-2.5 bg-navy-950 text-white rounded-xl shadow-lg active:scale-95 transition"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-gray-200 flex items-center justify-between px-6 h-14">
          <GlobalSearchHeader />
          <NotificationBell />
        </div>

        <div className={`${isMobile && !sidebarOpen ? 'pt-14' : ''} p-4 sm:p-6`}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {children}
          </motion.div>
        </div>
        <ScrollToTop />
        <TourOverlay role="customer" />
      </main>
    </div>
  );
}
