import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, ChevronRight, Star, RefreshCw, Eye, Store, Calendar, CreditCard } from 'lucide-react';
import { requestAPI } from '../../services/api';
import RatingReviewModal from '../../components/orders/RatingReviewModal';

export default function HistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ratingModalOrder, setRatingModalOrder] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await requestAPI.getMyRequests({ limit: 100 });
      setRequests(res.data?.requests || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filtered = requests.filter((req) => {
    const trackingNo = (req.trackingNumber || req._id.slice(-6)).toLowerCase();
    const shopName = (req.shopId?.shopName || '').toLowerCase();
    const fileName = (req.fileName || req.documentId?.originalFilename || '').toLowerCase();
    const q = search.toLowerCase();

    const matchSearch = trackingNo.includes(q) || shopName.includes(q) || fileName.includes(q);
    const matchStatus = statusFilter === 'all' || req.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalSpent = requests
    .filter((r) => r.status === 'completed')
    .reduce((acc, curr) => acc + (curr.estimatedCost || 0), 0);

  const getBadgeClass = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400 border border-success-200 dark:border-success-500/20';
      case 'printing':
        return 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 border border-brand-200 dark:border-brand-500/20';
      case 'ready':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300 border border-teal-200 dark:border-teal-500/20';
      case 'cancelled':
      case 'rejected':
        return 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400 border border-error-200 dark:border-error-500/20';
      default:
        return 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400 border border-warning-200 dark:border-warning-500/20';
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-10 fade-in">
      
      {/* Top Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white m-0 tracking-tight">
            Order History &amp; Reviews
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 m-0 mt-0.5">
            Review all your past printing requests, claim codes, and ratings.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center gap-1.5 shadow-theme-xs cursor-pointer transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by order ID, shop name, or document..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2 pl-9 pr-3.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs sm:text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-brand-500 transition-colors shadow-theme-xs"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {['all', 'completed', 'ready', 'printing', 'cancelled', 'rejected'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-brand-500 text-white shadow-theme-xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-theme-xs overflow-hidden">
        
        {/* Table Column Headers (Desktop) */}
        <div className="hidden md:grid grid-cols-12 px-5 py-3.5 bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span className="col-span-2">Order / Claim</span>
          <span className="col-span-3">Shop</span>
          <span className="col-span-3">Document</span>
          <span className="col-span-1">Amount</span>
          <span className="col-span-1">Status</span>
          <span className="col-span-2 text-right">Action / Rating</span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Loading your order history...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileText size={40} className="text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm m-0">No orders found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 m-0">Try adjusting your search query or placing a new print request.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((order) => (
              <React.Fragment key={order._id}>
                {/* Desktop Row */}
                <div className="hidden md:grid grid-cols-12 px-5 py-3.5 items-center hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                  <div className="col-span-2 min-w-0 pr-2">
                    <Link
                      to={`/my-requests/${order._id}`}
                      className="font-bold text-xs text-brand-500 dark:text-brand-400 hover:underline block truncate"
                    >
                      #{order.trackingNumber || order._id.slice(-6).toUpperCase()}
                    </Link>
                    {order.claimCode && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        Code: {order.claimCode}
                      </div>
                    )}
                  </div>

                  <div className="col-span-3 min-w-0 pr-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                      {order.shopId?.shopName || 'Printing Shop'}
                    </span>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {order.shopId?.address || 'Naval, Biliran'}
                    </div>
                  </div>

                  <div className="col-span-3 min-w-0 pr-2">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white truncate" title={order.fileName || order.documentId?.originalFilename}>
                      {order.fileName || order.documentId?.originalFilename || 'Document.pdf'}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {order.printingSpecifications?.totalPages || 1} pgs · {order.printingSpecifications?.copies || 1}x · {order.printingSpecifications?.colorMode === 'color' ? 'Color' : 'B&W'}
                    </div>
                  </div>

                  <div className="col-span-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      ₱{Number(order.estimatedCost || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="col-span-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="col-span-2 text-right">
                    {order.status === 'completed' ? (
                      order.review?.rating ? (
                        <div className="inline-flex items-center gap-1 text-warning-500 font-bold text-xs">
                          <Star size={13} fill="currentColor" />
                          <span>{order.review.rating}.0</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRatingModalOrder(order)}
                          className="px-2.5 py-1 rounded-lg bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400 border border-warning-200 dark:border-warning-500/20 font-semibold text-xs inline-flex items-center gap-1 hover:bg-warning-100 transition-colors shadow-theme-xs cursor-pointer"
                        >
                          <Star size={11} /> Rate Shop
                        </button>
                      )
                    ) : (
                      <Link
                        to={`/my-requests/${order._id}`}
                        className="text-brand-500 dark:text-brand-400 font-semibold inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        <Eye size={13} />
                        <span>Track Order</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Mobile Card */}
                <div className="flex md:hidden flex-col gap-2.5 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link
                        to={`/my-requests/${order._id}`}
                        className="font-bold text-xs text-brand-500 dark:text-brand-400 hover:underline"
                      >
                        #{order.trackingNumber || order._id.slice(-6).toUpperCase()}
                      </Link>
                      <div className="font-bold text-xs text-gray-900 dark:text-white mt-0.5">
                        {order.shopId?.shopName || 'Printing Shop'}
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {order.fileName || order.documentId?.originalFilename || 'Document.pdf'}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {order.printingSpecifications?.totalPages || 1} pgs × {order.printingSpecifications?.copies || 1} copies · {order.printingSpecifications?.colorMode === 'color' ? 'Full Color' : 'B&W'}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Total Amount</div>
                      <div className="text-xs font-black text-gray-900 dark:text-white">
                        ₱{Number(order.estimatedCost || 0).toFixed(2)}
                      </div>
                    </div>

                    {order.status === 'completed' && !order.review?.rating ? (
                      <button
                        type="button"
                        onClick={() => setRatingModalOrder(order)}
                        className="px-3 py-1.5 rounded-lg bg-warning-50 text-warning-700 border border-warning-200 font-semibold text-xs shadow-theme-xs cursor-pointer inline-flex items-center gap-1"
                      >
                        ⭐ Rate Shop
                      </button>
                    ) : (
                      <Link
                        to={`/my-requests/${order._id}`}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-brand-500 font-semibold text-xs shadow-theme-xs"
                      >
                        View Details →
                      </Link>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex justify-between items-center flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 px-1">
          <span>Showing {filtered.length} of {requests.length} total orders</span>
          <span className="font-bold text-gray-900 dark:text-white">
            Total Completed: ₱{Number(totalSpent).toFixed(2)}
          </span>
        </div>
      )}

      {/* Shopee-style Rating Modal */}
      {ratingModalOrder && (
        <RatingReviewModal
          isOpen={Boolean(ratingModalOrder)}
          request={ratingModalOrder}
          onClose={() => setRatingModalOrder(null)}
          onReviewSubmitted={() => {
            setRatingModalOrder(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
