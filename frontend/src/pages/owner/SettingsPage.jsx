import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI, shopAPI } from '../../services/api';
import {
  User, Lock, Save, Eye, EyeOff,
  ShieldCheck, Store, Mail, ChevronRight, CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

function SectionHeader({ id, icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#465FFF] dark:text-sky-400 flex items-center justify-center shrink-0 mt-px">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-bold text-[#101828] dark:text-white my-0 leading-tight">
          {title}
        </h2>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 mb-0 leading-snug">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function OwnerSettingsPage() {
  const { user, updateProfile, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    contactNumber: user?.contactNumber || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [shopData, setShopData] = useState(null);

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        contactNumber: user.contactNumber || '',
      });
    }
    const loadShop = async () => {
      try {
        const res = await shopAPI.getMyShop();
        setShopData(res.data);
      } catch {
        // shop loading is non-blocking
      }
    };
    loadShop();
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const cleanName = profileForm.name.trim();
    if (!cleanName || cleanName.length < 2) {
      toast.error('Full Name must be at least 2 characters long.');
      return;
    }
    const cleanContact = profileForm.contactNumber.trim().replace(/\D/g, '');
    if (cleanContact && !/^09\d{9}$/.test(cleanContact)) {
      toast.error('Cellphone number must be an 11-digit number starting with 09 (e.g. 09171234567).');
      return;
    }
    setSavingProfile(true);
    try {
      if (updateProfile) {
        await updateProfile({ name: cleanName, contactNumber: cleanContact });
      } else {
        await authAPI.updateProfile({ name: cleanName, contactNumber: cleanContact });
      }
      if (refreshUser) await refreshUser();
      toast.success('Account profile updated successfully!');
    } catch (err) {
      toast.error(err?.message || err?.error || err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword) { toast.error('Current password is required.'); return; }
    if (!newPassword) { toast.error('New password is required.'); return; }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters long.'); return; }
    if (currentPassword === newPassword) { toast.error('New password must be different from your current password.'); return; }
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match.'); return; }

    setSavingPw(true);
    try {
      const res = await authAPI.changePassword({ currentPassword, newPassword });
      toast.success(res?.message || 'Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmPw(false);
    } catch (err) {
      toast.error(err?.message || err?.error || err?.response?.data?.message || 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  };

  const pwField = (label, key, show, setShow) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={passwordForm[key]}
          onChange={(e) => setPasswordForm((p) => ({ ...p, [key]: e.target.value }))}
          className="w-full px-3.5 py-2.5 pr-10 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent border-none cursor-pointer p-0"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  const shopName = shopData?.shopName || user?.shopName || '';

  const inputCls =
    'w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] transition-all';
  const labelCls = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

  // Shared card shell — tighter for secondary cards
  const card = 'bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 pb-12 font-outfit">
      {/* Subtitle — global header already shows "Account Settings" */}
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-0">
        Manage your account information and security.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ── 1. PROFILE ── */}
        <section className={`${card} p-4 sm:p-5 lg:col-span-2`} aria-labelledby="profile-heading">
          <SectionHeader
            id="profile-heading"
            icon={User}
            title="Profile"
            description="Manage your personal account information."
          />

          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="settings-full-name" className={labelCls}>Full Name</label>
                <input
                  id="settings-full-name"
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Lander Aragon"
                  required
                />
              </div>

              <div>
                <label htmlFor="settings-contact" className={labelCls}>
                  Contact Cellphone Number
                </label>
                <input
                  id="settings-contact"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={profileForm.contactNumber}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, contactNumber: e.target.value.replace(/\D/g, '') }))
                  }
                  className={`${inputCls} font-mono`}
                  placeholder="09171234567"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address</span>
                  <span className="text-[10px] font-medium text-slate-400">Primary login credential</span>
                </div>
                <div className="px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{user?.email || '—'}</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0 font-outfit">
                    Fixed
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-xs transition-all cursor-pointer border-none disabled:opacity-50"
              >
                <Save size={14} />
                <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* ── 2. MY PRINTING SHOP (read-only) ── */}
        <section className={`${card} p-4 sm:p-5`} aria-labelledby="my-shop-heading">
          <SectionHeader
            id="my-shop-heading"
            icon={Store}
            title="My Printing Shop"
            description="The printing shop linked to your account."
          />

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3.5 py-3">
            {shopName ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#101828] dark:text-white m-0 break-words">
                    {shopName}
                  </p>
                  {shopData?.isVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 size={10} />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-0 flex items-center gap-1.5">
                  <ShieldCheck size={11} className="text-[#465FFF] dark:text-sky-400 shrink-0" />
                  You are the owner of this printing shop.
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                No printing shop linked to this account yet.
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 mb-3 leading-relaxed">
            Shop details, schedule, services and pricing are managed in Shop Management.
          </p>

          <button
            type="button"
            onClick={() => navigate('/owner/management')}
            className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded-xl text-xs font-bold text-[#465FFF] dark:text-sky-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40 transition-colors cursor-pointer"
          >
            <span>Manage Shop</span>
            <ChevronRight size={13} />
          </button>
        </section>
      </div>

      {/* ── 3. ACCOUNT SECURITY ── */}
      <section className={`${card} p-4 sm:p-5`} aria-labelledby="security-heading">
        <SectionHeader
          id="security-heading"
          icon={Lock}
          title="Account Security"
          description="Update your password to keep your account secure."
        />

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pwField('Current Password', 'currentPassword', showCurrentPw, setShowCurrentPw)}
            {pwField('New Password (min. 8)', 'newPassword', showNewPw, setShowNewPw)}
            {pwField('Confirm New Password', 'confirmPassword', showConfirmPw, setShowConfirmPw)}
          </div>

          {passwordForm.newPassword && passwordForm.confirmPassword && (
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                passwordForm.newPassword === passwordForm.confirmPassword
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {passwordForm.newPassword === passwordForm.confirmPassword ? (
                <>
                  <CheckCircle2 size={12} />
                  <span>Passwords match</span>
                </>
              ) : (
                <>
                  <AlertCircle size={12} />
                  <span>Passwords do not match</span>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPw}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-xs transition-all cursor-pointer border-none disabled:opacity-50"
            >
              <Lock size={14} />
              <span>{savingPw ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
