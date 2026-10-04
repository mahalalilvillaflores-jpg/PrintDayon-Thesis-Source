import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import MapView from '../../components/map/MapView';
import {
  Users, Store, FileText, ShieldCheck,
  RefreshCw, Check, X,
  MapPin, Eye, ExternalLink, Download,
  ShoppingBag
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DashboardContainer,
  DashboardMetricsGrid,
  DashboardMetricCard,
} from '../../components/common/UnifiedDashboard';

const NAVY = '#101828';
const BLUE = '#465FFF';
const AMBER = '#F79009';
const GREEN = '#12B76A';
const RED = '#F04438';
const GRAY = '#667085';

function generateCurvedPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function generateAreaPath(points, baseY = 125) {
  if (!points || points.length === 0) return '';
  const curve = generateCurvedPath(points);
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  return `${curve} L ${lastX},${baseY} L ${firstX},${baseY} Z`;
}

const cardStyle = {
  background: 'var(--dash-card-bg, white)',
  borderRadius: '1.25rem',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 2px 12px rgba(6,63,92,0.03)',
  border: '1px solid var(--dash-slate-border, #E2E8F0)',
  transition: 'all 0.2s ease',
};

export default function AdminDashboard() {
  const { socket } = useSocket();

  const [stats, setStats] = useState(null);
  const [shops, setShops] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('week');

  const [inspectShop, setInspectShop] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const chartRef = useRef(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [statsRes, shopsRes, requestsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getShops({ limit: 50, sort: 'createdAt:-1' }),
        adminAPI.getRequests({ limit: 50, sort: 'createdAt:-1' }),
      ]);

      if (statsRes?.data) setStats(statsRes.data);

      const shopList = shopsRes?.data?.shops || shopsRes?.data || [];
      setShops(Array.isArray(shopList) ? shopList : []);

      const reqList = requestsRes?.data?.requests || requestsRes?.data || [];
      setRequests(Array.isArray(reqList) ? reqList : []);

      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to connect to backend service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!socket) return;

    const handleStatsUpdate = (newStats) => {
      setStats(newStats);
      setLastUpdated(new Date());
    };

    const handleDataEvent = () => fetchAll(true);

    socket.on('stats:update', handleStatsUpdate);
    socket.on('shop:submitted', handleDataEvent);
    socket.on('shop:verified', handleDataEvent);
    socket.on('user:registered', handleDataEvent);
    socket.on('request:new', handleDataEvent);
    socket.on('request:statusChanged', handleDataEvent);

    return () => {
      socket.off('stats:update', handleStatsUpdate);
      socket.off('shop:submitted', handleDataEvent);
      socket.off('shop:verified', handleDataEvent);
      socket.off('user:registered', handleDataEvent);
      socket.off('request:new', handleDataEvent);
      socket.off('request:statusChanged', handleDataEvent);
    };
  }, [socket, fetchAll]);

  const handleVerifyShop = async (shopId, status) => {
    setActionLoading(true);
    try {
      await adminAPI.verifyShop(shopId, status);
      toast.success(`Shop ${status === 'verified' ? 'approved & activated' : 'rejected'}!`);
      setInspectShop(null);
      fetchAll(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const rows = [
        ['Shop Name', 'Owner Name', 'Address', 'Status', 'Verification', 'Queue Count'],
        ...shops.map(s => [
          `"${s.shopName || ''}"`,
          `"${s.ownerId?.name || s.ownerName || ''}"`,
          `"${s.address || ''}"`,
          s.status || 'closed',
          s.verificationStatus || 'pending',
          s.currentQueue || 0
        ])
      ];
      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `PrintDayon_Naval_Network_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Report exported successfully!');
    } catch (_) {
      toast.error('Export failed.');
    }
  };

  function timeAgo(date) {
    if (!date) return '—';
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  function fmt(n) { return (n ?? 0).toLocaleString(); }

  const totalUsers = stats?.users?.total ?? 0;
  const totalCustomers = stats?.users?.customer ?? 0;
  const totalShopOwners = stats?.users?.shop_owner ?? 0;
  const totalShops = stats?.shops?.total ?? 0;
  const verifiedShops = stats?.shops?.verified ?? 0;
  const pendingShops = stats?.shops?.pending ?? 0;
  const totalRequests = stats?.requests?.total ?? 0;
  const completedReq = stats?.requests?.completed ?? 0;
  const pendingReq = stats?.requests?.pending ?? 0;
  const cancelledReq = stats?.requests?.cancelled ?? 0;
  const platformRevenue = stats?.platformRevenue ?? 0;
  const completedSales = stats?.completedSales ?? 0;

  const pendingShopList = useMemo(() => {
    return shops.filter(s => s?.verificationStatus === 'pending');
  }, [shops]);

  const avgWaitTimeMinutes = useMemo(() => {
    const verified = shops.filter(s => s?.verificationStatus === 'verified');
    if (!verified.length) return 0;
    const totalQueue = verified.reduce((acc, s) => acc + (s?.currentQueue || 0), 0);
    return ((totalQueue * 2.5) / verified.length).toFixed(1);
  }, [shops]);

  const chartBuckets = useMemo(() => {
    let labels = [];
    let fullLabels = [];

    if (timeFilter === 'today') {
      labels = ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'];
      fullLabels = [
        'Today, 6:00 AM',
        'Today, 9:00 AM',
        'Today, 12:00 PM',
        'Today, 3:00 PM',
        'Today, 6:00 PM',
        'Today, 9:00 PM',
        'Today, 12:00 AM',
      ];
    } else if (timeFilter === 'month') {
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      fullLabels = [
        'Days 1–7 of Month',
        'Days 8–14 of Month',
        'Days 15–21 of Month',
        'Days 22–End of Month',
      ];
    } else {
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      fullLabels = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];
    }

    const n = labels.length;
    const padX = 35;
    const chartW = 500 - padX * 2;

    const buckets = labels.map((lbl, idx) => ({
      label: lbl,
      fullLabel: fullLabels[idx],
      x: Math.round(padX + (idx / (n - 1)) * chartW),
      total: 0,
      completed: 0,
      inProgress: 0,
      cancelled: 0,
    }));

    const now = new Date();
    const todayDayOfWeek = (now.getDay() + 6) % 7;

    let mappedAny = false;
    requests.forEach((req) => {
      if (!req?.createdAt) return;
      const d = new Date(req.createdAt);
      if (isNaN(d.getTime())) return;

      const st = (req.status || '').toLowerCase();
      const isCompleted = st === 'completed';
      const isCancelled = st === 'cancelled' || st === 'rejected';

      if (timeFilter === 'week') {
        const dayIdx = (d.getDay() + 6) % 7;
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7 && dayIdx >= 0 && dayIdx < 7) {
          buckets[dayIdx].total += 1;
          if (isCompleted) buckets[dayIdx].completed += 1;
          else if (isCancelled) buckets[dayIdx].cancelled += 1;
          else buckets[dayIdx].inProgress += 1;
          mappedAny = true;
        }
      } else if (timeFilter === 'today') {
        const isSameDay = d.toDateString() === now.toDateString();
        if (isSameDay) {
          const h = d.getHours();
          let bucketIdx = 0;
          if (h < 7) bucketIdx = 0;
          else if (h < 10) bucketIdx = 1;
          else if (h < 13) bucketIdx = 2;
          else if (h < 16) bucketIdx = 3;
          else if (h < 19) bucketIdx = 4;
          else if (h < 22) bucketIdx = 5;
          else bucketIdx = 6;

          buckets[bucketIdx].total += 1;
          if (isCompleted) buckets[bucketIdx].completed += 1;
          else if (isCancelled) buckets[bucketIdx].cancelled += 1;
          else buckets[bucketIdx].inProgress += 1;
          mappedAny = true;
        }
      } else if (timeFilter === 'month') {
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        if (diffDays <= 31) {
          const dayOfMonth = d.getDate();
          const bIdx = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
          buckets[bIdx].total += 1;
          if (isCompleted) buckets[bIdx].completed += 1;
          else if (isCancelled) buckets[bIdx].cancelled += 1;
          else buckets[bIdx].inProgress += 1;
          mappedAny = true;
        }
      }
    });

    if (!mappedAny && totalRequests > 0) {
      let targetIdx = 0;
      if (timeFilter === 'week') targetIdx = todayDayOfWeek;
      else if (timeFilter === 'today') {
        const h = now.getHours();
        targetIdx = h < 7 ? 0 : h < 10 ? 1 : h < 13 ? 2 : h < 16 ? 3 : h < 19 ? 4 : h < 22 ? 5 : 6;
      } else if (timeFilter === 'month') {
        targetIdx = Math.min(3, Math.floor((now.getDate() - 1) / 7));
      }

      buckets[targetIdx].total = totalRequests;
      buckets[targetIdx].completed = completedReq;
      buckets[targetIdx].inProgress = pendingReq;
      buckets[targetIdx].cancelled = cancelledReq;
    }

    const maxVal = Math.max(4, ...buckets.map((b) => b.total));
    const baseY = 125;
    const topY = 25;
    const usableH = baseY - topY;

    buckets.forEach((b) => {
      b.totalY = Number((baseY - (b.total / maxVal) * usableH).toFixed(1));
      b.inProgressY = Number((baseY - (b.inProgress / maxVal) * usableH).toFixed(1));
      b.completedY = Number((baseY - (b.completed / maxVal) * usableH).toFixed(1));
    });

    return buckets;
  }, [timeFilter, requests, totalRequests, completedReq, pendingReq, cancelledReq]);

  const chartPaths = useMemo(() => {
    const totalPoints = chartBuckets.map((b) => ({ x: b.x, y: b.totalY }));
    const inProgressPoints = chartBuckets.map((b) => ({ x: b.x, y: b.inProgressY }));
    const completedPoints = chartBuckets.map((b) => ({ x: b.x, y: b.completedY }));

    return {
      totalCurve: generateCurvedPath(totalPoints),
      totalArea: generateAreaPath(totalPoints, 125),
      inProgressCurve: generateCurvedPath(inProgressPoints),
      completedCurve: generateCurvedPath(completedPoints),
    };
  }, [chartBuckets]);

  const handlePointerMove = useCallback((clientX) => {
    if (!chartRef.current || !chartBuckets.length) return;
    const rect = chartRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
    const idx = Math.min(
      chartBuckets.length - 1,
      Math.max(0, Math.round(ratio * (chartBuckets.length - 1)))
    );
    setHoveredIndex(idx);
  }, [chartBuckets.length]);

  const activeBucket = hoveredIndex !== null ? chartBuckets[hoveredIndex] : null;

  const displayMetrics = activeBucket
    ? [
        { label: 'Total Volume', value: fmt(activeBucket.total), color: BLUE },
        { label: 'Completed', value: fmt(activeBucket.completed), color: GREEN },
        { label: 'In Progress', value: fmt(activeBucket.inProgress), color: AMBER },
        { label: 'Cancelled', value: fmt(activeBucket.cancelled), color: RED },
      ]
    : [
        { label: 'Total Volume', value: fmt(totalRequests), color: BLUE },
        { label: 'Completed', value: fmt(completedReq), color: GREEN },
        { label: 'In Progress', value: fmt(pendingReq), color: AMBER },
        { label: 'Cancelled', value: fmt(cancelledReq), color: RED },
      ];

  if (loading) {
    return (
      <div className="w-full py-8 text-center">
        <div style={{ ...cardStyle, padding: '4rem 2rem' }}>
          <div style={{ display: 'inline-block', width: '36px', height: '36px', border: `3px solid ${BLUE}20`, borderTopColor: BLUE, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: GRAY, fontWeight: 600 }}>Connecting to Naval PrintDayon Network...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <DashboardContainer className="fade-in">

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 mb-5">
        <DashboardMetricCard
          icon={Users}
          label="Total Users"
          value={fmt(totalUsers)}
          color="blue"
          footerText={`${fmt(totalCustomers)} customers · ${fmt(totalShopOwners)} owners`}
        />

        <DashboardMetricCard
          icon={Store}
          label="Printing Shops"
          value={fmt(totalShops)}
          color="teal"
          footerText={`${fmt(verifiedShops)} verified • ~${avgWaitTimeMinutes}m avg wait`}
        />

        <DashboardMetricCard
          icon={ShieldCheck}
          label="Pending Verification"
          value={fmt(pendingShops)}
          color={pendingShops > 0 ? 'amber' : 'emerald'}
          footerText={pendingShops > 0 ? `${pendingShops} action required` : 'All applications reviewed'}
        />

        <DashboardMetricCard
          icon={FileText}
          label="Total Print Orders"
          value={fmt(totalRequests)}
          color="purple"
          footerText={`${fmt(completedReq)} completed · ${fmt(pendingReq)} active`}
        />

        <DashboardMetricCard
          icon={ShoppingBag}
          label="Platform Revenue (3%)"
          value={`₱${fmt(platformRevenue)}`}
          color="amber"
          footerText={`From ₱${fmt(completedSales)} Total GMV`}
          className="sm:col-span-2 md:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5 items-stretch">

        {/* Print Orders & Activity Trends Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs transition-all relative overflow-hidden flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white m-0 tracking-tight font-outfit">
                    Print Orders &amp; Activity Trends
                  </h2>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-600 border border-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/30">
                    Live Feed
                  </span>
                </div>
              </div>

              {/* Time Period Filter Pills */}
              <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl gap-1 border border-gray-200/80 dark:border-gray-700 self-start sm:self-auto shrink-0">
                {['today', 'week', 'month'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTimeFilter(t);
                      setHoveredIndex(null);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${
                      timeFilter === t
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-theme-xs'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Legend */}
            <div className="flex items-center gap-4 mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                Total Orders
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-warning-500" />
                In Progress
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-success-500" />
                Completed
              </span>
            </div>
          </div>

          {/* Interactive Responsive SVG Area Chart */}
          <div
            ref={chartRef}
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchMove={(e) => {
              if (e.touches?.[0]) handlePointerMove(e.touches[0].clientX);
            }}
            onTouchEnd={() => setHoveredIndex(null)}
            className="relative w-full h-[175px] select-none cursor-crosshair touch-none"
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 500 160"
              preserveAspectRatio="none"
              className="overflow-visible"
            >
              <defs>
                <linearGradient id="orderVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#465FFF" stopOpacity="0.25" />
                  <stop offset="85%" stopColor="#465FFF" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#465FFF" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Horizontal Reference Grid Lines */}
              {[25, 60, 95, 125].map((y) => (
                <line
                  key={y}
                  x1="30"
                  y1={y}
                  x2="470"
                  y2={y}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Area Fill Under Total Orders Curve */}
              {chartPaths.totalArea && (
                <path d={chartPaths.totalArea} fill="url(#orderVolumeGrad)" />
              )}

              {/* Total Orders Curve (Brand Blue) */}
              {chartPaths.totalCurve && (
                <path
                  d={chartPaths.totalCurve}
                  fill="none"
                  stroke={BLUE}
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* In-Progress Orders Curve (Amber) */}
              {chartPaths.inProgressCurve && (
                <path
                  d={chartPaths.inProgressCurve}
                  fill="none"
                  stroke={AMBER}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Completed Orders Curve (Green) */}
              {chartPaths.completedCurve && (
                <path
                  d={chartPaths.completedCurve}
                  fill="none"
                  stroke={GREEN}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* End Point Markers (when not hovered) */}
              {hoveredIndex === null && chartBuckets.length > 0 && (
                <>
                  <circle
                    cx={chartBuckets[chartBuckets.length - 1].x}
                    cy={chartBuckets[chartBuckets.length - 1].totalY}
                    r="4.5"
                    fill={BLUE}
                    stroke="white"
                    strokeWidth="2"
                  />
                  <circle
                    cx={chartBuckets[chartBuckets.length - 1].x}
                    cy={chartBuckets[chartBuckets.length - 1].inProgressY}
                    r="3.5"
                    fill={AMBER}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={chartBuckets[chartBuckets.length - 1].x}
                    cy={chartBuckets[chartBuckets.length - 1].completedY}
                    r="3.5"
                    fill={GREEN}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                </>
              )}

              {/* Active Crosshair Guide & Interactive Points (when hovered) */}
              {hoveredIndex !== null && activeBucket && (
                <>
                  <line
                    x1={activeBucket.x}
                    y1={18}
                    x2={activeBucket.x}
                    y2={125}
                    stroke="#64748B"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.65"
                  />
                  {/* Highlight on Blue Point */}
                  <circle
                    cx={activeBucket.x}
                    cy={activeBucket.totalY}
                    r="8"
                    fill={BLUE}
                    opacity="0.25"
                  />
                  <circle
                    cx={activeBucket.x}
                    cy={activeBucket.totalY}
                    r="5"
                    fill={BLUE}
                    stroke="white"
                    strokeWidth="2.5"
                  />

                  {/* Highlight on Amber Point */}
                  <circle
                    cx={activeBucket.x}
                    cy={activeBucket.inProgressY}
                    r="4"
                    fill={AMBER}
                    stroke="white"
                    strokeWidth="2"
                  />

                  {/* Highlight on Green Point */}
                  <circle
                    cx={activeBucket.x}
                    cy={activeBucket.completedY}
                    r="4"
                    fill={GREEN}
                    stroke="white"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>

            {/* Floating Real-Time Details Tooltip */}
            {hoveredIndex !== null && activeBucket && (
              <div
                className="pointer-events-none absolute z-30 transition-all duration-75 ease-out bg-gray-900/95 dark:bg-gray-800/95 text-white p-3 rounded-2xl shadow-theme-lg border border-gray-700/80 backdrop-blur-md min-w-[170px]"
                style={{
                  left: `${(activeBucket.x / 500) * 100}%`,
                  top: `${Math.max(10, Math.min(55, (activeBucket.totalY / 160) * 100 - 25))}%`,
                  transform:
                    hoveredIndex > (chartBuckets.length - 1) / 2
                      ? 'translate(calc(-100% - 14px), -50%)'
                      : 'translate(14px, -50%)',
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-gray-700/80 pb-1.5 mb-2">
                  <span className="text-xs font-bold text-gray-100">{activeBucket.fullLabel}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/25 text-brand-300 border border-brand-400/30">
                    {activeBucket.total} {activeBucket.total === 1 ? 'order' : 'orders'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-brand-500 ring-1 ring-white/60" />
                      Total Orders
                    </span>
                    <span className="font-bold text-white">{activeBucket.total}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-warning-500" />
                      In Progress
                    </span>
                    <span className="font-bold text-warning-400">{activeBucket.inProgress}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-success-500" />
                      Completed
                    </span>
                    <span className="font-bold text-success-400">{activeBucket.completed}</span>
                  </div>

                  {activeBucket.cancelled > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <span className="w-2 h-2 rounded-full bg-error-500" />
                        Cancelled
                      </span>
                      <span className="font-bold text-error-400">{activeBucket.cancelled}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* X-Axis Dynamic Labels */}
            <div className="relative w-full h-5 mt-1 select-none pointer-events-auto">
              {chartBuckets.map((b, i) => (
                <span
                  key={b.label}
                  onMouseEnter={() => setHoveredIndex(i)}
                  className={`absolute text-[11px] font-bold transition-all -translate-x-1/2 cursor-pointer ${
                    hoveredIndex === i
                      ? 'text-brand-600 dark:text-brand-400 scale-110'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }`}
                  style={{ left: `${(b.x / 500) * 100}%` }}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom 4 Responsive Metrics */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[11px] font-bold">
                {activeBucket ? (
                  <span className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    Live Focus: {activeBucket.fullLabel}
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 font-semibold">
                    Overall Summary ({timeFilter === 'today' ? 'Today' : timeFilter === 'month' ? 'This Month' : 'This Week'})
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-400 hidden sm:inline">
                {activeBucket ? 'Hover away to reset' : 'Hover points to inspect'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {displayMetrics.map((s) => (
                <div
                  key={s.label}
                  className={`p-2.5 rounded-xl border transition-all ${
                    activeBucket
                      ? 'bg-brand-50/50 dark:bg-brand-500/10 border-brand-200/80 dark:border-brand-500/30 shadow-theme-xs'
                      : 'bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</div>
                  <div className="text-lg sm:text-xl font-extrabold mt-0.5 font-outfit" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Naval Printing Network Map Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs transition-all flex flex-col h-full">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white m-0 tracking-tight font-outfit">
              Naval Printing Network Map
            </h2>
            <Link to="/find-shop" className="text-xs text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1 hover:underline no-underline">
              Full Map <ExternalLink size={12} />
            </Link>
          </div>

          <div className="flex-1 w-full min-h-[340px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 relative flex flex-col">
            <MapView
              shops={shops}
              userLocation={{ lat: 11.56437, lng: 124.39964 }}
              height="100%"
              className="w-full h-full flex-1 flex flex-col"
              initialZoom={14}
              onShopSelect={(s) => setInspectShop(s)}
            />
            <div className="absolute bottom-2.5 left-2.5 z-10 hidden sm:flex items-center gap-3 px-3 h-[34px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-800 shadow-theme-xs">
              {[
                { color: '#12B76A', textColor: '#12B76A', label: 'Open' },
                { color: '#F79009', textColor: '#F79009', label: 'Busy' },
                { color: '#667085', textColor: '#667085', label: 'Closed' },
              ].map(({ color, textColor, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: color,
                      border: '2px solid white',
                      boxShadow: `0 0 0 1.5px ${color}`,
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{ color: textColor }}
                    className="text-[11px] font-bold"
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5 items-stretch">

        {/* Partner Printing Shops List Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs transition-all flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white m-0 tracking-tight font-outfit">
                Partner Printing Shops
              </h2>
              {pendingShopList.length > 0 && (
                <span className="bg-warning-50 text-warning-600 border border-warning-200/80 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {pendingShopList.length} Pending
                </span>
              )}
            </div>
            <Link to="/admin/shops" className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline no-underline">
              Manage All →
            </Link>
          </div>

          {shops.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Store size={36} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <div className="font-bold text-sm text-gray-900 dark:text-white">No partner shops registered yet</div>
              <div className="text-xs mt-1">New shop registrations will appear here for verification.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {shops.slice(0, 5).map((shop) => {
                if (!shop) return null;
                const isPending = shop.verificationStatus === 'pending';
                const isVerified = shop.verificationStatus === 'verified';
                return (
                  <div
                    key={shop._id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isPending
                        ? 'bg-warning-50/40 border-warning-200/80 dark:bg-warning-500/10 dark:border-warning-500/20'
                        : 'bg-white dark:bg-white/[0.02] border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-theme-xs ${
                        isPending
                          ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300'
                          : 'bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                      }`}>
                        {(shop.shopName || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {shop.shopName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                          <MapPin size={11} className="shrink-0 text-gray-400" />
                          <span className="truncate">{shop.address || 'Naval, Biliran'} · {timeAgo(shop.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                        isVerified
                          ? 'bg-success-50 text-success-600 border-success-200 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/30'
                          : isPending
                          ? 'bg-warning-50 text-warning-600 border-warning-200 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/30'
                          : 'bg-error-50 text-error-600 border-error-200 dark:bg-error-500/15 dark:text-error-400 dark:border-error-500/30'
                      }`}>
                        {shop.verificationStatus || 'Pending'}
                      </span>

                      <button
                        type="button"
                        onClick={() => setInspectShop(shop)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-500/30 transition-colors cursor-pointer"
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Print Orders List Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs transition-all flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white m-0 tracking-tight font-outfit">
              Recent Print Orders
            </h2>
            <Link to="/admin/requests" className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline no-underline">
              View All →
            </Link>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <div className="font-bold text-sm text-gray-900 dark:text-white">No print orders yet</div>
              <div className="text-xs mt-1">Customer submissions will appear live here.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {requests.slice(0, 5).map((req) => {
                const isReady = req.status === 'ready' || req.status === 'completed';
                const isPrinting = req.status === 'printing';
                return (
                  <div
                    key={req._id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-gray-700 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-theme-xs ${
                        isReady
                          ? 'bg-success-50 text-success-600 dark:bg-success-500/20 dark:text-success-400'
                          : isPrinting
                          ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                          : 'bg-warning-50 text-warning-600 dark:bg-warning-500/20 dark:text-warning-400'
                      }`}>
                        <FileText size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {req.documentId?.originalFilename || `Print Order #${req._id.slice(-6).toUpperCase()}`}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {req.shopId?.shopName || 'Printing Shop'} · {timeAgo(req.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                        isReady
                          ? 'bg-success-50 text-success-600 border-success-200 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/30'
                          : isPrinting
                          ? 'bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/30'
                          : 'bg-warning-50 text-warning-600 border-warning-200 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/30'
                      }`}>
                        ● {req.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {inspectShop && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-theme-xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gray-900 dark:bg-gray-800 p-5 sm:p-6 text-white flex justify-between items-center border-b border-gray-800">
              <div>
                <span className="text-[10px] font-extrabold text-brand-300 uppercase tracking-wider block mb-0.5">
                  Partner Shop Profile
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold m-0 leading-tight font-outfit">
                  {inspectShop.shopName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectShop(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Owner Name</div>
                  <div className="font-bold text-gray-900 dark:text-white mt-1">{inspectShop.ownerId?.name || inspectShop.ownerName || 'Partner'}</div>
                  <div className="text-[11px] text-gray-500 truncate">{inspectShop.ownerId?.email || '—'}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Cellphone Number</div>
                  <div className="font-bold text-gray-900 dark:text-white mt-1">{inspectShop.contactNumber || 'No cellphone provided'}</div>
                  <div className="text-[11px] text-success-600 font-semibold">Verified Cellphone</div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Physical Address &amp; Naval GPS Coordinates</div>
                <div className="font-bold text-gray-900 dark:text-white mt-1">{inspectShop.address || 'Naval, Biliran'}</div>
                <div className="text-[11px] text-brand-600 dark:text-brand-400 mt-1 font-semibold">
                  Lat: {inspectShop.latitude || 11.5628}, Lng: {inspectShop.longitude || 124.3980}
                </div>
              </div>

              {inspectShop.description && (
                <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Shop Description / Equipment</div>
                  {inspectShop.description}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleVerifyShop(inspectShop._id, 'rejected')}
                  disabled={actionLoading}
                  className="flex-1 h-11 rounded-xl border border-error-200 bg-error-50 hover:bg-error-100 text-error-600 text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <X size={15} /> Reject Application
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifyShop(inspectShop._id, 'verified')}
                  disabled={actionLoading}
                  className="flex-2 h-11 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors shadow-theme-xs disabled:opacity-50"
                >
                  <Check size={16} /> Approve &amp; Verify Shop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </DashboardContainer>
  );
}
