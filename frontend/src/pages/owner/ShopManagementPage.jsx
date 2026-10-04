import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Store, Camera, MapPin, Phone, Save, Upload, Navigation,
  Clock, Sun, Moon, ToggleLeft, ToggleRight, Calendar,
  ShieldAlert, Flame, Power, CheckCircle2, XCircle, RefreshCw,
  ShieldCheck, FileText, Eye, History, ExternalLink, X,
  AlertCircle, Lock, Sparkles, AlertTriangle, Trash2
} from 'lucide-react';
import ShopFacadeImage, { StorefrontPlaceholder } from '../../components/common/ShopFacadeImage';
import ShopLocationSection from '../../components/owner/ShopLocationSection';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVAL_LANDMARKS = [
  { name: 'BiPSU Main Campus (Vicentillo Ext.)', lat: 11.563591, lng: 124.398505 },
  { name: 'Naval Town Plaza & Cathedral', lat: 11.562502, lng: 124.395952 },
  { name: 'Naval Public Market / Terminal', lat: 11.560478, lng: 124.396483 },
  { name: 'Naval Port / Pier Area', lat: 11.5615, lng: 124.3935 },
  { name: 'Sitio Butay, P.I. Garcia', lat: 11.56437, lng: 124.39964 },
];

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

const CLOSURE_REASONS = [
  { value: 'closing_early', label: 'Closing Early Today' },
  { value: 'power_outage', label: 'Power Outage / Brownout' },
  { value: 'equipment_problem', label: 'Equipment / Hardware Problem' },
  { value: 'emergency', label: 'Emergency / Staff Unavailable' },
  { value: 'temporary_closure', label: 'Temporary Break / Out of Office' },
  { value: 'other', label: 'Other Reason (Specify Below)' },
];

const OPERATIONAL_CONDITIONS = [
  { id: 'normal', label: 'Normal Service', badge: '🟢 OPEN — Normal', desc: 'All machines operational, standard processing time.', color: 'emerald' },
  { id: 'service_delay', label: 'Service Delay', badge: '🟠 OPEN — Service Delay', desc: 'Orders are accepted, but processing may take longer.', color: 'amber' },
  { id: 'high_walkin', label: 'High Customer Demand', badge: '🟠 OPEN — High Demand', desc: 'Many customers are waiting, so processing may take longer.', color: 'orange' },
  { id: 'equipment_problem', label: 'Equipment Maintenance', badge: '🟠 OPEN — Limited Capacity', desc: 'Equipment maintenance may slow down processing.', color: 'amber' },
];

