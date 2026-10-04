import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import NotificationBell from '../components/notifications/NotificationBell';
import ThemeToggle from '../components/common/ThemeToggle';
import toast from 'react-hot-toast';
import {
  Home, Search, ShoppingBag,
  Bell, LogOut, ChevronLeft, ChevronRight, Menu, X,
  ChevronDown, User
} from 'lucide-react';

export default function CustomerLayout({ children }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  const navItems = useMemo(() => [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/find-shop', icon: Search, label: 'Find Shops' },
    { to: '/my-requests', icon: ShoppingBag, label: 'My Orders' },
    {
      to: '/notifications',
      icon: Bell,
      label: 'Notifications',
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { to: '/profile', icon: User, label: 'Profile' },
  ], [unreadCount]);

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
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const fullName = user?.name || 'Customer';

  const pageMeta = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/find-shop')) return { title: 'Find Shops' };
    if (path.startsWith('/my-requests/')) return { title: 'Order Tracking' };
    if (path.startsWith('/my-requests')) return { title: 'My Orders' };
    if (path.startsWith('/notifications')) return { title: 'Notifications' };
    if (path.startsWith('/profile')) return { title: 'My Profile' };
    if (path.startsWith('/submit-request')) return { title: 'Submit Print Job' };
    if (path.startsWith('/shop/') || path.startsWith('/shops/')) return { title: 'Shop Profile' };
    return { title: 'Dashboard' };
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 font-outfit">

      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs z-45 transition-opacity"
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
                to="/dashboard"
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
                    Customer Portal
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

              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  title="Close Menu"
                  className="w-8 h-8 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center cursor-pointer"
                >
                  <X size={18} />
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

          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
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
                  <div className="relative flex items-center justify-center">
                    <Icon
                      size={19}
                      className={`shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                      }`}
                    />
                    {collapsed && badge !== null && badge !== undefined && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand-400 border border-white dark:border-gray-900" />
                    )}
                  </div>
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {!collapsed && badge !== null && badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
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
            </div>
          </div>

          {/* Right: Actions, Theme, Notifications, User Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <ThemeToggle />
            <NotificationBell />

            {/* User Profile Pill */}
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-gray-200 dark:border-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
              title="View Customer Profile"
            >
              <div className="w-9 h-9 rounded-full bg-brand-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-theme-xs">
                {getInitials(fullName)}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-left">
                <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[120px]">
                  {fullName}
                </span>
                <ChevronDown size={14} className="text-gray-400 shrink-0" />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content View Container */}
        <main
          className={
            location.pathname.startsWith('/find-shop')
              ? "flex-1 overflow-hidden"
              : "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 bg-gray-50 dark:bg-gray-950 transition-colors"
          }
        >
          <div
            className={
              location.pathname.startsWith('/find-shop')
                ? "w-full h-full"
                : "max-w-7xl mx-auto w-full"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
