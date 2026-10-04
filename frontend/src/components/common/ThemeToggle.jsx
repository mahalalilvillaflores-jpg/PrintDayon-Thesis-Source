import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ className = '', variant = 'icon', showLabel = false }) {
  const { isDark, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 ${className}`}
      >
        {isDark ? (
          <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-[18px] md:h-[18px] text-amber-400" />
        ) : (
          <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-[18px] md:h-[18px] text-gray-600 dark:text-gray-300" />
        )}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {showLabel && (
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={toggleTheme}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
          isDark ? 'bg-teal-600' : 'bg-slate-300'
        }`}
      >
        <span className="sr-only">Toggle dark mode</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            isDark ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
