import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, DollarSign, ShoppingBag, Store, Users,
  RefreshCw, CheckCircle2, Clock, AlertTriangle, XCircle,
  CreditCard, Wallet, ArrowUpRight, Award, ShieldCheck, MapPin,
  Calendar, LayoutGrid, List, Percent, Download, Printer,
  FileSpreadsheet, BarChart3, Layers, FileText
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const NAVY = '#101828';
const ACCENT = '#465FFF';
const GRAY = '#64748B';

export default function ReportsPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month'); // 'today' | 'week' | 'month' | 'all'
  const [chartMetric, setChartMetric] = useState('revenue'); // 'revenue' | 'commission' | 'orders'
  const [hoveredPointIdx, setHoveredPointIdx] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('printdayon_admin_reports_view') || 'grid';
    } catch (_) {
      return 'grid';
    }
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('printdayon_admin_reports_view', mode);
    } catch (_) {}
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getReports({ timeRange });
      if (res?.data?.success) {
        setReports(res.data.data);
      } else if (res?.data) {
        setReports(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to generate analytics report.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const financials = reports?.financials || { totalVolume: 0, completedVolume: 0, platformRevenue: 0, netShopPayout: 0, avgOrderValue: 0 };
  const platformRevenue = financials.platformRevenue ?? Number(((financials.completedVolume || 0) * 0.03).toFixed(2));
  const completedVolume = financials.completedVolume || 0;
  const netShopPayout = financials.netShopPayout ?? Number(((financials.completedVolume || 0) * 0.97).toFixed(2));
  const orders = reports?.orders || { total: 0, completed: 0, in_progress: 0, pending: 0, cancelled: 0, fulfillmentRate: 0 };
  const systemUsers = reports?.users || { total: 0, customers: 0, shopOwners: 0, admins: 0 };
  const shopsBreakdown = reports?.shopsBreakdown || [];
  const payments = reports?.payments || { gcash: { count: 0, total: 0 }, maya: { count: 0, total: 0 } };
  const timeline = reports?.timeline || [];
  const serviceDemand = reports?.serviceDemand || {
    colorMode: { black_and_white: 0, color: 0 },
    paperSize: { A4: 0, Legal: 0, Letter: 0 },
    rushOrders: 0,
  };

  // CSV Audit Export
  const handleExportCSV = () => {
    if (!reports) return;
    const rows = [
      ['PrintDayon Municipal Printing Marketplace - Operational Audit Report'],
      ['Generated On', new Date().toLocaleString('en-PH')],
      ['Time Range Filter', timeRange.toUpperCase()],
      [],
      ['1. EXECUTIVE FINANCIAL SUMMARY'],
      ['Gross Merchandise Value (GMV)', `PHP ${(completedVolume || 0).toFixed(2)}`],
      ['Platform Commission (3%)', `PHP ${(platformRevenue || 0).toFixed(2)}`],
      ['Partner Shop Net Payout (97%)', `PHP ${(netShopPayout || 0).toFixed(2)}`],
      ['Average Order Value (AOV)', `PHP ${(financials.avgOrderValue || 0).toFixed(2)}`],
      ['Total Orders Processed', orders.total || 0],
      ['Completed Orders', orders.completed || 0],
      ['Fulfillment Rate', `${orders.fulfillmentRate || 0}%`],
      [],
      ['2. PARTNER SHOPS PERFORMANCE BREAKDOWN'],
      ['Shop Name', 'Owner', 'Total Orders', 'Completed Orders', 'Gross Sales (PHP)', 'Platform Fee 3% (PHP)', 'Net Earnings 97% (PHP)', 'Fulfillment Rate', 'Market Share %'],
      ...shopsBreakdown.map(s => {
        const share = completedVolume > 0 ? Math.round(((s.grossSales || 0) / completedVolume) * 100) : 0;
        return [
          `"${(s.shopName || '').replace(/"/g, '""')}"`,
          `"${(s.ownerName || '').replace(/"/g, '""')}"`,
          s.totalOrders || 0,
          s.completedOrders || 0,
          (s.grossSales || 0).toFixed(2),
          (s.platformCommission || 0).toFixed(2),
          (s.netEarnings || 0).toFixed(2),
          `${s.fulfillmentRate || 0}%`,
          `${share}%`,
        ];
      }),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PrintDayon_Audit_Report_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit report CSV downloaded.');
  };

  // Process timeline data points for responsive SVG
  const chartPoints = useMemo(() => {
    if (timeline && timeline.length >= 2) {
      return timeline;
    }
    if (timeline && timeline.length === 1) {
      const p = timeline[0];
      return [
        { label: 'Prior Period', grossSales: 0, platformCommission: 0, totalOrders: 0, completedOrders: 0 },
        p,
      ];
    }
    if (timeRange === 'week') {
      const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'];
      return days.map((d, i) => ({
        label: d,
        grossSales: i === 6 ? completedVolume : 0,
        platformCommission: i === 6 ? platformRevenue : 0,
        totalOrders: i === 6 ? orders.total : 0,
        completedOrders: i === 6 ? orders.completed : 0,
      }));
    }
    return [
      { label: 'Prior', grossSales: 0, platformCommission: 0, totalOrders: 0, completedOrders: 0 },
      { label: 'Current Period', grossSales: completedVolume, platformCommission: platformRevenue, totalOrders: orders.total, completedOrders: orders.completed },
    ];
  }, [timeline, completedVolume, platformRevenue, orders.total, orders.completed, timeRange]);

  const maxChartValue = useMemo(() => {
    const vals = chartPoints.map(p => {
      if (chartMetric === 'commission') return (p.platformCommission || 0);
      if (chartMetric === 'revenue') return (p.grossSales || 0);
      return (p.totalOrders || 0);
    });
    const highest = Math.max(...vals, 0);
    if (chartMetric === 'commission') return highest > 0 ? Number((highest * 1.35).toFixed(2)) : 1;
    if (chartMetric === 'revenue') return highest > 0 ? highest * 1.25 : 20;
    return highest > 0 ? highest + 2 : 5;
  }, [chartPoints, chartMetric]);

  // SVG Chart Dimensions
  const svgWidth = 760;
  const svgHeight = 210;
  const padX = 40;
  const padTop = 30;
  const padBottom = 35;
  const plotWidth = svgWidth - padX * 2;
  const plotHeight = svgHeight - padTop - padBottom;

  const chartCoords = useMemo(() => {
    return chartPoints.map((p, i) => {
      const x = padX + (i / Math.max(chartPoints.length - 1, 1)) * plotWidth;
      let val = p.grossSales || 0;
      if (chartMetric === 'commission') val = p.platformCommission || 0;
      else if (chartMetric === 'orders') val = p.totalOrders || 0;
      const y = padTop + plotHeight - ((val / (maxChartValue || 1)) * plotHeight);
      return { x, y, point: p, val };
    });
  }, [chartPoints, chartMetric, maxChartValue, plotWidth, plotHeight, padX, padTop]);

  const linePath = useMemo(() => {
    return chartCoords.reduce((acc, c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`), '');
  }, [chartCoords]);

  const areaPath = useMemo(() => {
    if (chartCoords.length === 0) return '';
    const first = chartCoords[0];
    const last = chartCoords[chartCoords.length - 1];
    return `${linePath} L ${last.x} ${padTop + plotHeight} L ${first.x} ${padTop + plotHeight} Z`;
  }, [linePath, chartCoords, padTop, plotHeight]);

  // Demand calculations
  const totalBw = serviceDemand?.colorMode?.black_and_white || 0;
  const totalColor = serviceDemand?.colorMode?.color || 0;
  const totalColorSum = totalBw + totalColor || 1;
  const bwPct = Math.round((totalBw / totalColorSum) * 100);
  const colorPct = 100 - bwPct;

  const a4Count = serviceDemand?.paperSize?.A4 || 0;
  const legalCount = serviceDemand?.paperSize?.Legal || 0;
  const letterCount = serviceDemand?.paperSize?.Letter || 0;
  const totalPaperSum = a4Count + legalCount + letterCount || 1;

  return (
    <div className="w-full flex flex-col gap-5 pb-12">
      {/* Top Filter Bar: Time Range Filter (Left) + Export Audit Tools (Right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            padding: '3px',
            borderRadius: '0.625rem',
            gap: '2px',
          }}
        >
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: '7 Days' },
            { id: 'month', label: '30 Days' },
            { id: 'all', label: 'All Time' },
          ].map(r => {
            const active = timeRange === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setTimeRange(r.id)}
                style={{
                  padding: '0.4rem 0.875rem',
                  borderRadius: '0.45rem',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  background: active ? '#101828' : 'transparent',
                  color: active ? '#FFFFFF' : '#475569',
                  boxShadow: active ? '0 1px 3px rgba(0, 27, 60, 0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Audit & Report Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: NAVY,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 27, 60, 0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={14} color={NAVY} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: NAVY,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 27, 60, 0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <Printer size={14} color={NAVY} /> Print Report
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: GRAY }}>
          <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 1rem', color: ACCENT }} />
          <p style={{ fontWeight: 600, color: NAVY }}>Calculating system aggregations from database records...</p>
        </div>
      ) : (
        <>
          {/* Asymmetric Executive Dashboard: Marketplace Revenue Engine (7 cols) + Operations Pulse (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Panel: Sales & Revenue */}
            <div
              className="lg:col-span-7 flex flex-col justify-between"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 27, 60, 0.04)',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                    Sales & Revenue
                  </h3>
                </div>

                {/* Hero Metric: Gross Sales (GMV) */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Gross Sales (GMV)
                  </div>
                  <div style={{ fontSize: '2.25rem', fontWeight: 800, color: NAVY, letterSpacing: '-0.03em', lineHeight: 1.15, marginTop: '0.25rem' }}>
                    ₱{completedVolume.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: GRAY, marginTop: '0.25rem', fontWeight: 500 }}>
                    Total completed customer orders processed across Naval partner print shops
                  </div>
                </div>

                {/* Split Breakdown Sub-Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {/* Sub-card 1: Platform Revenue (3%) */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.75rem', padding: '0.875rem 1rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Platform Revenue (3%)
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: NAVY, marginTop: '0.25rem' }}>
                      ₱{platformRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: GRAY, marginTop: '0.15rem' }}>
                      Marketplace Commission Share
                    </div>
                  </div>

                  {/* Sub-card 2: Shop Net Disbursal (97%) */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.75rem', padding: '0.875rem 1rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Shop Net Earnings (97%)
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: NAVY, marginTop: '0.25rem' }}>
                      ₱{netShopPayout.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: GRAY, marginTop: '0.15rem' }}>
                      Merchant Disbursal to Print Shops
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Distribution Split Bar */}
              <div>
                <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: completedVolume > 0 ? '97%' : '0%', height: '100%', background: NAVY, transition: 'width 0.4s ease' }} title="Shop Disbursal (97%)" />
                  <div style={{ width: completedVolume > 0 ? '3%' : '0%', height: '100%', background: ACCENT, transition: 'width 0.4s ease' }} title="Platform Commission (3%)" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.72rem', color: GRAY, fontWeight: 600, flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: NAVY }} /> 97% Shop Earnings (₱{netShopPayout.toFixed(2)})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ACCENT }} /> 3% Platform Fee (₱{platformRevenue.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>

            {/* Right Panel: Order Summary */}
            <div
              className="lg:col-span-5 flex flex-col justify-between"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 27, 60, 0.04)',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                    Order Summary
                  </h3>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: NAVY, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
                    {orders.fulfillmentRate || 0}% Fulfilled
                  </span>
                </div>

                {/* Hero Metric: Total Orders */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Orders Processed
                  </div>
                  <div style={{ fontSize: '2.25rem', fontWeight: 800, color: NAVY, letterSpacing: '-0.03em', lineHeight: 1.15, marginTop: '0.25rem' }}>
                    {(orders.total || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: GRAY, marginTop: '0.25rem', fontWeight: 500 }}>
                    {orders.completed || 0} completed • {orders.in_progress || 0} in progress • {orders.cancelled || 0} cancelled
                  </div>
                </div>

                {/* Operational Highlights */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>
                        Average Order Value (AOV)
                      </div>
                      <div style={{ fontSize: '0.7rem', color: GRAY, marginTop: '1px' }}>
                        Per transaction
                      </div>
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: NAVY }}>
                      ₱{(financials.avgOrderValue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>
                        Partner Print Shops
                      </div>
                      <div style={{ fontSize: '0.7rem', color: GRAY, marginTop: '1px' }}>
                        Active in Naval, Biliran
                      </div>
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: NAVY }}>
                      {shopsBreakdown.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Note */}
              <div style={{ marginTop: '1.25rem', padding: '0.625rem 0.85rem', borderRadius: '0.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: GRAY, fontWeight: 500 }}>Fulfillment Success:</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: NAVY }}>{orders.fulfillmentRate || 0}% Completed</span>
              </div>
            </div>
          </div>

          {/* Interactive Performance Trend Chart (SVG) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '1rem',
              padding: '1.35rem 1.5rem',
              boxShadow: '0 1px 3px rgba(0, 27, 60, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={16} color={NAVY} /> Performance Trend
                </h3>
                <div style={{ fontSize: '0.72rem', color: GRAY, marginTop: '2px' }}>
                  {chartMetric === 'revenue'
                    ? 'Total customer payment volume (Gross Merchandise Value)'
                    : chartMetric === 'commission'
                    ? 'Admin 3% marketplace commission revenue share'
                    : 'Order volume and completed printing throughput'}
                </div>
              </div>

              {/* Chart Metric Toggle */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  padding: '2px',
                  borderRadius: '0.5rem',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setChartMetric('revenue')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.72rem',
                    fontWeight: chartMetric === 'revenue' ? 700 : 500,
                    background: chartMetric === 'revenue' ? '#101828' : 'transparent',
                    color: chartMetric === 'revenue' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Gross Sales (₱)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('commission')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.72rem',
                    fontWeight: chartMetric === 'commission' ? 700 : 500,
                    background: chartMetric === 'commission' ? '#101828' : 'transparent',
                    color: chartMetric === 'commission' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Commission 3% (₱)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('orders')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.72rem',
                    fontWeight: chartMetric === 'orders' ? 700 : 500,
                    background: chartMetric === 'orders' ? '#101828' : 'transparent',
                    color: chartMetric === 'orders' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Orders (Count)
                </button>
              </div>
            </div>

            {/* Responsive SVG Area & Line Chart */}
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ width: '100%', height: 'auto', minWidth: '460px', display: 'block' }}
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#101828" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#101828" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Horizontal Baseline Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y = padTop + plotHeight - pct * plotHeight;
                  const val = pct * maxChartValue;
                  let formattedVal = Math.round(val);
                  if (chartMetric === 'revenue') {
                    formattedVal = `₱${Math.round(val)}`;
                  } else if (chartMetric === 'commission') {
                    formattedVal = `₱${val < 1 ? val.toFixed(2) : val.toFixed(1)}`;
                  }
                  return (
                    <g key={i}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={padX + plotWidth}
                        y2={y}
                        stroke="#F1F5F9"
                        strokeDasharray={pct === 0 ? 'none' : '4 4'}
                        strokeWidth="1"
                      />
                      <text
                        x={padX - 8}
                        y={y + 3}
                        fontSize="10"
                        fill="#94A3B8"
                        textAnchor="end"
                        fontWeight="500"
                      >
                        {formattedVal}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area */}
                {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}

                {/* Line Path */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={NAVY}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Points and Labels */}
                {chartCoords.map((c, i) => {
                  const isHovered = hoveredPointIdx === i;
                  return (
                    <g key={i}>
                      {/* Vertical Hairline on Hover */}
                      {isHovered && (
                        <line
                          x1={c.x}
                          y1={padTop}
                          x2={c.x}
                          y2={padTop + plotHeight}
                          stroke="#CBD5E1"
                          strokeDasharray="2 2"
                          strokeWidth="1"
                        />
                      )}

                      {/* Dot */}
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={isHovered ? 6 : 4}
                        fill={isHovered ? NAVY : '#FFFFFF'}
                        stroke={NAVY}
                        strokeWidth={isHovered ? 2.5 : 2}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={() => setHoveredPointIdx(i)}
                        onMouseLeave={() => setHoveredPointIdx(null)}
                      />

                      {/* X-axis Label */}
                      <text
                        x={c.x}
                        y={padTop + plotHeight + 18}
                        fontSize="10"
                        fill={isHovered ? NAVY : '#64748B'}
                        fontWeight={isHovered ? 700 : 500}
                        textAnchor="middle"
                      >
                        {c.point.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Floating Tooltip Box */}
              {hoveredPointIdx !== null && chartCoords[hoveredPointIdx] && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${(chartCoords[hoveredPointIdx].x / svgWidth) * 100}%`,
                    top: `${(chartCoords[hoveredPointIdx].y / svgHeight) * 100 - 28}%`,
                    transform: 'translate(-50%, -100%)',
                    background: '#101828',
                    color: '#FFFFFF',
                    borderRadius: '0.5rem',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0, 27, 60, 0.25)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.68rem', color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '2px', marginBottom: '4px' }}>
                    {chartCoords[hoveredPointIdx].point.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>Gross Sales: <strong>₱{(chartCoords[hoveredPointIdx].point.grossSales || 0).toFixed(2)}</strong></div>
                    <div style={{ color: '#93C5FD' }}>3% Commission: <strong>₱{(chartCoords[hoveredPointIdx].point.platformCommission || 0).toFixed(2)}</strong></div>
                    <div style={{ color: '#CBD5E1', fontSize: '0.68rem' }}>97% Shop Payout: ₱{((chartCoords[hoveredPointIdx].point.grossSales || 0) * 0.97).toFixed(2)}</div>
                    <div style={{ color: '#86EFAC', fontSize: '0.68rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2px', marginTop: '2px' }}>
                      Orders: {chartCoords[hoveredPointIdx].point.totalOrders || 0} ({chartCoords[hoveredPointIdx].point.completedOrders || 0} completed)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Tier: 3-Column Balanced Grid (Order Status + Printing Demand + Payment Channels) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {/* Card 1: Order Status */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #E2E8F0', padding: '1.35rem 1.5rem', boxShadow: '0 1px 3px rgba(0, 27, 60, 0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                    Order Status
                  </h3>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: ACCENT, background: '#EEF2FC', padding: '0.25rem 0.65rem', borderRadius: '0.45rem' }}>
                    {orders.total || 0} Total
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { label: 'Completed', count: orders.completed, color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle2 size={15} color="#10B981" /> },
                    { label: 'In Progress', count: orders.in_progress, color: ACCENT, bg: '#EEF2FC', icon: <Clock size={15} color={ACCENT} /> },
                    { label: 'Pending', count: orders.pending, color: '#F59E0B', bg: '#FEF7E8', icon: <AlertTriangle size={15} color="#F59E0B" /> },
                    { label: 'Cancelled', count: orders.cancelled, color: '#64748B', bg: '#F1F5F9', icon: <XCircle size={15} color="#64748B" /> },
                  ].map((item, i) => {
                    const pct = orders.total > 0 ? Math.round((item.count / orders.total) * 100) : 0;
                    return (
                      <div key={i} style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '0.625rem', padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 600, color: NAVY, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            {item.icon} {item.label}
                          </span>
                          <span style={{ fontWeight: 700, color: item.color }}>
                            {item.count} <span style={{ fontSize: '0.72rem', color: GRAY, fontWeight: 600 }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 2: Printing Service Demand Analysis */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #E2E8F0', padding: '1.35rem 1.5rem', boxShadow: '0 1px 3px rgba(0, 27, 60, 0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                    Printing Demand
                  </h3>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: NAVY, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.25rem 0.65rem', borderRadius: '0.45rem' }}>
                    {serviceDemand?.rushOrders || 0} Rush Jobs
                  </div>
                </div>

                {/* Color Mode Split */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, color: NAVY }}>Color Mode</span>
                    <span style={{ color: GRAY, fontSize: '0.72rem' }}>
                      B&amp;W {bwPct}% • Color {colorPct}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${bwPct}%`, height: '100%', background: NAVY }} title={`B&W: ${totalBw}`} />
                    <div style={{ width: `${colorPct}%`, height: '100%', background: ACCENT }} title={`Color: ${totalColor}`} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: GRAY, marginTop: '0.35rem' }}>
                    <span>● Monochrome: {totalBw} orders</span>
                    <span>● Full Color: {totalColor} orders</span>
                  </div>
                </div>

                {/* Paper Size Distribution */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: NAVY }}>Paper Size Demand</div>
                  {[
                    { label: 'A4 Standard', count: a4Count, pct: Math.round((a4Count / totalPaperSum) * 100) },
                    { label: 'Legal (Long)', count: legalCount, pct: Math.round((legalCount / totalPaperSum) * 100) },
                    { label: 'Letter (Short)', count: letterCount, pct: Math.round((letterCount / totalPaperSum) * 100) },
                  ].map((p, pIdx) => (
                    <div key={pIdx} style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '0.5rem', padding: '0.45rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 600, color: NAVY }}>{p.label}</span>
                      <span style={{ color: GRAY, fontWeight: 700 }}>
                        {p.count} <span style={{ fontSize: '0.68rem', fontWeight: 500 }}>({p.pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Demand Footer */}
              <div style={{ marginTop: '0.875rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.72rem', color: GRAY }}>
                Popular formats in Naval: <strong>Academic Handouts &amp; Research Theses</strong>
              </div>
            </div>

            {/* Card 3: Payment Channels & Settlement */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #E2E8F0', padding: '1.35rem 1.5rem', boxShadow: '0 1px 3px rgba(0, 27, 60, 0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                    Payment Channels
                  </h3>
                  <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', background: '#F8FAFC', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={16} />
                  </div>
                </div>

                {/* Average Order Value Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.75rem', padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Average Order Value (AOV)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: GRAY, marginTop: '2px' }}>
                      Per completed transaction
                    </div>
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: NAVY }}>
                    ₱{(financials.avgOrderValue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Payment Breakdown Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* GCash Payment Channel */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderRadius: '0.625rem', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '0.5rem', background: '#EEF2FC', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: NAVY }}>GCash Payment</div>
                        <div style={{ fontSize: '0.68rem', color: GRAY, fontWeight: 500 }}>Verified Advance Payment Reference</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: NAVY }}>
                        ₱{(payments.gcash?.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: GRAY, fontWeight: 500 }}>{payments.gcash?.count || 0} orders</div>
                    </div>
                  </div>

                  {/* Maya Payment Channel */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderRadius: '0.625rem', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '0.5rem', background: '#EEF2FC', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: NAVY }}>Maya Payment</div>
                        <div style={{ fontSize: '0.68rem', color: GRAY, fontWeight: 500 }}>Digital Online Gateway</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: NAVY }}>
                        ₱{(payments.maya?.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: GRAY, fontWeight: 500 }}>{payments.maya?.count || 0} orders</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Policy Guarantee Footer */}
              <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.85rem', borderRadius: '0.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={16} color={NAVY} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', color: GRAY, fontWeight: 500, lineHeight: 1.3 }}>
                  Advance digital payment policy eliminates abandoned prints and safeguards shop revenue.
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section: Partner Shops Performance */}
          <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(6,63,92,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: NAVY, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Store size={18} color={ACCENT} /> Partner Shops Performance
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.3rem 0.65rem', borderRadius: '0.5rem' }}>
                  {shopsBreakdown.length} Partner Shops
                </div>

                {/* View Mode Toggle: Grid & Table */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#F1F5F9',
                    border: '1px solid #E2E8F0',
                    borderRadius: '0.625rem',
                    padding: '2px',
                    gap: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('grid')}
                    title="Grid View"
                    aria-label="Grid View"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                      color: viewMode === 'grid' ? NAVY : GRAY,
                      boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('table')}
                    title="Table View"
                    aria-label="Table View"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                      color: viewMode === 'table' ? NAVY : GRAY,
                      boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {shopsBreakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: GRAY }}>
                <Store size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>No partner shops found in the Naval database.</p>
              </div>
            ) : viewMode === 'table' ? (
              <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shop &amp; Location</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Partner Owner</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Fulfilled</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Gross Sales</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Market Share</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Comm. (3%)</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Shop Net</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopsBreakdown.map((shop, sIdx) => {
                      const isVerified = shop.verificationStatus === 'verified';
                      const gross = shop.grossSales ?? shop.totalRevenue ?? 0;
                      const comm = shop.platformCommission ?? Number((gross * 0.03).toFixed(2));
                      const net = shop.netEarnings ?? Number((gross * 0.97).toFixed(2));
                      const share = completedVolume > 0 ? Math.round((gross / completedVolume) * 100) : 0;
                      return (
                        <tr
                          key={shop.shopId || sIdx}
                          style={{
                            borderBottom: sIdx === shopsBreakdown.length - 1 ? 'none' : '1px solid #F1F5F9',
                            background: sIdx % 2 === 0 ? '#FFFFFF' : '#FAFCFE',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = sIdx % 2 === 0 ? '#FFFFFF' : '#FAFCFE')}
                        >
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '0.5rem',
                                background: '#101828',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                flexShrink: 0
                              }}>
                                {(shop.shopName || 'P')[0]}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: NAVY }}>{shop.shopName}</div>
                                <div style={{ fontSize: '0.72rem', color: GRAY, display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '1px' }}>
                                  <MapPin size={11} /> {shop.address || 'Naval, Biliran'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: NAVY, fontWeight: 600 }}>
                            {shop.ownerName || 'Partner'}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '999px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: isVerified ? '#ECFDF5' : '#FEF7E8',
                              color: isVerified ? '#047857' : '#B45309',
                              border: isVerified ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                              whiteSpace: 'nowrap',
                            }}>
                              {isVerified && <ShieldCheck size={11} />}
                              {isVerified ? 'Verified' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, color: NAVY }}>
                            {shop.completedOrders || 0}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: NAVY }}>
                            ₱{gross.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: NAVY, background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '0.2rem 0.5rem', borderRadius: '0.375rem' }}>
                              {share}%
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: '#D97706' }}>
                            ₱{comm.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                            ₱{net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: shop.fulfillmentRate >= 80 ? '#047857' : NAVY }}>
                            {shop.fulfillmentRate || 0}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
                {shopsBreakdown.map((shop, sIdx) => {
                  const isVerified = shop.verificationStatus === 'verified';
                  const gross = shop.grossSales ?? shop.totalRevenue ?? 0;
                  const comm = shop.platformCommission ?? Number(((shop.totalRevenue || 0) * 0.03).toFixed(2));
                  const net = shop.netEarnings ?? Number(((shop.totalRevenue || 0) * 0.97).toFixed(2));
                  const share = completedVolume > 0 ? Math.round((gross / completedVolume) * 100) : 0;
                  return (
                    <div
                      key={shop.shopId || sIdx}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '0.875rem',
                        padding: '1.125rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.875rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '0.625rem',
                            background: '#101828',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            flexShrink: 0
                          }}>
                            {(shop.shopName || 'P')[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: NAVY }}>
                              {shop.shopName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: GRAY, display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '1px' }}>
                              <MapPin size={11} /> {shop.address || 'Naval, Biliran'}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: isVerified ? '#ECFDF5' : '#FEF7E8',
                          color: isVerified ? '#047857' : '#B45309',
                          border: isVerified ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {isVerified ? <ShieldCheck size={11} /> : null}
                          {isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>

                      {/* Performance Numbers */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', background: '#F8FAFC', borderRadius: '0.625rem', padding: '0.625rem', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.62rem', color: GRAY, textTransform: 'uppercase', fontWeight: 600 }}>Fulfilled</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#047857', marginTop: '1px' }}>
                            {shop.completedOrders || 0}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.62rem', color: GRAY, textTransform: 'uppercase', fontWeight: 600 }}>Gross Sales</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: NAVY, marginTop: '2px' }}>
                            ₱{gross.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.62rem', color: '#D97706', textTransform: 'uppercase', fontWeight: 600 }}>Comm. (3%)</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                            ₱{comm.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.62rem', color: '#047857', textTransform: 'uppercase', fontWeight: 700 }}>Shop Net</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                            ₱{net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Market Share Progress Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: GRAY, marginBottom: '0.25rem' }}>
                          <span>Market Share:</span>
                          <span style={{ fontWeight: 700, color: NAVY }}>{share}%</span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${share}%`, height: '100%', background: NAVY, borderRadius: '999px' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: GRAY, paddingTop: '0.25rem' }}>
                        <span>Partner: <strong style={{ color: NAVY }}>{shop.ownerName}</strong></span>
                        <span>Success: <strong style={{ color: shop.fulfillmentRate >= 80 ? '#047857' : NAVY }}>{shop.fulfillmentRate || 0}%</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
