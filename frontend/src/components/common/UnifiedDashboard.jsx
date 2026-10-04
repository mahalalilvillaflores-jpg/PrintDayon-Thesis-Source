import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const COLOR_CONFIGS = {
  blue: {
    bg: 'bg-brand-50 dark:bg-brand-500/15',
    text: 'text-brand-500 dark:text-brand-400',
    hover: 'hover:bg-brand-100 dark:hover:bg-brand-500/25',
    accent: '#465FFF',
    valColor: 'text-gray-900 dark:text-white',
  },
  teal: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-500/25',
    accent: '#12B76A',
    valColor: 'text-gray-900 dark:text-white',
  },
  amber: {
    bg: 'bg-warning-50 dark:bg-warning-500/15',
    text: 'text-warning-600 dark:text-warning-400',
    hover: 'hover:bg-warning-100 dark:hover:bg-warning-500/25',
    accent: '#F79009',
    valColor: 'text-gray-900 dark:text-white',
  },
  emerald: {
    bg: 'bg-success-50 dark:bg-success-500/15',
    text: 'text-success-600 dark:text-success-400',
    hover: 'hover:bg-success-100 dark:hover:bg-success-500/25',
    accent: '#12B76A',
    valColor: 'text-gray-900 dark:text-white',
  },
  indigo: {
    bg: 'bg-brand-50 dark:bg-brand-500/15',
    text: 'text-brand-600 dark:text-brand-400',
    hover: 'hover:bg-brand-100 dark:hover:bg-brand-500/25',
    accent: '#3641F5',
    valColor: 'text-gray-900 dark:text-white',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/15',
    text: 'text-purple-600 dark:text-purple-400',
    hover: 'hover:bg-purple-100 dark:hover:bg-purple-500/25',
    accent: '#7A5AF8',
    valColor: 'text-gray-900 dark:text-white',
  },
  rose: {
    bg: 'bg-error-50 dark:bg-error-500/15',
    text: 'text-error-600 dark:text-error-400',
    hover: 'hover:bg-error-100 dark:hover:bg-error-500/25',
    accent: '#F04438',
    valColor: 'text-gray-900 dark:text-white',
  },
};

export function DashboardContainer({ children, className = '' }) {
  return (
    <div className={`w-full max-w-full pb-6 font-outfit ${className}`}>
      {children}
    </div>
  );
}

export function DashboardHeroBanner({
  portalTag = 'Dashboard Portal',
  title,
  subtitle,
  icon: SubtitleIcon,
  badge,
  actions,
  illustration,
  className = '',
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl px-6 sm:px-7 lg:px-8 py-5 sm:py-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-theme-xs flex items-center ${className}`}
    >
      <div className="relative z-10 w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
        <div className="min-w-0 max-w-xl shrink">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {portalTag && (
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold tracking-normal text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30">
                {portalTag}
              </span>
            )}
            {badge}
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-[24px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight mb-1.5 font-outfit">
            {title}
          </h1>

          {subtitle && (
            <p className="text-xs sm:text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[540px] font-normal m-0 flex items-center gap-1.5">
              {SubtitleIcon && <SubtitleIcon size={14} className="text-brand-500 shrink-0" />}
              <span>{subtitle}</span>
            </p>
          )}
        </div>

        {actions && <div className="relative z-10 shrink-0 flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function DashboardMetricsGrid({ children, columns = 'auto', className = '' }) {
  const colClass =
    columns === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : columns === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : columns === 5
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${colClass} gap-4 sm:gap-5 mb-6 ${className}`}>
      {children}
    </div>
  );
}

export function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  subvalue,
  color = 'blue',
  trend,
  trendType = 'up',
  footerText,
  linkTo,
  actionIcon: ActionIcon = ChevronRight,
  actionTitle = 'View details',
  className = '',
  variant = 'tailadmin',
}) {
  const cfg = COLOR_CONFIGS[color] || COLOR_CONFIGS.blue;

  if (variant === 'tailadmin') {
    return (
      <div
        className={`rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs hover:shadow-theme-sm transition-all flex flex-col justify-between ${className}`}
      >
        <div className="flex items-start justify-between">
          {Icon && (
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center shrink-0 shadow-theme-xs">
              <Icon size={22} />
            </div>
          )}

          {linkTo ? (
            <Link
              to={linkTo}
              title={actionTitle}
              className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.hover} ${cfg.text} flex items-center justify-center transition-colors shrink-0`}
            >
              <ActionIcon size={14} />
            </Link>
          ) : null}
        </div>

        <div className="mt-4">
          <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block truncate">
            {label}
          </span>
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white font-outfit tracking-tight truncate">
              {value} {subvalue && <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{subvalue}</span>}
            </span>

            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                  trendType === 'down'
                    ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400'
                    : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400'
                }`}
              >
                <span>{trendType === 'down' ? '↓' : '↑'}</span>
                <span>{trend}</span>
              </span>
            )}
          </div>
        </div>

        {footerText && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
            {footerText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs hover:shadow-theme-sm transition-all flex flex-col justify-between ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          {Icon && (
            <div className={`w-12 h-12 rounded-xl ${cfg.bg} ${cfg.text} flex items-center justify-center shrink-0 shadow-theme-xs`}>
              <Icon size={22} />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{label}</div>
            <div className={`text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5 leading-tight tracking-tight truncate font-outfit`}>
              {value} {subvalue && <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{subvalue}</span>}
            </div>
          </div>
        </div>

        {linkTo ? (
          <Link
            to={linkTo}
            title={actionTitle}
            className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.hover} ${cfg.text} flex items-center justify-center transition-colors shrink-0`}
          >
            <ActionIcon size={14} />
          </Link>
        ) : null}
      </div>

      {footerText && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
          {footerText}
        </div>
      )}
    </div>
  );
}

export function DashboardCard({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs transition-all ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function DashboardSectionHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  action,
  className = '',
}) {
  return (
    <div className={`flex items-center justify-between gap-4 mb-4 flex-wrap ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          {Icon && <Icon size={19} className="text-brand-500 shrink-0" />}
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white m-0 tracking-tight font-outfit">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 m-0 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function DashboardStatusBadge({ status = 'online', label, className = '' }) {
  const norm = String(status).toLowerCase();
  const isOnline = norm === 'online' || norm === 'open' || norm === 'ready' || norm === 'completed';
  const isBusy = norm === 'busy' || norm === 'pending';
  const isQueued = norm === 'queued' || norm === 'printing';

  let bgClass = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  let dotClass = 'bg-gray-400';

  if (isOnline) {
    bgClass = 'bg-success-50 text-success-600 border-success-200/60 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/20';
    dotClass = 'bg-success-500';
  } else if (isBusy) {
    bgClass = 'bg-warning-50 text-warning-600 border-warning-200/60 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/20';
    dotClass = 'bg-warning-500';
  } else if (isQueued) {
    bgClass = 'bg-brand-50 text-brand-600 border-brand-200/60 dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/20';
    dotClass = 'bg-brand-500';
  } else if (norm === 'closed' || norm === 'offline' || norm === 'rejected') {
    bgClass = 'bg-error-50 text-error-600 border-error-200/60 dark:bg-error-500/15 dark:text-error-400 dark:border-error-500/20';
    dotClass = 'bg-error-500';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-normal border ${bgClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label || status}
    </span>
  );
}
