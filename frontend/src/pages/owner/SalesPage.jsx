import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopAPI, requestAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  Search, RefreshCw, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardContainer } from '../../components/common/UnifiedDashboard';
import DateRangePicker from '../../components/common/DateRangePicker';

function getServiceDescription(order) {
  if (!order) return 'General Printing';
  const specs = order.printingSpecifications || {};
  const isColor = specs.colorMode === 'color';
  const binding = specs.binding && specs.binding !== 'none';

  if (binding) {
    if (specs.binding === 'soft_bound' || specs.binding === 'spiral') {
      return 'Bookbinding';
    }
    return 'Document Binding';
  }
  if (specs.paperType === 'photo' || specs.paperType === 'glossy') {
    return 'Photo / Glossy Print';
  }
  if (isColor) {
    return 'Color Printing';
  }
  return 'B&W Printing';
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OwnerSalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = searchParams.get('range') || 'today';
  
  const [timeRange, setTimeRange] = useState(initialRange);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [shop, setShop] = useState(null);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { socket, joinShopRoom } = useSocket() || {};

  // Fetch shop and completed requests
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const dashRes = await shopAPI.getMyShopDashboard();
      if (dashRes.data) {
        const s = dashRes.data.shop;
        setShop(s);
        if (s?._id) {
          joinShopRoom?.(s._id);
          // Fetch completed orders
          const reqRes = await requestAPI.getShopRequests(s._id, {
            status: 'completed',
            limit: 200,
          });
          const list = reqRes.data?.requests || reqRes.data || [];
          setCompletedOrders(list);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sales data:', err);
      toast.error('Failed to load sales data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [joinShopRoom]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle URL range param sync
  useEffect(() => {
    const range = searchParams.get('range');
    if (range && ['today', 'week', 'month', 'custom'].includes(range)) {
      setTimeRange(range);
    }
  }, [searchParams]);

  // Filter orders by selected time range
  const filteredOrders = useMemo(() => {
    const now = new Date();

    return completedOrders.filter((order) => {
      const date = new Date(order.completedAt || order.updatedAt || order.submittedAt || order.createdAt);

      if (timeRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return date >= startOfDay;
      }

      if (timeRange === 'week') {
        // Last 7 days
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        startOfWeek.setHours(0, 0, 0, 0);
        return date >= startOfWeek;
      }

      if (timeRange === 'month') {
        // Current calendar month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return date >= startOfMonth;
      }

      if (timeRange === 'custom') {
        if (!customStartDate && !customEndDate) return true;
        const start = customStartDate ? new Date(customStartDate) : new Date(0);
        const end = customEndDate ? new Date(customEndDate) : new Date(8640000000000000);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
      }

      return true;
    }).filter((order) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().replace(/^#/, '');
      const code = (order.claimCode || '').toLowerCase().replace(/^#/, '');
      const id = (order._id || '').toLowerCase();
      const customer = (order.customerId?.name || order.customerName || '').toLowerCase();
      const service = getServiceDescription(order).toLowerCase();
      return code.includes(q) || id.includes(q) || customer.includes(q) || service.includes(q);
    }).sort((a, b) => {
      const dateA = new Date(a.completedAt || a.updatedAt || a.submittedAt || a.createdAt);
      const dateB = new Date(b.completedAt || b.updatedAt || b.submittedAt || b.createdAt);
      return dateB - dateA;
    });
  }, [completedOrders, timeRange, customStartDate, customEndDate, searchQuery]);

  // Aggregate Metrics
  const grossSales = useMemo(() => {
    return filteredOrders.reduce((acc, curr) => acc + (curr.estimatedCost || 0), 0);
  }, [filteredOrders]);

  const platformFee = useMemo(() => {
    return grossSales * 0.03;
  }, [grossSales]);

  const netEarnings = useMemo(() => {
    return grossSales - platformFee;
  }, [grossSales, platformFee]);

  const completedOrdersCount = filteredOrders.length;

  const averageOrder = useMemo(() => {
    if (completedOrdersCount === 0) return 0;
    return netEarnings / completedOrdersCount;
  }, [netEarnings, completedOrdersCount]);

  const todayFormatted = useMemo(() => {
    return `Today · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }, []);

  // Chart Data Memoization (Net Earnings Basis)
  const chartData = useMemo(() => {
    if (timeRange === 'today') {
      const buckets = [
        { label: '8 AM', minH: 0, maxH: 9 },
        { label: '10 AM', minH: 9, maxH: 11 },
        { label: '12 PM', minH: 11, maxH: 13 },
        { label: '2 PM', minH: 13, maxH: 15 },
        { label: '4 PM', minH: 15, maxH: 17 },
        { label: '6 PM', minH: 17, maxH: 19 },
        { label: '8 PM', minH: 19, maxH: 24 },
      ];
      const data = buckets.map(b => ({ label: b.label, value: 0 }));
      filteredOrders.forEach(o => {
        const d = new Date(o.completedAt || o.updatedAt || o.submittedAt || o.createdAt);
        const h = d.getHours();
        const cost = Number(o.estimatedCost || 0) * 0.97;
        const idx = buckets.findIndex(b => h >= b.minH && h < b.maxH);
        if (idx !== -1) data[idx].value += cost;
      });
      return data;
    }

    if (timeRange === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = days.map(label => ({ label, value: 0 }));
      filteredOrders.forEach(o => {
        const d = new Date(o.completedAt || o.updatedAt || o.submittedAt || o.createdAt);
        const dayIdx = (d.getDay() + 6) % 7;
        const cost = Number(o.estimatedCost || 0) * 0.97;
        data[dayIdx].value += cost;
      });
      return data;
    }

    if (timeRange === 'month') {
      const intervals = [
        { label: '1-5', minD: 1, maxD: 6 },
        { label: '6-10', minD: 6, maxD: 11 },
        { label: '11-15', minD: 11, maxD: 16 },
        { label: '16-20', minD: 16, maxD: 21 },
        { label: '21-25', minD: 21, maxD: 26 },
        { label: '26+', minD: 26, maxD: 32 },
      ];
      const data = intervals.map(i => ({ label: i.label, value: 0 }));
      filteredOrders.forEach(o => {
        const d = new Date(o.completedAt || o.updatedAt || o.submittedAt || o.createdAt);
        const dayNum = d.getDate();
        const cost = Number(o.estimatedCost || 0) * 0.97;
        const idx = intervals.findIndex(i => dayNum >= i.minD && dayNum < i.maxD);
        if (idx !== -1) data[idx].value += cost;
      });
      return data;
    }

    const buckets = [
      { label: 'Period Start', idx: 0 },
      { label: 'Mid Period', idx: 1 },
      { label: 'Period End', idx: 2 },
    ];
    const data = buckets.map(b => ({ label: b.label, value: 0 }));
    if (filteredOrders.length > 0) {
      filteredOrders.forEach((o, i) => {
        const cost = Number(o.estimatedCost || 0) * 0.97;
        const targetIdx = i % 3;
        data[targetIdx].value += cost;
      });
    }
    return data;
  }, [filteredOrders, timeRange]);

  const { chartPoints, chartLinePath, chartAreaPath } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { chartPoints: [], chartLinePath: '', chartAreaPath: '' };
    }
    const maxVal = Math.max(...chartData.map(d => d.value), 1);
    const startX = 35;
    const endX = 475;
    const width = endX - startX;
    const minY = 105;
    const maxY = 20;
    const height = minY - maxY;

    const points = chartData.map((d, i) => {
      const x = startX + (i / (chartData.length - 1)) * width;
      const y = minY - (d.value / maxVal) * height;
      return { x, y, label: d.label, value: d.value };
    });

    const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${minY} L ${points[0].x.toFixed(1)} ${minY} Z`;

    return { chartPoints: points, chartLinePath: lineD, chartAreaPath: areaD };
  }, [chartData]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <div className="spinner" />
        <div className="text-xs text-[#64748B] dark:text-slate-400 font-bold">Loading sales analytics...</div>
      </div>
    );
  }

  return (
    <DashboardContainer className="dash-page-container w-full py-1 space-y-4 font-outfit">
      {/* ─────────────────────────────────────────────────────────────
          1. PERIOD FILTER
          [ Today ] [ This Week ] [ This Month ] [ Custom Range ]
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-nowrap -mx-1 px-1">
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'custom', label: 'Custom Range' },
          ].map((tab) => {
            const isActive = timeRange === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setTimeRange(tab.key);
                  setSearchParams({ range: tab.key });
                  if (tab.key !== 'custom') {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#465FFF] text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-[#64748B] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700 hover:bg-[#F9FAFB] dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Inputs if Custom Range selected */}
        {timeRange === 'custom' && (
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150 shadow-2xs">
            <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onStartDateChange={setCustomStartDate}
              onEndDateChange={setCustomEndDate}
              onReset={() => {
                setCustomStartDate('');
                setCustomEndDate('');
              }}
            />
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. YOUR EARNINGS SUMMARY SECTION
      ───────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 shadow-2xs space-y-3.5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 block">
            YOUR EARNINGS
          </span>
          <span className="text-xs text-[#64748B] dark:text-slate-400 font-medium block mt-0.5">
            After 3% platform commission
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#101828] dark:text-white mt-1">
            ₱{netEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="pt-3 border-t border-[#E2E8F0] dark:border-slate-700/80 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block uppercase tracking-wider">
              Gross Sales
            </span>
            <span className="font-bold text-[#101828] dark:text-slate-200 text-xs sm:text-sm mt-0.5 block">
              ₱{grossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block uppercase tracking-wider">
              Platform Fee (3%)
            </span>
            <span className="font-medium text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 block">
              −₱{platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block uppercase tracking-wider">
              Your Earnings
            </span>
            <span className="font-extrabold text-[#465FFF] dark:text-sky-400 text-xs sm:text-sm mt-0.5 block">
              ₱{netEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. SALES OVERVIEW (Chart Visualization)
      ───────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-4.5 rounded-xl bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#101828] dark:text-white">
            SALES OVERVIEW
          </h2>
          {netEarnings > 0 && (
            <span className="text-[11px] font-bold text-[#465FFF] dark:text-sky-400">
              ₱{netEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {netEarnings === 0 || filteredOrders.length === 0 ? (
          <div className="py-8 text-center text-xs">
            <p className="font-bold text-[#101828] dark:text-slate-200">
              No sales data for this period
            </p>
            <p className="text-[#64748B] dark:text-slate-400 mt-1">
              Sales will appear here when orders are completed.
            </p>
          </div>
        ) : (
          <div className="w-full pt-2">
            <svg viewBox="0 0 500 130" className="w-full h-36 sm:h-44 overflow-visible">
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#465FFF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#465FFF" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="35" y1="20" x2="475" y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-slate-100 dark:text-slate-700/60" />
              <line x1="35" y1="62.5" x2="475" y2="62.5" stroke="currentColor" strokeDasharray="3 3" className="text-slate-100 dark:text-slate-700/60" />
              <line x1="35" y1="105" x2="475" y2="105" stroke="currentColor" strokeDasharray="3 3" className="text-slate-100 dark:text-slate-700/60" />

              {/* Area Fill */}
              <path d={chartAreaPath} fill="url(#salesGradient)" />

              {/* Line */}
              <path d={chartLinePath} fill="none" stroke="#465FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Data Points and Labels */}
              {chartPoints.map((pt, idx) => (
                <g key={idx}>
                  <circle cx={pt.x} cy={pt.y} r="3.5" fill="#465FFF" stroke="white" strokeWidth="2" className="drop-shadow-2xs" />
                  {pt.value > 0 && (
                    <text x={pt.x} y={pt.y - 7} textAnchor="middle" className="text-[9px] font-bold fill-[#101828] dark:fill-slate-100">
                      ₱{pt.value >= 1000 ? `${(pt.value / 1000).toFixed(1)}k` : pt.value}
                    </text>
                  )}
                  <text x={pt.x} y="122" textAnchor="middle" className="text-[9px] font-bold fill-[#64748B] dark:fill-slate-400">
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. RECENT TRANSACTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 shadow-2xs">
        {/* Section Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-[#E2E8F0] dark:border-slate-700/80">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#101828] dark:text-white">
            RECENT TRANSACTIONS
          </h2>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search order, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-900 text-xs text-[#101828] dark:text-white outline-none focus:border-[#465FFF] transition-colors"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          /* Compact Empty State */
          <div className="py-6 text-center text-xs">
            <p className="font-bold text-[#101828] dark:text-slate-200">
              No completed transactions for this period.
            </p>
            <p className="text-[#64748B] dark:text-slate-400 mt-1">
              Completed orders will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] dark:border-slate-700 text-[#64748B] dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]/60 dark:divide-slate-700/60 font-medium">
                  {filteredOrders.map((order) => {
                    const code = order.claimCode || (order._id ? `PD-${order._id.slice(-4).toUpperCase()}` : 'PD-XXXX');
                    const displayCode = code.startsWith('#') ? code : `#${code}`;
                    const dateFull = formatFullDate(order.completedAt || order.updatedAt || order.submittedAt || order.createdAt);
                    const service = getServiceDescription(order);
                    const amount = `₱${Number(order.estimatedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    const customerName = order.customerId?.name || order.customerName || 'Customer';

                    return (
                      <tr
                        key={order._id}
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-[#F9FAFB]/80 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                        title="Click to view transaction details"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-[#465FFF] dark:text-sky-400 whitespace-nowrap">
                          {displayCode}
                        </td>
                        <td className="py-3 px-3 font-bold text-[#101828] dark:text-white whitespace-nowrap">
                          {customerName}
                        </td>
                        <td className="py-3 px-3 text-[#64748B] dark:text-slate-300">
                          {service}
                        </td>
                        <td className="py-3 px-3 text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                          {dateFull}
                        </td>
                        <td className="py-3 px-3 font-bold text-[#101828] dark:text-white text-right whitespace-nowrap">
                          {amount}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            Paid
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Transaction Cards (< 768px) */}
            <div className="block md:hidden space-y-2.5">
              {filteredOrders.map((order) => {
                const code = order.claimCode || (order._id ? `PD-${order._id.slice(-4).toUpperCase()}` : 'PD-XXXX');
                const displayCode = code.startsWith('#') ? code : `#${code}`;
                const dateFull = formatFullDate(order.completedAt || order.updatedAt || order.submittedAt || order.createdAt);
                const service = getServiceDescription(order);
                const amount = `₱${Number(order.estimatedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const customerName = order.customerId?.name || order.customerName || 'Customer';

                return (
                  <div
                    key={order._id}
                    onClick={() => setSelectedOrder(order)}
                    className="p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-[#F9FAFB]/60 dark:bg-slate-700/30 hover:border-[#465FFF] transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-[#465FFF] dark:text-sky-400">
                        {displayCode}
                      </span>
                      <span className="font-black text-sm text-[#101828] dark:text-white">
                        {amount}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-[#101828] dark:text-white mt-1 truncate">
                      {customerName}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                      {service}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E2E8F0]/60 dark:border-slate-700/60 text-[11px]">
                      <span className="text-[#64748B] dark:text-slate-400">
                        {dateFull}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        Paid
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: TRANSACTION DETAIL INSPECTION
      ───────────────────────────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-slate-700 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-[#F9FAFB] dark:bg-slate-700/60 border-b border-[#E2E8F0] dark:border-slate-600 flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#101828] dark:text-white text-sm">
                  Transaction Details
                </h3>
                <span className="font-mono font-bold text-xs text-[#465FFF] dark:text-sky-400">
                  {selectedOrder.claimCode?.startsWith('#') ? selectedOrder.claimCode : `#${selectedOrder.claimCode || (selectedOrder._id ? `PD-${selectedOrder._id.slice(-4).toUpperCase()}` : 'PD-XXXX')}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-[#64748B] hover:text-[#101828] dark:hover:text-white cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] dark:bg-slate-700/40 border border-[#E2E8F0] dark:border-slate-600">
                <span className="text-[#64748B] dark:text-slate-400 font-semibold">Total Amount:</span>
                <span className="font-black text-base text-[#465FFF] dark:text-sky-400">
                  ₱{Number(selectedOrder.estimatedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]/60 dark:border-slate-700">
                  <span className="text-[#64748B] dark:text-slate-400">Customer:</span>
                  <span className="font-bold text-[#101828] dark:text-white">
                    {selectedOrder.customerId?.name || selectedOrder.customerName || 'Customer'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]/60 dark:border-slate-700">
                  <span className="text-[#64748B] dark:text-slate-400">Service:</span>
                  <span className="font-bold text-[#101828] dark:text-white">
                    {getServiceDescription(selectedOrder)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]/60 dark:border-slate-700">
                  <span className="text-[#64748B] dark:text-slate-400">Document:</span>
                  <span className="font-bold text-[#101828] dark:text-white truncate max-w-[200px]">
                    {selectedOrder.documentId?.originalFilename || selectedOrder.originalFilename || 'Document.pdf'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]/60 dark:border-slate-700">
                  <span className="text-[#64748B] dark:text-slate-400">Pages &amp; Copies:</span>
                  <span className="font-bold text-[#101828] dark:text-white">
                    {selectedOrder.printingSpecifications?.totalPages || 1} pages × {selectedOrder.printingSpecifications?.copies || 1}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]/60 dark:border-slate-700">
                  <span className="text-[#64748B] dark:text-slate-400">Date Completed:</span>
                  <span className="font-bold text-[#101828] dark:text-white">
                    {formatFullDate(selectedOrder.completedAt || selectedOrder.updatedAt)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]/60 dark:border-slate-700">
                  <span className="text-[#64748B] dark:text-slate-400">Payment:</span>
                  <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400">
                    {selectedOrder.paymentMethod === 'maya' ? 'Maya (Verified)' : 'GCash (Verified)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-[#F9FAFB] dark:bg-slate-700/60 border-t border-[#E2E8F0] dark:border-slate-600 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-[#E2E8F0] dark:border-slate-600 font-bold text-[#101828] dark:text-white text-xs cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardContainer>
  );
}