const TABS = [
  { id: 'profile', label: 'Shop Profile', icon: Store },
  { id: 'schedule', label: 'Schedule & Status', icon: Clock },
  { id: 'verification', label: 'Business Verification', icon: ShieldCheck },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getDocStatusInfo(doc) {
  const current = doc?.currentFile;
  if (!current || !current.fileUrl) {
    return { status: 'pending_upload', label: 'Pending Upload', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400', dotClass: 'bg-slate-400', alert: null };
  }
  if (current.status === 'rejected') {
    return { status: 'rejected', label: 'Rejected', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400', dotClass: 'bg-rose-500', alert: current.rejectionReason || 'Document was rejected by platform administrator.' };
  }
  if (current.expiresAt) {
    const expDate = new Date(current.expiresAt);
    const now = new Date();
    if (expDate < now) {
      return { status: 'expired', label: 'Expired', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400', dotClass: 'bg-rose-500', alert: 'Document is expired — Please upload an updated renewal document immediately.' };
    }
    const days = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    if (days <= 30) {
      return { status: 'expiring_soon', label: 'Expiring Soon', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400', dotClass: 'bg-amber-500', alert: `Document expires in ${days} day${days === 1 ? '' : 's'} on ${expDate.toLocaleDateString()}. Please prepare renewal document.` };
    }
  }
  if (current.status === 'verified') {
    return { status: 'verified', label: 'Verified', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400', dotClass: 'bg-emerald-500', alert: null };
  }
  return { status: 'pending', label: 'Pending Verification', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-sky-400', dotClass: 'bg-blue-500', alert: 'Newly uploaded document is waiting for administrator review.' };
}

// ─── Tab 1: Shop Profile ──────────────────────────────────────────────────────

function ShopProfileTab({ shop, onShopUpdated }) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [form, setForm] = useState({
    shopName: '', description: '', address: '', landmark: '',
    locationDescription: '', latitude: 11.5628, longitude: 124.3980,
    contactNumber: '', gcashName: '', gcashNumber: '',
    storefrontPhotoUrl: '',
  });

  useEffect(() => {
    if (!shop) return;
    setForm({
      shopName: shop.shopName || '',
      description: shop.description || '',
      address: shop.address || '',
      landmark: shop.landmark || '',
      locationDescription: shop.locationDescription || '',
      latitude: shop.latitude || shop.location?.coordinates?.[1] || 11.5628,
      longitude: shop.longitude || shop.location?.coordinates?.[0] || 124.3980,
      contactNumber: shop.contactNumber || '',
      gcashName: shop.gcashName || '',
      gcashNumber: shop.gcashNumber || '',
      storefrontPhotoUrl: shop.storefrontPhotoUrl || '',
    });
  }, [shop]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file (JPG or PNG)'); return; }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await shopAPI.uploadStorefrontPhoto(formData);
      const newUrl = res.data?.storefrontPhotoUrl || res.data?.shop?.storefrontPhotoUrl;
      setForm(prev => ({ ...prev, storefrontPhotoUrl: newUrl || prev.storefrontPhotoUrl }));
      toast.success('Storefront facade photo updated successfully!');
      onShopUpdated({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    setDeletingPhoto(true);
    try {
      await shopAPI.deleteStorefrontPhoto();
      setForm(prev => ({ ...prev, storefrontPhotoUrl: '' }));
      toast.success('Facade photo deleted successfully.');
      setShowDeleteModal(false);
      onShopUpdated({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete facade photo');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleLandmarkSelect = (lm) => {
    setForm(prev => ({ ...prev, landmark: lm.name, latitude: lm.lat, longitude: lm.lng }));
    toast.success(`Coordinates aligned to ${lm.name}`);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!shop?._id) return;
    if (!form.shopName.trim()) { toast.error('Shop name is required'); return; }
    if (!form.address.trim()) { toast.error('Physical address is required'); return; }

    const isValidPhone = (num) => !num || /^(09|639)\d{9}$/.test(num);
    
    if (form.contactNumber && !isValidPhone(form.contactNumber)) {
      toast.error('Enter a valid contact mobile number.'); return;
    }
    if (form.gcashNumber && !isValidPhone(form.gcashNumber)) {
      toast.error('Enter a valid GCash mobile number.'); return;
    }

    setSaving(true);
    try {
      await shopAPI.update(shop._id, {
        shopName: form.shopName.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        landmark: form.landmark.trim(),
        locationDescription: form.locationDescription.trim(),
        latitude: parseFloat(form.latitude) || 11.5628,
        longitude: parseFloat(form.longitude) || 124.3980,
        contactNumber: form.contactNumber.trim(),
        gcashName: form.gcashName.trim(),
        gcashNumber: form.gcashNumber.trim(),
      });
      toast.success('Shop profile updated successfully!');
      onShopUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update shop profile');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, opts = {}) => {
    const handleChange = (e) => {
      let val = e.target.value;
      if (opts.numericOnly) {
        val = val.replace(/\D/g, '');
      }
      setForm(p => ({ ...p, [key]: val }));
    };

    return (
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{label}{opts.required ? ' *' : ''}</label>
        {opts.textarea ? (
          <textarea rows={2} value={form[key]} onChange={handleChange} placeholder={opts.placeholder} className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all shadow-sm" />
        ) : (
          <input type={opts.type || 'text'} inputMode={opts.numericOnly ? 'numeric' : undefined} value={form[key]} onChange={handleChange} placeholder={opts.placeholder} maxLength={opts.maxLength} step={opts.step} required={opts.required} className={`w-full px-4 py-2.5 text-sm ${opts.mono ? 'font-mono tracking-wider text-sm' : ''} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all shadow-sm`} />
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-8 relative">
      {/* Storefront Photo */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2"><Camera size={17} className="text-[#465FFF]" /> Storefront Facade Photo (Public)</h2>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pt-2">
          <div className="w-full md:w-[280px] lg:w-[320px] shrink-0 aspect-[16/9] md:aspect-auto md:h-[180px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center relative shadow-inner">
            <ShopFacadeImage
              src={form.storefrontPhotoUrl}
              shopName={form.shopName || shop?.shopName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 w-full space-y-4 text-center md:text-left flex flex-col justify-center md:h-[180px]">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed m-0 max-w-md mx-auto md:mx-0">
              Upload a clear photo of your shop's physical storefront to help customers find you easily.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <label className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-xs cursor-pointer transition-all w-full sm:w-auto">
                <Upload size={14} />
                {uploadingPhoto ? 'Uploading...' : form.storefrontPhotoUrl ? 'Replace Facade Photo' : 'Upload Storefront Photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} disabled={uploadingPhoto || deletingPhoto} className="sr-only" />
              </label>

              {form.storefrontPhotoUrl ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={uploadingPhoto || deletingPhoto}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                >
                  <Trash2 size={14} />
                  Delete Photo
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed m-0">
              Recommended: Horizontal (16:9), under 5MB (JPG, PNG).<br />
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Important:</span> Do not upload government permits here.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-5 space-y-4 font-outfit animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Delete facade photo?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 m-0">This photo will no longer be shown to customers.</p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingPhoto}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePhoto}
                disabled={deletingPhoto}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors border-none cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {deletingPhoto ? 'Deleting...' : 'Delete Photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shop Identity */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">Shop Information & Description</h2>
        <div className="grid grid-cols-1 gap-4">
          {field('Printing Shop Name', 'shopName', { required: true, placeholder: 'e.g. QuickPrint Studio Naval' })}
          {field('Shop Tagline / Short Description', 'description', { textarea: true, placeholder: 'e.g. Fast document printing, bookbinding, and thesis production near BiPSU campus.' })}
        </div>
      </div>

      {/* Location */}
      <ShopLocationSection form={form} setForm={setForm} />

      {/* Contact & Payment */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2"><Phone size={16} className="text-emerald-500" /> Contact & Payment Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {field('Contact Number (09xx)', 'contactNumber', { type: 'tel', maxLength: 12, mono: true, placeholder: '09171234567', numericOnly: true })}
          {field('GCash Registered Name', 'gcashName', { placeholder: 'e.g. Maria S.' })}
          {field('GCash Mobile Number', 'gcashNumber', { type: 'tel', maxLength: 12, mono: true, placeholder: '09XXXXXXXXX', numericOnly: true })}
        </div>
      </div>

      {/* Save Bar */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-end">
        <button type="submit" disabled={saving} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-black text-sm shadow-md transition-all cursor-pointer border-none disabled:opacity-50 min-w-[240px]">
          <Save size={18} />
          {saving ? 'Saving Profile...' : 'Save Profile Changes'}
        </button>
      </div>
    </form>
  );
}

// ─── Tab 2: Schedule & Status ─────────────────────────────────────────────────

function ScheduleStatusTab({ shop, onShopUpdated }) {
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [updatingCondition, setUpdatingCondition] = useState(false);
  const [updatingClosure, setUpdatingClosure] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [operatingHours, setOperatingHours] = useState(DEFAULT_HOURS);

  // Operational condition
  const [condition, setCondition] = useState('normal');
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [advisoryMessage, setAdvisoryMessage] = useState('');

  // Temporary closure
  const [closureReason, setClosureReason] = useState('closing_early');
  const [customReason, setCustomReason] = useState('');
  const [closureAdvisory, setClosureAdvisory] = useState('');
  const [reopenType, setReopenType] = useState('next_scheduled_opening');
  const [reopenTime, setReopenTime] = useState('');

  useEffect(() => {
    if (!shop) return;
    // Schedule
    if (Array.isArray(shop.operatingHours) && shop.operatingHours.length > 0) {
      const merged = DAYS.map(({ key }) => {
        const found = shop.operatingHours.find(h => h.day?.toLowerCase() === key);
        return found
          ? { day: key, open: found.open || '08:00', close: found.close || '17:00', isClosed: Boolean(found.isClosed) }
          : { day: key, open: '08:00', close: '17:00', isClosed: key === 'sunday' };
      });
      setOperatingHours(merged);
    }
    // Condition
    setCondition(shop.operationalCondition || 'normal');
    setDelayMinutes(shop.operationalDelayMinutes || 0);
    setAdvisoryMessage(shop.operationalMessage || '');
    // Closure
    const tc = shop.temporaryClosure || {};
    setClosureReason(tc.reason || 'closing_early');
    setCustomReason(tc.customReason || '');
    setClosureAdvisory(tc.advisoryMessage || '');
    setReopenType(tc.reopenType || 'next_scheduled_opening');
    if (tc.reopenAt) {
      const d = new Date(tc.reopenAt);
      setReopenTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  }, [shop]);

  const getTodayEvaluation = () => {
    try {
      const phDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todaySchedule = operatingHours.find(h => h.day === dayNames[phDate.getDay()]);
      if (!todaySchedule || todaySchedule.isClosed) return { isOpen: false, label: 'Closed Today (Scheduled Day Off)', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400' };
      const [openH, openM] = (todaySchedule.open || '08:00').split(':').map(Number);
      const [closeH, closeM] = (todaySchedule.close || '17:00').split(':').map(Number);
      const curr = phDate.getHours() * 60 + phDate.getMinutes();
      const open = openH * 60 + openM;
      const close = closeH * 60 + closeM;
      if (curr >= open && curr < close) return { isOpen: true, label: `Open Now (${formatTime(todaySchedule.open)} – ${formatTime(todaySchedule.close)})`, badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' };
      return { isOpen: false, label: curr < open ? `Closed Now (Opens at ${formatTime(todaySchedule.open)})` : `Closed for Today (Closed at ${formatTime(todaySchedule.close)})`, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300' };
    } catch {
      return { isOpen: false, label: 'Schedule Pending', badgeClass: 'bg-slate-100 text-slate-700' };
    }
  };

  const handleSaveSchedule = async () => {
    if (!shop?._id) return;
    setSavingSchedule(true);
    try {
      await shopAPI.update(shop._id, { operatingHours });
      toast.success('Operating schedule saved successfully!');
      onShopUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSaveCondition = async () => {
    if (!shop?._id) return;
    setUpdatingCondition(true);
    try {
      await shopAPI.updateOperationalStatus(shop._id, { condition, delayMinutes: Number(delayMinutes) || 0, message: advisoryMessage.trim() });
      toast.success('Operational condition updated!');
      onShopUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update condition');
    } finally {
      setUpdatingCondition(false);
    }
  };

  const handleSetClosure = async () => {
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
      onShopUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set temporary closure');
    } finally {
      setUpdatingClosure(false);
    }
  };

  const handleReopenNow = async () => {
    if (!shop?._id) return;
    setReopening(true);
    try {
      await shopAPI.reopenShop(shop._id);
      toast.success('Shop reopened! Returned to automatic schedule operation.');
      onShopUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reopen shop');
    } finally {
      setReopening(false);
    }
  };

  const isOverrideActive = shop?.temporaryClosure?.isClosed;
  const evaluation = getTodayEvaluation();

  return (
    <div className="space-y-5 pb-8 relative font-outfit">
      {/* Today's Status Banner */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#101828] border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${evaluation.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Today's Schedule</div>
            <div className="text-sm font-bold text-[#101828] dark:text-white">{evaluation.label}</div>
          </div>
        </div>
        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${evaluation.badgeClass}`}>
          {evaluation.isOpen ? '🟢 OPEN BY SCHEDULE' : '⚪ CLOSED BY SCHEDULE'}
        </span>
      </div>

      {/* Weekly Timetable */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2"><Calendar size={16} className="text-[#465FFF]" /> Weekly Timetable</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {DAYS.map(({ key, label }) => {
            const ds = operatingHours.find(h => h.day === key) || { open: '08:00', close: '17:00', isClosed: false };
            return (
              <div key={key} className={`p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-6 transition-colors ${ds.isClosed ? 'bg-slate-50/60 dark:bg-slate-900/40' : 'bg-white dark:bg-[#101828]'}`}>
                {/* Day Name & Badge */}
                <div className="flex items-center justify-between lg:w-32 shrink-0">
                  <span className={`text-sm font-bold ${ds.isClosed ? 'text-slate-400' : 'text-[#101828] dark:text-white'}`}>{label}</span>
                  {ds.isClosed && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">Closed</span>}
                </div>

                {/* Controls */}
                <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {!ds.isClosed ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Opens</span>
                        <input type="time" value={ds.open} onChange={e => setOperatingHours(prev => prev.map(h => h.day === key ? { ...h, open: e.target.value } : h))} className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Closes</span>
                        <input type="time" value={ds.close} onChange={e => setOperatingHours(prev => prev.map(h => h.day === key ? { ...h, close: e.target.value } : h))} className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all" />
                      </div>
                      <span className="text-[11px] font-bold text-[#465FFF] dark:text-sky-400 ml-1 hidden md:block w-36">{formatTime(ds.open)} – {formatTime(ds.close)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Day off — No orders accepted</span>
                  )}

                  <button type="button" onClick={() => setOperatingHours(prev => prev.map(h => h.day === key ? { ...h, isClosed: !h.isClosed } : h))} className={`text-[11px] font-bold px-3 py-2 rounded-lg border transition-all cursor-pointer w-full sm:w-auto shrink-0 ${ds.isClosed ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 hover:bg-slate-200'}`}>
                    {ds.isClosed ? 'Set as Open' : 'Mark as Day Off'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={handleSaveSchedule} disabled={savingSchedule} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-black text-sm shadow-md transition-all cursor-pointer border-none disabled:opacity-50 min-w-[240px]">
          <Save size={18} /> {savingSchedule ? 'Saving...' : 'Save Weekly Schedule'}
        </button>
      </div>



      {/* Temporary Closure Active Alert */}
      {isOverrideActive && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5"><XCircle size={22} /></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">Temporary Closure Active</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-800 dark:bg-rose-900 dark:text-rose-200">Schedule Overridden</span>
              </div>
              <div className="text-sm font-bold text-rose-900 dark:text-rose-100 mt-0.5">
                Reason: {CLOSURE_REASONS.find(r => r.value === shop?.temporaryClosure?.reason)?.label || shop?.temporaryClosure?.reason || 'Advisory'}
              </div>
              {shop?.temporaryClosure?.advisoryMessage && (
                <div className="text-xs text-rose-700 dark:text-rose-300 mt-1 italic">&ldquo;{shop.temporaryClosure.advisoryMessage}&rdquo;</div>
              )}
            </div>
          </div>
          <button onClick={handleReopenNow} disabled={reopening} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all cursor-pointer border-none disabled:opacity-50 shrink-0">
            <CheckCircle2 size={16} /> {reopening ? 'Reopening...' : 'Reopen Shop Now'}
          </button>
        </div>
      )}

      {/* Operational Condition */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2 mb-1"><Flame size={16} className="text-[#465FFF]" /> Shop Operating Condition</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0">Let customers know about delays or service conditions.</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPERATIONAL_CONDITIONS.map(op => {
            const isSelected = condition === op.id;
            return (
              <button key={op.id} type="button" onClick={() => setCondition(op.id)} className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-[#465FFF] bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#465FFF]' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-bold text-[#101828] dark:text-white">{op.label}</span>
                  <span className="text-[10px] font-bold">{op.badge}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 leading-snug">{op.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-4">
          <div>
            <label className="block text-sm font-bold text-[#101828] dark:text-white mb-2">Additional Wait Time</label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="5" value={delayMinutes} onChange={e => setDelayMinutes(Math.max(0, parseInt(e.target.value) || 0))} className="w-24 px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">minutes</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">Extra minutes added to estimated wait time</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#101828] dark:text-white mb-2">Message to Customers</label>
            <input type="text" placeholder="e.g. High service demand..." value={advisoryMessage} onChange={e => setAdvisoryMessage(e.target.value)} className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">Optional message shown to customers.</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button onClick={handleSaveCondition} disabled={updatingCondition} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-sm font-black shadow-md transition-all cursor-pointer border-none disabled:opacity-50 min-w-[200px]">
            {updatingCondition ? 'Saving...' : 'Save Condition'}
          </button>
        </div>
      </div>

      {/* Temporary Closure Override */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-xs p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400 m-0 flex items-center gap-2"><Power size={16} /> Temporary Closure Override</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Reason for Closure</label>
            <select value={closureReason} onChange={e => setClosureReason(e.target.value)} className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all">
              {CLOSURE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Public Advisory Message</label>
            <input type="text" placeholder="e.g. We will reopen as soon as electricity is restored." value={closureAdvisory} onChange={e => setClosureAdvisory(e.target.value)} className="w-full px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all" />
          </div>
        </div>

        {closureReason === 'other' && (
          <div className="pt-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Specific Custom Reason</label>
            <input type="text" placeholder="Explain reason for temporary closure..." value={customReason} onChange={e => setCustomReason(e.target.value)} className="w-full px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all" />
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 mt-4">Reopening Plan</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { value: 'next_scheduled_opening', title: 'Next Normal Schedule', desc: 'Reopen automatically next day' },
              { value: 'specific_time', title: 'Specific Date/Time', desc: 'Reopen at exact time' },
              { value: 'manual', title: 'Manual Reopen', desc: 'Stay closed until manual reopen' },
            ].map(opt => (
              <label key={opt.value} className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer text-xs transition-all ${reopenType === opt.value ? 'border-[#465FFF] bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-[#465FFF]' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                <input type="radio" name="reopenType" checked={reopenType === opt.value} onChange={() => setReopenType(opt.value)} className="mt-0.5 cursor-pointer" />
                <div>
                  <div className="font-bold text-[#101828] dark:text-white">{opt.title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {reopenType === 'specific_time' && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 mt-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">Designated Reopening Date & Time</label>
            <input type="datetime-local" value={reopenTime} onChange={e => setReopenTime(e.target.value)} className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all" />
          </div>
        )}

        <div className="flex justify-end pt-3">
          <button onClick={handleSetClosure} disabled={updatingClosure} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer border-none disabled:opacity-50 min-w-[200px]">
            <Power size={15} /> {updatingClosure ? 'Activating Closure...' : 'Activate Temporary Closure'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Business Verification ─────────────────────────────────────────────

function BusinessVerificationTab({ shop, onShopUpdated }) {
  const [replaceModalDoc, setReplaceModalDoc] = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceDocNumber, setReplaceDocNumber] = useState('');
  const [replaceExpiresAt, setReplaceExpiresAt] = useState('');
  const [replacingDoc, setReplacingDoc] = useState(false);
  const [previewModalDoc, setPreviewModalDoc] = useState(null);
  const [expandedHistoryDoc, setExpandedHistoryDoc] = useState(null);

  const openReplaceModal = (doc) => {
    setReplaceModalDoc(doc);
    setReplaceFile(null);
    setReplaceDocNumber(doc?.currentFile?.docNumber || doc?.docNumber || '');
    setReplaceExpiresAt(doc?.currentFile?.expiresAt ? doc.currentFile.expiresAt.slice(0, 10) : '');
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!replaceFile) { toast.error('Please choose a document file (PDF or image)'); return; }
    setReplacingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', replaceFile);
      if (replaceDocNumber.trim()) formData.append('docNumber', replaceDocNumber.trim());
      if (replaceExpiresAt) formData.append('expiresAt', replaceExpiresAt);
      await shopAPI.replaceBusinessDocument(replaceModalDoc.type, formData);
      toast.success('Document uploaded and submitted for administrator verification!');
      setReplaceModalDoc(null);
      onShopUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setReplacingDoc(false);
    }
  };

  const docs = (shop?.businessDocuments && shop.businessDocuments.length > 0)
    ? shop.businessDocuments
    : [
        { type: 'dti', title: 'DTI Business Name Registration', docNumber: shop?.dtiNumber || '', currentFile: { fileName: shop?.dtiDocName || '', fileUrl: shop?.dtiDocUrl || '', status: shop?.verificationStatus === 'verified' ? 'verified' : 'pending' }, history: [] },
        { type: 'mayors_permit', title: "Mayor's / Business Permit", docNumber: shop?.mayorsPermitNumber || '', currentFile: { fileName: shop?.permitDocName || '', fileUrl: shop?.permitDocUrl || '', status: shop?.verificationStatus === 'verified' ? 'verified' : 'pending' }, history: [] },
      ];

  return (
    <div className="space-y-6">
      {/* Confidentiality Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3">
        <Lock size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <strong>Confidential & Private:</strong> These documents are stored securely and inspected exclusively by platform administrators to verify legitimate business identity. <strong>They are never shown publicly to customers.</strong>
        </div>
      </div>

      {/* Document Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {docs.map((doc) => {
          const statusInfo = getDocStatusInfo(doc);
          const current = doc.currentFile;
          const hasFile = current && current.fileUrl;
          return (
            <div key={doc.type} className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col justify-between overflow-hidden">
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">{doc.title}</h2>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">{doc.docNumber || current?.docNumber ? `No: ${doc.docNumber || current.docNumber}` : 'No document number provided'}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                    {statusInfo.label}
                  </span>
                </div>
                {statusInfo.alert && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium leading-tight">{statusInfo.alert}</span>
                  </div>
                )}
                {hasFile ? (
                  <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Uploaded File:</span>
                      <span className="font-bold text-[#101828] dark:text-white truncate max-w-[180px]">{current.fileName || 'Uploaded Document'}</span>
                    </div>
                    {current.uploadedAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Date Uploaded:</span>
                        <span className="text-slate-700 dark:text-slate-300">{new Date(current.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                    {current.expiresAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Expires On:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(current.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                    No document uploaded yet. Upload a copy to verify your printing business.
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {hasFile && (
                    <button type="button" onClick={() => setPreviewModalDoc(doc)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors bg-transparent border-none cursor-pointer">
                      <Eye size={14} /> Preview
                    </button>
                  )}
                  {doc.history && doc.history.length > 0 && (
                    <button type="button" onClick={() => setExpandedHistoryDoc(expandedHistoryDoc === doc.type ? null : doc.type)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors bg-transparent border-none cursor-pointer">
                      <History size={14} /> History ({doc.history.length})
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => openReplaceModal(doc)} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-xs transition-all border-none cursor-pointer">
                  <Upload size={14} /> {hasFile ? 'Upload Renewal' : 'Upload Document'}
                </button>
              </div>
              {expandedHistoryDoc === doc.type && doc.history?.length > 0 && (
                <div className="p-4 bg-slate-100/70 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Archived Prior Versions</div>
                  {doc.history.map((ver, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#101828] dark:text-white">{ver.fileName}</div>
                        <div className="text-[10px] text-slate-400">Uploaded {new Date(ver.uploadedAt).toLocaleDateString()}</div>
                      </div>
                      <a href={ver.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#465FFF] dark:text-sky-400 hover:underline">
                        <ExternalLink size={12} /> View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload Modal */}
      {replaceModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-[#101828] dark:text-white m-0">Upload {replaceModalDoc.title}</h2>
              <button onClick={() => setReplaceModalDoc(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent border-none cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Registration / Permit Number</label>
                <input type="text" placeholder="e.g. DTI-01234567 or BP-2026-0042" value={replaceDocNumber} onChange={e => setReplaceDocNumber(e.target.value)} className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Document Expiration Date</label>
                <input type="date" value={replaceExpiresAt} onChange={e => setReplaceExpiresAt(e.target.value)} className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Document File (PDF, JPG, or PNG)</label>
                <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setReplaceFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#465FFF] hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-sky-400 cursor-pointer" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setReplaceModalDoc(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-none cursor-pointer">Cancel</button>
                <button type="submit" disabled={replacingDoc || !replaceFile} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-sm transition-all border-none cursor-pointer disabled:opacity-50">
                  <Upload size={14} /> {replacingDoc ? 'Uploading...' : 'Submit Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">{previewModalDoc.title}</h2>
              <button onClick={() => setPreviewModalDoc(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent border-none cursor-pointer"><X size={18} /></button>
            </div>
            <div className="h-[60vh] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800">
              {previewModalDoc.currentFile?.fileType?.startsWith('image') || previewModalDoc.currentFile?.fileUrl?.match(/\.(jpg|jpeg|png)$/i) ? (
                <img src={previewModalDoc.currentFile.fileUrl} alt={previewModalDoc.title} className="max-h-full max-w-full object-contain" />
              ) : (
                <iframe src={previewModalDoc.currentFile?.fileUrl} title="Document Preview" className="w-full h-full border-none" />
              )}
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-400 font-mono">{previewModalDoc.currentFile?.fileName}</span>
              <a href={previewModalDoc.currentFile?.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold no-underline hover:bg-slate-900">
                <ExternalLink size={14} /> Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShopManagementPage({ initialTab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  // Determine active tab from URL param, prop, or default
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && TABS.find(t => t.id === tabFromUrl) ? tabFromUrl : (initialTab || 'profile')
  );

  const fetchShop = useCallback(async (options = { silent: false }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await shopAPI.getMyShop();
      setShop(res.data);
    } catch (err) {
      toast.error('Could not load shop data');
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShop(); }, [fetchShop]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-[#465FFF] border-t-transparent rounded-full animate-spin mr-3" />
        Loading shop management...
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12 font-outfit">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white dark:bg-[#101828] p-1 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
                isActive
                  ? 'bg-[#465FFF] text-white shadow-md'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ShopProfileTab shop={shop} onShopUpdated={fetchShop} />}
      {activeTab === 'schedule' && <ScheduleStatusTab shop={shop} onShopUpdated={fetchShop} />}
      {activeTab === 'verification' && <BusinessVerificationTab shop={shop} onShopUpdated={fetchShop} />}
    </div>
  );
}
