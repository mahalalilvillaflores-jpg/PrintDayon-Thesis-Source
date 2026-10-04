import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Eye, EyeOff, User, Mail, Phone, Lock,
  ArrowRight
} from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactNumber: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasMinLength = form.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(form.password);
  const hasNumber = /\d/.test(form.password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match.');
    }

    if (!isPasswordValid) {
      return setError(
        'Password must be 8+ characters with uppercase, number, and special character.'
      );
    }

    if (form.contactNumber && !/^09\d{9}$/.test(form.contactNumber)) {
      return setError('Cellphone number must be 11 digits starting with 09 (e.g. 09171234567).');
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        contactNumber: form.contactNumber,
        role: 'customer',
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-screen overflow-y-auto relative flex flex-col justify-center items-center py-6 px-4 bg-cover bg-center bg-no-repeat font-outfit"
      style={{ backgroundImage: "url('/images/naval_aerial_bg.jpg')" }}
    >
      {/* Vignette — dark overlay for form contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(16, 24, 40, 0.45) 0%, rgba(16, 24, 40, 0.75) 100%)',
        }}
      />

      {/* Card Container */}
      <div className="w-full max-w-[490px] relative z-20 flex-shrink-0 my-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] border border-white/80 dark:border-gray-800 transition-all">

        {/* Brand */}
        <div className="text-center mb-6">
          <Link
            to="/"
            title="Back to Homepage"
            className="inline-flex justify-center no-underline mb-3 group transition-transform hover:scale-105"
          >
            <img
              src="/logo.png"
              alt="Logo"
              className="h-20 w-20 sm:h-24 sm:w-24 object-contain drop-shadow-[0_10px_20px_rgba(70,95,255,0.18)]"
            />
          </Link>

          <h1 className="text-2xl sm:text-[26px] font-black text-gray-900 dark:text-white tracking-tight leading-tight m-0">
            Create Customer Account
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-error-700 dark:text-error-400 text-xs font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-error-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Full Name *
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                id="reg-name"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Juan Dela Cruz"
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-4 focus:ring-[#465FFF]/15 outline-none transition-all"
              />
              <div className="absolute right-3.5 text-slate-400 pointer-events-none flex items-center">
                <User size={16} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address *
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  id="reg-email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="juan@example.com"
                  className="w-full h-11 px-3.5 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-4 focus:ring-[#465FFF]/15 outline-none transition-all"
                />
                <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center">
                  <Mail size={15} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <div className="relative flex items-center">
                <input
                  type="tel"
                  id="reg-phone"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                  autoComplete="tel"
                  value={form.contactNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setForm({ ...form, contactNumber: val });
                  }}
                  placeholder="09XXXXXXXXX"
                  className="w-full h-11 px-3.5 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-4 focus:ring-[#465FFF]/15 outline-none transition-all"
                />
                <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center">
                  <Phone size={15} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Password *
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="reg-password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-4 focus:ring-[#465FFF]/15 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password *
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="reg-confirm"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-4 focus:ring-[#465FFF]/15 outline-none transition-all"
                />
                <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center">
                  <Lock size={15} />
                </div>
              </div>
            </div>
          </div>

          {form.password.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px]">
              <div className={`flex items-center gap-1.5 font-medium ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{hasMinLength ? '✓' : '○'}</span>
                <span>8+ characters</span>
              </div>
              <div className={`flex items-center gap-1.5 font-medium ${hasUppercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{hasUppercase ? '✓' : '○'}</span>
                <span>Uppercase (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 font-medium ${hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{hasNumber ? '✓' : '○'}</span>
                <span>Number (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 font-medium ${hasSpecial ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{hasSpecial ? '✓' : '○'}</span>
                <span>Symbol (!@#$)</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-[#465FFF] via-[#3B50DF] to-[#2563EB] hover:from-[#3B50DF] hover:to-[#1D4ED8] active:scale-[0.98] shadow-[0_4px_16px_rgba(70,95,255,0.3)] hover:shadow-[0_8px_24px_rgba(70,95,255,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer pt-0.5 mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer switcher */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[#465FFF] hover:text-[#3B50DF] hover:underline no-underline">
              Sign In
            </Link>
          </div>
          <Link
            to="/register/partner"
            className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 hover:border-[#465FFF]/40 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs hover:shadow-xs active:scale-95"
          >
            <span>Own a print shop? Register as Partner</span>
            <ArrowRight size={13} className="text-[#465FFF]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
