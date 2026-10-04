import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI, requestAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  User, Mail, Phone, MapPin, Lock, Save,
  ShieldCheck, KeyRound, AlertCircle, RefreshCw,
  Eye, EyeOff, CheckCircle2
} from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile, refreshUser } = useAuth();

  // Profile fields state
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || '');
  const [address, setAddress] = useState(user?.address || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || user?.avatarUrl || '');

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Inline validation errors
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Order statistics state
  const [orderStats, setOrderStats] = useState({ total: 0, active: 0, completed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Sync state when user object changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setContactNumber(user.contactNumber || '');
      setAddress(user.address || '');
      setProfilePhoto(user.profilePhoto || user.avatarUrl || '');
    }
  }, [user]);

  // Track if personal information form has unsaved changes
  const isProfileDirty = useMemo(() => {
    return (
      name.trim() !== (user?.name || '').trim() ||
      contactNumber.trim() !== (user?.contactNumber || '').trim() ||
      address.trim() !== (user?.address || '').trim()
    );
  }, [name, contactNumber, address, user]);

  // Load customer order metrics
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const res = await requestAPI.getMyRequests({ limit: 100 });
        const list = res.data?.requests || res.data?.data?.requests || [];
        const completed = list.filter((r) => r.status === 'completed' || r.status === 'picked_up').length;
        const active = list.filter((r) => !['completed', 'picked_up', 'cancelled', 'rejected'].includes(r.status)).length;
        setOrderStats({ total: list.length, active, completed });
      } catch (err) {
        console.warn('Could not load user order statistics:', err.message);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  // Handle profile update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setNameError('');
    setPhoneError('');

    if (!name.trim()) {
      setNameError('Full name is required.');
      toast.error('Full name is required.');
      return;
    }

    const cleanPhone = contactNumber.trim().replace(/\D/g, '');
    if (cleanPhone && !/^09\d{9}$/.test(cleanPhone)) {
      setPhoneError('Enter a valid 11-digit Philippine mobile number starting with 09.');
      toast.error('Please enter a valid 11-digit Philippine mobile number.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        contactNumber: cleanPhone,
        address: address.trim(),
        profilePhoto: profilePhoto.trim(),
      });
      toast.success('Profile updated successfully!');
      if (refreshUser) await refreshUser();
    } catch (err) {
      console.error('Failed to update profile:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to update profile.';
      toast.error(errMsg);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle password update
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      toast.error('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      toast.error('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password.');
      toast.error('New password must be different from current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      toast.error('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authAPI.changePassword({ currentPassword, newPassword });
      toast.success(res?.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      console.error('Failed to change password:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to change password.';
      setPasswordError(errMsg);
      toast.error(errMsg);
    } finally {
      setSavingPassword(false);
    }
  };

  // User avatar initials
  const getInitials = (str) => {
    if (!str) return 'C';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return str.slice(0, 2).toUpperCase();
  };

  const isVerifiedCustomer = user?.status === 'active' || user?.isVerified !== false;

  return (
    <div className="w-full flex flex-col gap-5 sm:gap-6 pb-14 font-outfit fade-in">

      {/* ==================================================
          COMPACT PROFILE SUMMARY & STATS CARD
          (Eliminated redundant "My Profile" heading card since top navbar already displays page title)
      ================================================== */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-theme-xs flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        {/* Profile Identity on Left */}
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-brand-600 text-white font-extrabold text-lg sm:text-xl flex items-center justify-center shrink-0 shadow-2xs border-2 border-brand-200 dark:border-brand-500/30 overflow-hidden">
            {profilePhoto ? (
              <img src={profilePhoto} alt={name || 'Avatar'} className="w-full h-full object-cover" />
            ) : (
              getInitials(name || user?.name)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-gray-900 dark:text-white m-0 tracking-tight truncate">
                {name || user?.name || 'Customer'}
              </h2>
              {isVerifiedCustomer && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shrink-0">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span>Verified Customer</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 m-0 mt-0.5 flex items-center gap-1.5 truncate">
              <Mail size={13} className="text-gray-400 shrink-0" />
              <span className="truncate">{email || user?.email}</span>
            </p>
          </div>
        </div>

        {/* Compact Order Metrics on Right */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80 px-2.5 sm:px-4 py-2 text-center flex flex-col justify-center items-center min-w-[85px] sm:min-w-[95px]">
            <div className="text-base sm:text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
              {statsLoading ? '...' : orderStats.total}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
              Total Orders
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80 px-2.5 sm:px-4 py-2 text-center flex flex-col justify-center items-center min-w-[85px] sm:min-w-[95px]">
            <div className="text-base sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 leading-tight">
              {statsLoading ? '...' : orderStats.completed}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
              Completed
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80 px-2.5 sm:px-4 py-2 text-center flex flex-col justify-center items-center min-w-[85px] sm:min-w-[95px]">
            <div className="text-base sm:text-xl font-extrabold text-brand-600 dark:text-brand-400 leading-tight">
              {statsLoading ? '...' : orderStats.active}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
              Active
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================
          3. MAIN FORMS GRID: Personal Info & Account Security
             (Uses items-start so Card 2 fits naturally without blank void)
      ================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">

        {/* --------------------------------------------------
            CARD 1: Personal & Contact Information
        --------------------------------------------------- */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-theme-xs space-y-5">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-100 dark:border-brand-900/50">
                <User size={18} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0 tracking-tight">
                  Personal Information
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
                  Update your contact details for print order pickups.
                </p>
              </div>
            </div>

            {/* Unsaved Changes Indicator */}
            {isProfileDirty && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                Unsaved changes
              </span>
            )}
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="customer-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Full Name
              </label>
              <div className="relative flex items-center">
                <User size={15} className="text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="customer-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(''); }}
                  required
                  placeholder="Juan Dela Cruz"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              {nameError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 m-0 flex items-center gap-1 font-semibold">
                  <AlertCircle size={12} /> {nameError}
                </p>
              )}
            </div>

            {/* Email Address (Read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="customer-email" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  Read-only
                </span>
              </div>
              <div className="relative flex items-center">
                <Mail size={15} className="text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="customer-email"
                  type="email"
                  value={email}
                  disabled
                  readOnly
                  aria-readonly="true"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium cursor-not-allowed select-none"
                />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 m-0">
                Email cannot be modified as it is your unique account identifier.
              </p>
            </div>

            {/* Philippine Mobile Number */}
            <div>
              <label htmlFor="customer-phone" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Philippine Mobile Number
              </label>
              <div className="relative flex items-center">
                <Phone size={15} className="text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="customer-phone"
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => { setContactNumber(e.target.value); setPhoneError(''); }}
                  placeholder="09171234567"
                  maxLength={11}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              {phoneError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 m-0 flex items-center gap-1 font-semibold">
                  <AlertCircle size={12} /> {phoneError}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 m-0">
                  Used by print shops to contact you for claim inquiries or status alerts.
                </p>
              )}
            </div>

            {/* Default Address / Location */}
            <div>
              <label htmlFor="customer-address" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Default Address / Location (Naval, Biliran)
              </label>
              <div className="relative flex items-start">
                <MapPin size={15} className="text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
                <textarea
                  id="customer-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Barangay, street, or nearby landmark (e.g. Near BiPSU Gate, Naval)"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none font-sans"
                />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 m-0">
                Helps calculate accurate travel distance and routing to nearby print shops.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile || !isProfileDirty}
                className="w-full sm:w-auto h-10 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all shadow-theme-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingProfile ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* --------------------------------------------------
            CARD 2: Security & Password Settings
            (Fits naturally without giant blank void underneath)
        --------------------------------------------------- */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-theme-xs space-y-5">
          {/* Card Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/80">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-100 dark:border-brand-900/50">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0 tracking-tight">
                Account Security
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
                Manage your password and security credentials.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password */}
            <div>
              <label htmlFor="current-password" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Current Password
              </label>
              <div className="relative flex items-center">
                <KeyRound size={15} className="text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); }}
                  required
                  placeholder="Enter current password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer bg-transparent border-none"
                >
                  {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="new-password" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <span className={`text-[10px] font-semibold ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                  Min. 8 characters
                </span>
              </div>
              <div className="relative flex items-center">
                <Lock size={15} className="text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                  required
                  placeholder="Min. 8 characters"
                  minLength={8}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer bg-transparent border-none"
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative flex items-center">
                <Lock size={15} className="text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                  required
                  placeholder="Re-enter new password"
                  minLength={8}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                  className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer bg-transparent border-none"
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 m-0 flex items-center gap-1 font-semibold">
                  <AlertCircle size={12} /> Passwords do not match.
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 m-0 flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={12} /> Passwords match.
                </p>
              )}
            </div>

            {/* General Password Error */}
            {passwordError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2 font-medium">
                <AlertCircle size={14} className="shrink-0 text-rose-500" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Update Password Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full sm:w-auto h-10 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all shadow-theme-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPassword ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={15} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Compact Security & Privacy Notice (Placed right below form without giant void) */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80 flex items-start gap-2.5 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            <AlertCircle size={15} className="text-brand-500 shrink-0 mt-0.5" />
            <span>
              Your account details and orders are secured under Naval, Biliran municipality data protection standards.
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
