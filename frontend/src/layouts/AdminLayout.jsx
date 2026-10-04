import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/notifications/NotificationBell';
import ThemeToggle from '../components/common/ThemeToggle';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Users, Store,
  Settings, LogOut, ChevronLeft, ChevronRight, Menu, X,
  ShieldCheck, ShoppingBag, BarChart3, Bell
} from 'lucide-react';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/shops', icon: Store, label: 'Shop Management' },
  { to: '/admin/verification', icon: ShieldCheck, label: 'Business Verification' },
  { to: '/admin/users', icon: Users, label: 'User Management' },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Order List' },
  { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { to: '/admin/logs', icon: Bell, label: 'Activity Logs' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'AD';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const pageMeta = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/admin/dashboard')) return { title: 'Dashboard Overview', subtitle: 'Live overview of print shops, requests, and platform activity' };
    if (path.startsWith('/admin/shops')) return { title: 'Shop Management', subtitle: 'Manage registered printing shops and operational statuses' };
    if (path.startsWith('/admin/verification')) return { title: 'Business Verification', subtitle: 'Review partner documentation and business permits' };
    if (path.startsWith('/admin/users')) return { title: 'User Management', subtitle: 'Oversee registered customers, owners, and account statuses' };
    if (path.startsWith('/admin/orders') || path.startsWith('/admin/requests')) return { title: 'Order List', subtitle: 'Track and inspect platform-wide print transactions' };
    if (path.startsWith('/admin/reports')) return { title: 'Reports & Analytics', subtitle: 'Financial metrics, volume analysis, and platform growth' };
    if (path.startsWith('/admin/logs')) return { title: 'Activity Logs', subtitle: 'System audit trail and administrator action history' };
    if (path.startsWith('/admin/settings')) return { title: 'Admin Settings', subtitle: '' };
    return { title: 'Admin Portal', subtitle: '' };
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 font-outfit">

      {/* Mobile Backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* TailAdmin Modern Sidebar */}
      <aside
        className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
          isMobile
            ? mobileOpen
              ? 'fixed inset-y-0 left-0 w-[270px] shadow-2xl'
              : 'hidden'
            : collapsed
            ? 'w-[80px]'
            : 'w-[270px]'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-[76px] px-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80">
          {!collapsed ? (
            <>
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-3 no-underline group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 p-1 flex items-center justify-center shrink-0 shadow-theme-xs">
                  <img
                    src="/logo.png"
                    alt="PrintDayon Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="truncate">
                  <div className="font-extrabold text-base tracking-tight leading-tight text-gray-900 dark:text-white">
                    <span>Print</span>
                    <span className="text-brand-500">Dayon</span>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Admin Portal
                  </div>
                </div>
              </Link>

              {!isMobile && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  title="Collapse Sidebar"
                  className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                title="Expand Sidebar"
                className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 p-1 flex items-center justify-center shrink-0 cursor-pointer shadow-theme-xs"
              >
                <img
                  src="/logo.png"
                  alt="PrintDayon Logo"
                  className="w-full h-full object-contain"
                />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto scrollbar-none">
          <div className={`px-2.5 pb-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? '•••' : 'Main Menu'}
          </div>

          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={label}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                  collapsed ? 'justify-center px-0' : ''
                } ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-theme-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={19}
                    className={`shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer (Logout & Expand) */}
        <div className="p-3.5 border-t border-gray-100 dark:border-gray-800/80 space-y-1.5">
          {collapsed && !isMobile && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand Sidebar"
              className="w-full py-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* TailAdmin Modern Top Navigation Header */}
        <header className="h-[76px] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 flex items-center justify-between shrink-0 transition-colors">
          {/* Left: Mobile Toggle & Page Meta */}
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
              title="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight m-0 truncate">
                {pageMeta.title}
              </h1>
              {pageMeta.subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 m-0 mt-0.5 truncate hidden sm:block">
                  {pageMeta.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions, Theme, Notifications, User Badge */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <ThemeToggle />
            <NotificationBell />

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-gray-200 dark:border-gray-800">
              <div className="w-9 h-9 rounded-xl bg-brand-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-theme-xs">
                {getInitials(user?.name)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[130px]">
                  {user?.name || 'Administrator'}
                </div>
                <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 leading-tight">
                  Super Admin
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 bg-gray-50 dark:bg-gray-950 transition-colors">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
