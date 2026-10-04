import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { shopAPI, notificationAPI } from '../services/api';
import NotificationBell from '../components/notifications/NotificationBell';
import ThemeToggle from '../components/common/ThemeToggle';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, ClipboardList, Layers, Settings,
  LogOut, ChevronLeft, ChevronRight, Menu, X, ChevronDown,
  Coins, MoreHorizontal, FileText, Clock, ShieldAlert,
  Store, ShieldCheck, Bell
} from 'lucide-react';

export default function OwnerLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, joinShopRoom } = useSocket() || {};
  const [collapsed, setCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  const isDesktop = windowWidth >= 1200;
  const isTablet = windowWidth >= 768 && windowWidth < 1200;
  const isMobile = windowWidth < 768;
  const isDrawer = windowWidth < 1200;

  const [shopId, setShopId] = useState(null);

  const fetchCounts = useCallback(async () => {
    try {
      const [dashRes, notifRes] = await Promise.allSettled([
        shopAPI.getMyShopDashboard(),
        notificationAPI.getUnreadCount(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.data) {
        const sId = dashRes.value.data.shop?._id;
        if (sId) setShopId(sId);
        setPendingOrdersCount(dashRes.value.data.stats?.pendingOrders || 0);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (shopId) {
      joinShopRoom?.(shopId);
    }
  }, [shopId, joinShopRoom]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      if (width >= 1200) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setShowProfileMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchCounts();

    socket.on('request:new', handleUpdate);
    socket.on('request:status', handleUpdate);
    socket.on('request:status_changed', handleUpdate);
    socket.on('request:cancelled', handleUpdate);
    socket.on('notification:new', handleUpdate);

    return () => {
      socket.off('request:new', handleUpdate);
      socket.off('request:status', handleUpdate);
      socket.off('request:status_changed', handleUpdate);
      socket.off('request:cancelled', handleUpdate);
      socket.off('notification:new', handleUpdate);
    };
  }, [socket, fetchCounts]);

  const navItems = [
    { to: '/owner/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/owner/requests', icon: ClipboardList, label: 'Orders', badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
    { to: '/owner/queue', icon: Layers, label: 'Queue' },
    { to: '/owner/sales', icon: Coins, label: 'Sales & Reports' },
    { to: '/owner/services', icon: FileText, label: 'Services & Pricing' },
    { to: '/owner/management', icon: Store, label: 'Shop Management' },
    { to: '/owner/notifications', icon: Bell, label: 'Notifications' },
    { to: '/owner/settings', icon: Settings, label: 'Account Settings' },
  ];

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'SP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const pageMeta = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/owner/requests') || path.startsWith('/owner/orders')) {
      return { title: 'Order Requests' };
    }
    if (path.startsWith('/owner/queue')) {
      return { title: 'Print Queue' };
    }
    if (path.startsWith('/owner/sales') || path.startsWith('/owner/reports')) {
      return { title: 'Sales & Analytics' };
    }
    if (path.startsWith('/owner/services')) {
      return { title: 'Services & Rates' };
    }
    if (path.startsWith('/owner/schedule')) {
      return { title: 'Operating Hours' };
    }
    if (path.startsWith('/owner/status')) {
      return { title: 'Store Status' };
    }
    if (path.startsWith('/owner/shop') || path.startsWith('/owner/profile')) {
      return { title: 'Shop Profile' };
    }
    if (path.startsWith('/owner/verification')) {
      return { title: 'Business Verification' };
    }
    if (path.startsWith('/owner/management')) {
      return { title: 'Shop Management' };
    }
    if (path.startsWith('/owner/notifications')) {
      return { title: 'Notifications' };
    }
    if (path.startsWith('/owner/settings')) {
      return { title: 'Account Settings' };
    }
    return { title: 'Shop Dashboard' };
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 font-outfit">

      {/* Drawer Overlay for Mobile and Tablet (< 1200px) */}
      {isDrawer && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* TailAdmin Modern Sidebar */}
      <aside
        className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
          isDrawer
            ? mobileOpen
              ? 'fixed inset-y-0 left-0 w-[270px] shadow-2xl'
              : 'hidden'
            : collapsed
            ? 'w-[80px]'
            : 'w-[270px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-[76px] px-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80">
          {(!collapsed || isDrawer) ? (
            <>
              <Link
                to="/owner/dashboard"
                className="flex items-center gap-3 no-underline group"
                title="PrintDayon Dashboard"
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
                    Shop Partner
                  </div>
                </div>
              </Link>

              {isDrawer ? (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  title="Close Menu"
                  className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              ) : (
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

        {/* Navigation Items */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto scrollbar-none">
          <div className={`px-2.5 pb-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ${collapsed && !isDrawer ? 'text-center' : ''}`}>
            {collapsed && !isDrawer ? '•••' : 'Store Menu'}
          </div>

          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={label}
              to={to}
              title={(collapsed && !isDrawer) ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                  collapsed && !isDrawer ? 'justify-center px-0' : 'justify-between'
                } ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-theme-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <Icon
                        size={19}
                        className={`transition-transform group-hover:scale-105 ${
                          isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                        }`}
                      />
                      {(collapsed && !isDrawer) && badge !== null && badge !== undefined && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warning-500 border-2 border-white dark:border-gray-900" />
                      )}
                    </div>
                    {(!collapsed || isDrawer) && <span className="truncate">{label}</span>}
                  </div>

                  {(!collapsed || isDrawer) && badge !== null && badge !== undefined && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-warning-50 text-warning-600 border border-warning-200 dark:bg-warning-500/20 dark:text-warning-400 dark:border-warning-500/30'
                    }`}>
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Drawer Bottom Actions */}
        <div className="p-3.5 border-t border-gray-100 dark:border-gray-800/80 space-y-1.5">
          {(!isDrawer && collapsed) && (
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
            title={(collapsed && !isDrawer) ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer ${
              collapsed && !isDrawer ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {(!collapsed || isDrawer) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top Header Bar */}
        <header className="h-[76px] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Hamburger Button for Mobile/Tablet (< 1200px) */}
            {isDrawer && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
                title="Open Navigation Menu"
              >
                <Menu size={20} />
              </button>
            )}

            {/* PrintDayon Logo + Wordmark on Mobile/Tablet */}
            {isDrawer && (
              <Link to="/owner/dashboard" className="flex items-center gap-2 no-underline shrink-0 mr-1" title="PrintDayon">
                <img src="/logo.png" alt="PrintDayon Logo" className="w-8 h-8 object-contain" />
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-gray-900 dark:text-white">
                  Print<span className="text-brand-500">Dayon</span>
                </span>
              </Link>
            )}

            {/* Page Title (Desktop only, >= 1200px) */}
            <div className={`min-w-0 ${isDrawer ? 'hidden' : ''}`}>
              <h1 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight m-0 truncate">
                {pageMeta.title}
              </h1>
            </div>
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <ThemeToggle variant="icon" />
            <NotificationBell />

            {/* Profile Menu Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-gray-200 dark:border-gray-800 bg-transparent border-t-0 border-r-0 border-b-0 cursor-pointer p-0"
              >
                <div className="w-9 h-9 rounded-xl bg-brand-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-theme-xs">
                  {getInitials(user?.name)}
                </div>

                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[130px]">
                    {user?.name || 'Shop Partner'}
                  </div>
                  <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 leading-tight">
                    Shop Owner
                  </div>
                </div>

                <ChevronDown size={14} className="text-gray-400 hidden lg:block" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-[125%] w-52 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-theme-lg p-2 z-50 transition-all">
                  <div className="p-2.5 border-b border-gray-100 dark:border-gray-700/80">
                    <div className="text-xs font-bold text-gray-900 dark:text-white truncate">{user?.name}</div>
                    <div className="text-[11px] text-gray-400 truncate">{user?.email}</div>
                  </div>
                  <Link
                    to="/owner/shop"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline mt-1"
                  >
                    <Settings size={15} /> Shop Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors bg-transparent border-0 cursor-pointer text-left"
                  >
                    <LogOut size={15} /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 bg-gray-50 dark:bg-gray-950 transition-colors ${isMobile ? 'pb-24' : ''}`}>
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation (< 768px): Home, Orders, Queue, More */}
      {isMobile && (
        <>
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex items-center justify-around py-1 px-2 shadow-theme-lg h-14">
            <NavLink
              to="/owner/dashboard"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors relative no-underline ${
                  isActive
                    ? 'text-brand-500 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={18} className={isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
                  <span className="text-[10px] mt-0.5 leading-tight">Home</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/owner/requests"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors relative no-underline ${
                  isActive
                    ? 'text-brand-500 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <ClipboardList size={18} className={isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
                    {pendingOrdersCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 bg-warning-500 text-white text-[9px] font-black px-1 rounded-full min-w-[14px] text-center leading-tight">
                        {pendingOrdersCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 leading-tight">Orders</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/owner/queue"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors relative no-underline ${
                  isActive
                    ? 'text-brand-500 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Layers size={18} className={isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
                  <span className="text-[10px] mt-0.5 leading-tight">Queue</span>
                </>
              )}
            </NavLink>

            <button
              type="button"
              onClick={() => setShowMobileMore(!showMobileMore)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors relative bg-transparent border-0 cursor-pointer ${
                showMobileMore
                  ? 'text-brand-500 font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium'
              }`}
            >
              <MoreHorizontal size={18} className={showMobileMore ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
              <span className="text-[10px] mt-0.5 leading-tight">More</span>
            </button>
          </nav>

          {/* "More" Bottom Sheet on Mobile */}
          {showMobileMore && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs"
                onClick={() => setShowMobileMore(false)}
              />
              <div className="relative bg-white dark:bg-gray-800 rounded-t-3xl border-t border-gray-200 dark:border-gray-700 shadow-2xl p-4 space-y-2 z-10 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-black uppercase tracking-wide text-gray-900 dark:text-white">
                    More Options
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMobileMore(false)}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <Link
                  to="/owner/sales"
                  onClick={() => setShowMobileMore(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-xs font-bold no-underline transition-colors"
                >
                  <Coins size={18} className="text-brand-500" />
                  <span>Sales &amp; Reports</span>
                </Link>

                <Link
                  to="/owner/services"
                  onClick={() => setShowMobileMore(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-xs font-bold no-underline transition-colors"
                >
                  <FileText size={18} className="text-brand-500" />
                  <span>Services &amp; Pricing</span>
                </Link>

                <Link
                  to="/owner/management"
                  onClick={() => setShowMobileMore(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-xs font-bold no-underline transition-colors"
                >
                  <Store size={18} className="text-brand-500" />
                  <span>Shop Management</span>
                </Link>

                <Link
                  to="/owner/notifications"
                  onClick={() => setShowMobileMore(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-xs font-bold no-underline transition-colors"
                >
                  <Bell size={18} className="text-brand-500" />
                  <span>Notifications</span>
                </Link>

                <Link
                  to="/owner/settings"
                  onClick={() => setShowMobileMore(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-xs font-bold no-underline transition-colors"
                >
                  <Settings size={18} className="text-brand-500" />
                  <span>Account Settings</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMore(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-bold bg-transparent border-0 cursor-pointer transition-colors text-left"
                >
                  <LogOut size={18} className="text-rose-600" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
