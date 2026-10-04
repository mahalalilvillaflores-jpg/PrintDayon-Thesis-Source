import { useState, useEffect } from 'react';
import { shopAPI } from '../../services/api';
import {
  Clock, Calendar, CheckCircle2, AlertCircle,
  Save, Sparkles, Moon, Sun, ToggleLeft, ToggleRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_HOURS = DAYS.map(({ key }) => ({
  day: key,
  open: '08:00',
  close: '17:00',
  isClosed: key === 'sunday',
}));

export default function SchedulePage() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operatingHours, setOperatingHours] = useState(DEFAULT_HOURS);

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    setLoading(true);
    try {
      const res = await shopAPI.getMyShop();
      const shopData = res.data;
      setShop(shopData);

      if (Array.isArray(shopData.operatingHours) && shopData.operatingHours.length > 0) {
        // Merge with full 7 days to guarantee complete schedule
        const merged = DAYS.map(({ key }) => {
          const found = shopData.operatingHours.find((h) => h.day?.toLowerCase() === key);
          return found
            ? { day: key, open: found.open || '08:00', close: found.close || '17:00', isClosed: Boolean(found.isClosed) }
            : { day: key, open: '08:00', close: '17:00', isClosed: key === 'sunday' };
        });
        setOperatingHours(merged);
      }
    } catch (err) {
      toast.error('Could not load operating schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleHourChange = (dayKey, field, val) => {
    setOperatingHours((prev) =>
      prev.map((item) => (item.day === dayKey ? { ...item, [field]: val } : item))
    );
  };

  const handleToggleClosed = (dayKey) => {
    setOperatingHours((prev) =>
      prev.map((item) => (item.day === dayKey ? { ...item, isClosed: !item.isClosed } : item))
    );
  };

  // Evaluate current schedule status
  const getTodayEvaluation = () => {
    try {
      const now = new Date();
      const phDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayKey = dayNames[phDate.getDay()];
      const todaySchedule = operatingHours.find((h) => h.day === todayKey);

      if (!todaySchedule || todaySchedule.isClosed) {
        return {
          isOpen: false,
          label: 'Closed Today (Scheduled Day Off)',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400',
        };
      }

      const [openH, openM] = (todaySchedule.open || '08:00').split(':').map(Number);
      const [closeH, closeM] = (todaySchedule.close || '17:00').split(':').map(Number);
      const currentMins = phDate.getHours() * 60 + phDate.getMinutes();
      const openMins = openH * 60 + openM;
      const closeMins = closeH * 60 + closeM;

      if (currentMins >= openMins && currentMins < closeMins) {
        return {
          isOpen: true,
          label: `Open Now (Operating Hours: ${formatTime(todaySchedule.open)} - ${formatTime(todaySchedule.close)})`,
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400',
        };
      } else {
        return {
          isOpen: false,
          label: currentMins < openMins
            ? `Closed Now (Opens at ${formatTime(todaySchedule.open)})`
            : `Closed for Today (Closed at ${formatTime(todaySchedule.close)})`,
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
        };
      }
    } catch {
      return { isOpen: false, label: 'Schedule Pending', badgeClass: 'bg-slate-100 text-slate-700' };
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const handleSave = async () => {
    if (!shop?._id) return;
    setSaving(true);
    try {
      await shopAPI.update(shop._id, { operatingHours });
      toast.success('Operating schedule saved successfully!');
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-[#465FFF] border-t-transparent rounded-full animate-spin mr-3" />
        Loading operating schedule...
      </div>
    );
  }

  const evaluation = getTodayEvaluation();

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#465FFF] dark:text-sky-400">
              <Clock size={20} />
            </span>
            <h1 className="text-xl font-black text-[#101828] dark:text-white m-0">
              Operating Schedule &amp; Normal Hours
            </h1>
          </div>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 mb-0">
            Configure regular weekly opening and closing hours. The system automatically marks your shop Open or Closed based on this timetable.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-bold text-sm shadow-md transition-all cursor-pointer border-none disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>

      {/* Live Status Banner */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#101828] border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${evaluation.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Schedule Evaluation:</div>
            <div className="text-sm font-bold text-[#101828] dark:text-white">{evaluation.label}</div>
          </div>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${evaluation.badgeClass}`}>
          {evaluation.isOpen ? '🟢 OPEN BY SCHEDULE' : '⚪ CLOSED BY SCHEDULE'}
        </span>
      </div>

      {/* Weekly Schedule Configuration */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">Weekly Timetable</h2>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5 mb-0">
              Set standard opening and closing times for each day of the week.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {DAYS.map(({ key, label }) => {
            const daySchedule = operatingHours.find((h) => h.day === key) || {
              open: '08:00',
              close: '17:00',
              isClosed: false,
            };

            return (
              <div
                key={key}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  daySchedule.isClosed
                    ? 'bg-slate-50/60 dark:bg-slate-900/40 text-slate-400'
                    : 'bg-white dark:bg-[#101828]'
                }`}
              >
                {/* Day Label & Quick Toggle */}
                <div className="flex items-center justify-between sm:justify-start gap-4 min-w-[140px]">
                  <span className={`text-sm font-bold ${daySchedule.isClosed ? 'text-slate-400' : 'text-[#101828] dark:text-white'}`}>
                    {label}
                  </span>
                  {daySchedule.isClosed && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                      Closed
                    </span>
                  )}
                </div>

                {/* Time Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {!daySchedule.isClosed ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Opens:</span>
                        <input
                          type="time"
                          value={daySchedule.open}
                          onChange={(e) => handleHourChange(key, 'open', e.target.value)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <span className="text-slate-400 text-xs">—</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Closes:</span>
                        <input
                          type="time"
                          value={daySchedule.close}
                          onChange={(e) => handleHourChange(key, 'close', e.target.value)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <span className="text-xs font-bold text-[#465FFF] dark:text-sky-400 ml-2 hidden md:inline">
                        ({formatTime(daySchedule.open)} - {formatTime(daySchedule.close)})
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Day off — No orders accepted</span>
                  )}
                </div>

                {/* Open/Closed Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => handleToggleClosed(key)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      daySchedule.isClosed
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {daySchedule.isClosed ? 'Set as Open' : 'Mark as Day Off'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notice Card */}
      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3">
        <Sparkles size={18} className="text-[#465FFF] dark:text-sky-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <strong>Automatic Operation:</strong> You do not need to manually log in and open your shop every morning. The platform continuously computes your live status using these hours. When unexpected events occur (power outage, equipment issue, early closure), use the <strong>Operational Status</strong> tab to post a temporary closure override.
        </div>
      </div>

      {/* Floating Save Button Bar */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-black text-sm shadow-lg transition-all cursor-pointer border-none disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Weekly Schedule'}
        </button>
      </div>
    </div>
  );
}
