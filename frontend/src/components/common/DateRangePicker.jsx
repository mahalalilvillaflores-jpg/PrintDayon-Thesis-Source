import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Safely format 'YYYY-MM-DD' into readable 'September 20, 2026' without timezone drift
export const formatReadableDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

// Convert year, month (0-indexed), day to 'YYYY-MM-DD'
const toISODate = (year, month, day) => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

// Get today's date in 'YYYY-MM-DD'
const getTodayISO = () => {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
};

export default function DateRangePicker({
  startDate = '',
  endDate = '',
  onStartDateChange,
  onEndDateChange,
  onChange,
  onReset,
  className = '',
  startLabel = 'Start Date',
  endLabel = 'End Date',
}) {
  // activePicker: 'start' | 'end' | null
  const [activePicker, setActivePicker] = useState(null);

  // Calendar view navigation: year and month (0-indexed)
  const [viewYear, setViewYear] = useState(() => {
    if (startDate) return parseInt(startDate.split('-')[0], 10);
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (startDate) return parseInt(startDate.split('-')[1], 10) - 1;
    return new Date().getMonth();
  });

  const containerRef = useRef(null);

  // Close calendar popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActivePicker(null);
      }
    };
    if (activePicker) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [activePicker]);

  // Sync calendar view month/year when opening picker
  const openPicker = (type) => {
    const targetDate = type === 'start' ? startDate : endDate;
    if (targetDate) {
      const [y, m] = targetDate.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    } else if (startDate && type === 'end') {
      const [y, m] = startDate.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setActivePicker(type);
  };

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Select a specific date
  const handleSelectDate = (dateISO) => {
    if (activePicker === 'start') {
      if (onStartDateChange) onStartDateChange(dateISO);
      let newEnd = endDate;
      // If end date is earlier than the new start date, clear or adjust it
      if (endDate && dateISO > endDate) {
        newEnd = '';
        if (onEndDateChange) onEndDateChange('');
      }
      if (onChange) onChange({ startDate: dateISO, endDate: newEnd });

      // If end date is not set, automatically switch to selecting end date
      if (!newEnd) {
        setActivePicker('end');
      } else {
        setActivePicker(null);
      }
    } else if (activePicker === 'end') {
      if (startDate && dateISO < startDate) return; // Prevent selecting earlier date
      if (onEndDateChange) onEndDateChange(dateISO);
      if (onChange) onChange({ startDate, endDate: dateISO });
      setActivePicker(null);
    }
  };

  const handleSelectToday = (e) => {
    e.stopPropagation();
    const todayISO = getTodayISO();
    handleSelectDate(todayISO);
  };

  const handleClearActive = (e) => {
    e.stopPropagation();
    if (activePicker === 'start') {
      if (onStartDateChange) onStartDateChange('');
      if (onChange) onChange({ startDate: '', endDate });
    } else if (activePicker === 'end') {
      if (onEndDateChange) onEndDateChange('');
      if (onChange) onChange({ startDate, endDate: '' });
    }
    setActivePicker(null);
  };

  const handleFullReset = (e) => {
    e.stopPropagation();
    if (onStartDateChange) onStartDateChange('');
    if (onEndDateChange) onEndDateChange('');
    if (onChange) onChange({ startDate: '', endDate: '' });
    if (onReset) onReset();
    setActivePicker(null);
  };

  // Calendar calculations for the current view
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const todayISO = getTodayISO();

  return (
    <div ref={containerRef} className={`relative inline-block text-xs ${className}`}>
      {/* Input Fields Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Start Date Button */}
        <div className="flex items-center gap-1.5">
          {startLabel && (
            <span className="font-bold text-[#60728F] dark:text-slate-400 select-none">
              {startLabel}:
            </span>
          )}
          <button
            type="button"
            onClick={() => openPicker('start')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left cursor-pointer select-none ${
              activePicker === 'start'
                ? 'border-[#1F429B] ring-2 ring-[#1F429B]/20 bg-white dark:bg-slate-800 text-[#06244A] dark:text-white shadow-xs'
                : startDate
                ? 'border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#06244A] dark:text-white hover:border-slate-300'
                : 'border-[#D9E2EF] dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-400 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#1F429B] shrink-0" />
            <span className="font-semibold truncate max-w-[140px] sm:max-w-none">
              {startDate ? formatReadableDate(startDate) : 'Select start date'}
            </span>
          </button>
        </div>

        <span className="text-[#60728F] font-medium select-none">to</span>

        {/* End Date Button */}
        <div className="flex items-center gap-1.5">
          {endLabel && (
            <span className="font-bold text-[#60728F] dark:text-slate-400 select-none">
              {endLabel}:
            </span>
          )}
          <button
            type="button"
            onClick={() => openPicker('end')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left cursor-pointer select-none ${
              activePicker === 'end'
                ? 'border-[#1F429B] ring-2 ring-[#1F429B]/20 bg-white dark:bg-slate-800 text-[#06244A] dark:text-white shadow-xs'
                : endDate
                ? 'border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#06244A] dark:text-white hover:border-slate-300'
                : 'border-[#D9E2EF] dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-400 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#1F429B] shrink-0" />
            <span className="font-semibold truncate max-w-[140px] sm:max-w-none">
              {endDate ? formatReadableDate(endDate) : 'Select end date'}
            </span>
          </button>
        </div>

        {/* Reset / Clear Button */}
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleFullReset}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#C62828] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Reset date filter"
          >
            <X className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Interactive Calendar Popover */}
      {activePicker && (
        <div
          className="absolute left-0 top-full mt-2 z-50 w-72 sm:w-80 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 shadow-xl animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Calendar Header: Month/Year & Navigation */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#1F429B]">
                {activePicker === 'start' ? 'Select Start Date' : 'Select End Date'}
              </span>
              <span className="text-sm font-bold text-[#06244A] dark:text-white">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#06244A] hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#06244A] hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="text-[11px] font-bold text-[#60728F] dark:text-slate-400 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days of Month Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty padding days for first week */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-8 w-8" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateISO = toISODate(viewYear, viewMonth, day);

              // Checks
              const isSelectedStart = startDate === dateISO;
              const isSelectedEnd = endDate === dateISO;
              const isSelected = isSelectedStart || isSelectedEnd;
              const isInRange =
                startDate &&
                endDate &&
                dateISO > startDate &&
                dateISO < endDate;
              const isToday = todayISO === dateISO;

              // If picking End Date, disable dates earlier than startDate
              const isDisabled = activePicker === 'end' && startDate && dateISO < startDate;

              let dayClasses = 'h-8 w-8 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition-all relative ';

              if (isDisabled) {
                dayClasses += 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40';
              } else if (isSelected) {
                dayClasses += 'bg-[#1F429B] text-white font-bold shadow-xs cursor-pointer';
              } else if (isInRange) {
                dayClasses += 'bg-[#1F429B]/15 text-[#1F429B] dark:text-blue-300 font-bold cursor-pointer rounded-none first:rounded-l-lg last:rounded-r-lg';
              } else {
                dayClasses += 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer';
              }

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(dateISO)}
                  className={dayClasses}
                  title={dateISO}
                >
                  <span>{day}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#1F429B] dark:bg-blue-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Range Helper / Selection Info */}
          {startDate && activePicker === 'end' && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
              Start Date: <span className="font-bold text-[#06244A] dark:text-white">{formatReadableDate(startDate)}</span>
            </div>
          )}

          {/* Footer Actions: Today, Clear, Close */}
          <div className="mt-3 pt-2.5 border-t border-[#D9E2EF] dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-700 dark:hover:bg-slate-600 text-[11px] font-bold text-[#06244A] dark:text-white transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleClearActive}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActivePicker(null)}
              className="px-3 py-1 rounded-lg bg-[#1F429B] hover:bg-[#153A87] text-[11px] font-bold text-white transition-colors cursor-pointer shadow-2xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
