import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Eye, EyeOff,
  ArrowRight
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(form.email, form.password);
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'shop_owner' || user.role === 'partner') {
        navigate('/owner/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen w-screen overflow-hidden relative flex flex-col justify-center items-center px-4 bg-cover bg-center bg-no-repeat font-outfit"
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
      <div className="w-full max-w-[420px] relative z-20 flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-7 sm:p-8 shadow-theme-xl border border-white/80 dark:border-gray-800 transition-all">

        {/* Brand */}
        <div className="text-center mb-6">
          <Link
            to="/"
            title="Back to Homepage"
            className="inline-flex justify-center no-underline mb-3 hover:opacity-90 transition-opacity"
          >
            <img src="/logo.png" alt="Logo" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" />
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight m-0">
            Login
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-error-700 dark:text-error-400 text-xs font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-error-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 text-left">
              Email Address
            </label>
            <input
              type="email"
              id="login-email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Enter your email"
              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/70 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-brand-500 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-brand-500 hover:text-brand-600 hover:underline no-underline font-medium"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/70 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-brand-500 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center pt-0.5">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-400 select-none">
              <input
                type="checkbox"
                checked={form.rememberMe}
                onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
                className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 cursor-pointer accent-brand-500"
              />
              Remember Me
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl text-white font-semibold text-sm bg-brand-500 hover:bg-brand-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-theme-xs mt-1"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Login</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Portal Switcher */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-2.5">
            Don't have an account?
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/register"
              className="py-2 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold text-center no-underline transition-all active:scale-95"
            >
              Customer Sign-Up
            </Link>
            <Link
              to="/register/partner"
              className="py-2 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold text-center no-underline transition-all active:scale-95"
            >
              Shop Owner Sign-Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}