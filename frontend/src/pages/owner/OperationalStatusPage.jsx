import { useState, useEffect } from 'react';
import { shopAPI } from '../../services/api';
import {
  AlertTriangle, ShieldAlert, CheckCircle2, Clock,
  Flame, Power, Wrench, RefreshCw, XCircle, Info,
  AlertCircle, Sparkles, ArrowRight, Users, Plus, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

const CLOSURE_REASONS = [
  { value: 'closing_early', label: 'Closing Early Today' },
  { value: 'power_outage', label: 'Power Outage / Brownout' },
  { value: 'equipment_problem', label: 'Equipment / Hardware Problem' },
  { value: 'emergency', label: 'Emergency / Staff Unavailable' },
  { value: 'temporary_closure', label: 'Temporary Break / Out of Office' },
  { value: 'other', label: 'Other Reason (Specify Below)' },
];

const OPERATIONAL_CONDITIONS = [
  {
    id: 'normal',
    label: 'Normal Service',
    badge: '🟢 OPEN — Normal',
    desc: 'All machines operational, standard processing turnaround.',
    color: 'emerald',
  },
  {
    id: 'service_delay',
    label: 'Service Delay',
    badge: '🟠 OPEN — Service Delay',
    desc: 'Accepting orders, but queue turnaround has an added delay.',
    color: 'amber',
  },
  {
    id: 'high_walkin',
    label: 'High Counter Demand',
    badge: '🟠 OPEN — High Demand',
    desc: 'Heavy in-store customer traffic; online turnaround extended.',
    color: 'orange',
  },
  {
    id: 'equipment_problem',
    label: 'Equipment Maintenance',
    badge: '🟠 OPEN — Limited Capacity',
    desc: 'One or more printers under maintenance; slower output.',
    color: 'amber',
  },
];

export default function OperationalStatusPage() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingCondition, setUpdatingCondition] = useState(false);
  const [updatingClosure, setUpdatingClosure] = useState(false);
  const [reopening, setReopening] = useState(false);

  // Operational Condition State
  const [condition, setCondition] = useState('normal');
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [advisoryMessage, setAdvisoryMessage] = useState('');

  // Walk-In Counter Traffic State
  const [walkInCount, setWalkInCount] = useState(0);
  const [walkInTrafficLevel, setWalkInTrafficLevel] = useState('normal');
  const [updatingTraffic, setUpdatingTraffic] = useState(false);

  // Temporary Closure State
  const [isTemporarilyClosed, setIsTemporarilyClosed] = useState(false);
  const [closureReason, setClosureReason] = useState('closing_early');
  const [customReason, setCustomReason] = useState('');
  const [closureAdvisory, setClosureAdvisory] = useState('');
  const [reopenType, setReopenType] = useState('next_scheduled_opening');
  const [reopenTime, setReopenTime] = useState('');

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    setLoading(true);
    try {
      const res = await shopAPI.getMyShop();
      const shopData = res.data;
      setShop(shopData);

      // Populate condition
      setCondition(shopData.operationalCondition || 'normal');
      setDelayMinutes(shopData.operationalDelayMinutes || 0);
      setAdvisoryMessage(shopData.operationalMessage || '');

      // Populate walk-in traffic
      setWalkInCount(Math.max(0, Number(shopData.walkInCustomerCount) || 0));
      setWalkInTrafficLevel(shopData.walkInTrafficLevel || 'normal');

      // Populate temporary closure
      const tc = shopData.temporaryClosure || {};
      const isClosed = Boolean(tc.isClosed);
      setIsTemporarilyClosed(isClosed);
      setClosureReason(tc.reason || 'closing_early');
      setCustomReason(tc.customReason || '');
      setClosureAdvisory(tc.advisoryMessage || '');
      setReopenType(tc.reopenType || 'next_scheduled_opening');

      if (tc.reopenAt) {
        const d = new Date(tc.reopenAt);
        const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setReopenTime(localIso);
      }
    } catch (err) {
      toast.error('Could not load operational status');
    } finally {
      setLoading(false);
    }
  };

  // 1. Save Operational Condition & Delay
  const handleSaveCondition = async (e) => {
    e?.preventDefault();
    if (!shop?._id) return;
    setUpdatingCondition(true);
    try {
      await shopAPI.updateOperationalStatus(shop._id, {
        condition,
        delayMinutes: Number(delayMinutes) || 0,
        message: advisoryMessage.trim(),
      });
      toast.success('Operational condition updated!');
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update condition');
    } finally {
      setUpdatingCondition(false);
    }
  };

  // 2. Save Walk-In Traffic
  const handleSaveWalkInTraffic = async (e) => {
    e?.preventDefault();
    if (!shop?._id) return;
    const countVal = Math.max(0, Math.floor(Number(walkInCount) || 0));
    setUpdatingTraffic(true);
    try {
      await shopAPI.updateWalkInCount(shop._id, countVal, walkInTrafficLevel);
      toast.success('Walk-in counter traffic updated successfully!');
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update walk-in traffic');
    } finally {
      setUpdatingTraffic(false);
    }
  };

  // 3. Activate Temporary Closure
  const handleSetClosure = async (e) => {
    e?.preventDefault();
    if (!shop?._id) return;
    setUpdatingClosure(true);
    try {
      await shopAPI.setTemporaryClosure(shop._id, {
        reason: closureReason,
        customReason: customReason.trim(),
        advisoryMessage: closureAdvisory.trim(),
        reopenType,
        reopenAt: reopenType === 'specific_time' && reopenTime ? new Date(reopenTime).toISOString() : null,
      });
      toast.success('Temporary closure activated. Shop is now marked CLOSED.');
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set temporary closure');
    } finally {
      setUpdatingClosure(false);
    }
  };

  // 3. Reopen Now (Cancel override)
  const handleReopenNow = async () => {
    if (!shop?._id) return;
    setReopening(true);
    try {
      await shopAPI.reopenShop(shop._id);
      toast.success('Shop reopened! Returned to automatic schedule operation.');
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reopen shop');
    } finally {
      setReopening(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-[#465FFF] border-t-transparent rounded-full animate-spin mr-3" />
        Loading operational controls...
      </div>
    );
  }

  const isOverrideActive = shop?.temporaryClosure?.isClosed;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <ShieldAlert size={20} />
          </span>
          <h1 className="text-xl font-black text-[#101828] dark:text-white m-0">
            Operational Status &amp; Temporary Closures
          </h1>
        </div>
        <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 mb-0">
          Broadcast real-time operational conditions, turnaround delays, or temporary emergency closures that override normal schedule hours.
        </p>
      </div>

      {/* Override Alert Banner (When Currently Closed Temporarily) */}
      {isOverrideActive && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <XCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Temporary Closure Active
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                  Schedule Overridden
                </span>
              </div>
              <div className="text-sm font-bold text-rose-900 dark:text-rose-100 mt-0.5">
                Reason: {CLOSURE_REASONS.find((r) => r.value === shop.temporaryClosure?.reason)?.label || shop.temporaryClosure?.reason || 'Advisory'}
              </div>
              {shop.temporaryClosure?.advisoryMessage && (
                <div className="text-xs text-rose-700 dark:text-rose-300 mt-1 italic">
                  &ldquo;{shop.temporaryClosure.advisoryMessage}&rdquo;
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleReopenNow}
            disabled={reopening}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all cursor-pointer border-none disabled:opacity-50 shrink-0"
          >
            <CheckCircle2 size={16} />
            {reopening ? 'Reopening...' : 'Reopen Shop Now'}
          </button>
        </div>
      )}

      {/* Section 1: Real-Time Operational Condition & Delay */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
            <Flame size={16} className="text-amber-500" />
            Operational Condition (Open Status Modifier)
          </h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5 mb-0">
            Tell customers about temporary delays or high queue volume without completely closing the shop.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPERATIONAL_CONDITIONS.map((op) => {
            const isSelected = condition === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setCondition(op.id)}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#465FFF] bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-[#465FFF]/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#101828] dark:text-white">{op.label}</span>
                  <span className="text-[10px] font-bold">{op.badge}</span>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 m-0 leading-relaxed">
                  {op.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Delay Minutes Adjustment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Turnaround Delay Estimate (Minutes)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="5"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-32 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <span className="text-xs text-slate-400 font-medium">min added to customer wait times</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Customer Advisory Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Printer 2 undergoing toner replacement"
              value={advisoryMessage}
              onChange={(e) => setAdvisoryMessage(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveCondition}
            disabled={updatingCondition}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50"
          >
            {updatingCondition ? 'Updating...' : 'Update Condition'}
          </button>
        </div>
      </div>

      {/* Section 2: Walk-In Counter Traffic Controls */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
            <Users size={16} className="text-[#465FFF]" />
            Walk-In Counter Traffic Controls
          </h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5 mb-0">
            Keep customer-facing wait estimates accurate by reporting in-store walk-in volume and counter queues.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Left: Customer Count Stepper */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Current Walk-In Customers at Counter
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWalkInCount((prev) => Math.max(0, Number(prev || 0) - 1))}
                className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-white flex items-center justify-center font-black transition-all cursor-pointer shadow-xs disabled:opacity-40"
                disabled={walkInCount <= 0}
                title="Decrease walk-in count"
              >
                <Minus size={16} />
              </button>
              
              <input
                type="number"
                min="0"
                step="1"
                value={walkInCount}
                onChange={(e) => setWalkInCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 text-center px-3 py-2 text-lg font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner"
              />

              <button
                type="button"
                onClick={() => setWalkInCount((prev) => Math.max(0, Number(prev || 0) + 1))}
                className="w-10 h-10 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white flex items-center justify-center font-black transition-all cursor-pointer shadow-xs"
                title="Increase walk-in count"
              >
                <Plus size={16} />
              </button>

              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {walkInCount === 1 ? '1 customer in store' : `${walkInCount} customers in store`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 m-0">
              Walk-in count cannot be negative. Updates the live store queue for customers.
            </p>
          </div>

          {/* Right: Traffic Level Radio Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Crowd Density Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: 'Normal', dot: 'bg-emerald-500', delay: '+0m wait', desc: 'Light traffic' },
                { id: 'moderate', label: 'Moderate', dot: 'bg-amber-500', delay: '+10m wait', desc: 'Busy counter' },
                { id: 'packed', label: 'Packed', dot: 'bg-rose-500', delay: '+25m wait', desc: 'Heavy queue' },
              ].map((lvl) => {
                const isSelected = walkInTrafficLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setWalkInTrafficLevel(lvl.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#465FFF] bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-[#465FFF]/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${lvl.dot}`} />
                      <span className="text-xs font-bold text-[#101828] dark:text-white capitalize">{lvl.label}</span>
                    </div>
                    <div className="text-[11px] font-bold text-[#465FFF] dark:text-sky-400">{lvl.delay}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{lvl.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSaveWalkInTraffic}
            disabled={updatingTraffic}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={14} className={updatingTraffic ? 'animate-spin' : ''} />
            {updatingTraffic ? 'Saving Traffic...' : 'Save Walk-In Traffic'}
          </button>
        </div>
      </div>

      {/* Section 3: Temporary Closure Override */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400 m-0 flex items-center gap-2">
            <Power size={16} />
            Temporary Closure Override
          </h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5 mb-0">
            Temporarily close the shop for power interruptions, equipment failure, or sudden emergencies. Overrides the normal schedule.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for Closure
            </label>
            <select
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {CLOSURE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {closureReason === 'other' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Specific Custom Reason
              </label>
              <input
                type="text"
                placeholder="Explain reason for temporary closure..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Public Advisory Message to Customers
            </label>
            <input
              type="text"
              placeholder="e.g. We will reopen as soon as electricity is restored."
              value={closureAdvisory}
              onChange={(e) => setClosureAdvisory(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Reopening Plan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer text-xs ${reopenType === 'next_scheduled_opening' ? 'border-[#465FFF] bg-blue-50/30 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                <input
                  type="radio"
                  name="reopenType"
                  checked={reopenType === 'next_scheduled_opening'}
                  onChange={() => setReopenType('next_scheduled_opening')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-[#101828] dark:text-white">Next Normal Schedule</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Reopen automatically on next scheduled day/time</div>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer text-xs ${reopenType === 'specific_time' ? 'border-[#465FFF] bg-blue-50/30 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                <input
                  type="radio"
                  name="reopenType"
                  checked={reopenType === 'specific_time'}
                  onChange={() => setReopenType('specific_time')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-[#101828] dark:text-white">Specific Date/Time</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Reopen at exact designated time</div>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer text-xs ${reopenType === 'manual' ? 'border-[#465FFF] bg-blue-50/30 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                <input
                  type="radio"
                  name="reopenType"
                  checked={reopenType === 'manual'}
                  onChange={() => setReopenType('manual')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-[#101828] dark:text-white">Manual Reopen</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Stay closed until I manually click Reopen</div>
                </div>
              </label>
            </div>
          </div>

          {reopenType === 'specific_time' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designated Reopening Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={reopenTime}
                onChange={(e) => setReopenTime(e.target.value)}
                className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSetClosure}
            disabled={updatingClosure}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer border-none disabled:opacity-50"
          >
            <Power size={15} />
            {updatingClosure ? 'Activating Closure...' : 'Activate Temporary Closure'}
          </button>
        </div>
      </div>
    </div>
  );
}
