import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Info } from 'lucide-react';

export default function MapLegend({
  mode = 'dropdown',
  className = '',
  activeTravelMode = 'motor',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const legendItems = [
    {
      type: 'user',
      label: 'Your Location',
      icon: (
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 border border-white" />
        </span>
      ),
      subtext: 'Current GPS / Custom Pin',
    },
    {
      type: 'recommended',
      label: 'Recommended Shop',
      icon: (
        <span className="flex items-center justify-center text-[#F59E0B] text-xs font-bold leading-none">
          ★
        </span>
      ),
      subtext: 'Fastest Ready Time',
    },
    {
      type: 'shop-status',
      label: 'Shop Status',
      icon: (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#2563EB] inline-block" title="Open" />
          <span className="w-2 h-2 rounded-full bg-[#F59E0B] inline-block" title="Moderate Queue" />
          <span className="w-2 h-2 rounded-full bg-[#DC2626] inline-block" title="Busy" />
        </span>
      ),
      subtext: 'Open • Moderate • Busy',
    },
    {
      type: 'driving-route',
      label: 'Driving / Motor Route',
      icon: (
        <span
          className="inline-block w-5 h-1 rounded-full bg-[#2563EB]"
          style={{ boxShadow: '0 0 2px rgba(37, 99, 235, 0.8)' }}
        />
      ),
      subtext: 'Solid navigation road line',
      isActive: activeTravelMode === 'motor' || activeTravelMode === 'vehicle',
    },
    {
      type: 'walking-route',
      label: 'Walking Route',
      icon: (
        <span
          className="inline-block w-5 h-0.5 border-t-2 border-dashed border-[#0D9488]"
          style={{ minWidth: '20px' }}
        />
      ),
      subtext: 'Dashed pedestrian footpath',
      isActive: activeTravelMode === 'walking',
    },
  ];

  if (mode === 'inline') {
    return (
      <div
        className={`
          flex items-center flex-wrap gap-2.5 px-3 py-1.5 
          bg-white/95 dark:bg-gray-900/95 
          backdrop-blur-md rounded-full 
          border border-gray-200/80 dark:border-gray-800 
          shadow-sm text-[11px] font-medium 
          text-gray-700 dark:text-gray-300 select-none
          ${className}
        `}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
          <span className="text-[10px] text-gray-700 dark:text-gray-200">You</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-amber-500 text-xs leading-none">★</span>
          <span className="text-[10px] text-gray-700 dark:text-gray-200">Recommended</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-[10px] text-gray-700 dark:text-gray-200">Open</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          <span className="text-[10px] text-gray-700 dark:text-gray-200">Busy</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Closed</span>
        </div>

        <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-2">
          <div className="flex items-center gap-1">
            <span className="inline-block w-3.5 h-0.5 bg-blue-600 rounded-full" />
            <span className="text-[10px] text-gray-600 dark:text-gray-300">Drive</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-3.5 border-t border-dashed border-teal-600" />
            <span className="text-[10px] text-gray-600 dark:text-gray-300">Walk</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="
          flex items-center gap-1.5
          rounded-xl
          border border-slate-200/90 dark:border-[#1E355B]
          bg-white/95 dark:bg-[#0F1E38]/95
          px-2.5 py-1.5
          text-[11px] font-bold text-slate-700 dark:text-slate-200
          shadow-md
          backdrop-blur-md
          transition
          hover:bg-white dark:hover:bg-[#132442]
          cursor-pointer
        "
        title="View Map Legend"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] inline-block" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] inline-block" />
        </span>
        <span>Legend</span>
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#2563EB]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-1.5
            w-60
            rounded-2xl
            border border-slate-200/90 dark:border-[#1E355B]
            bg-white/98 dark:bg-[#0F1E38]/98
            p-3
            shadow-xl
            backdrop-blur-md
            z-50
            animate-in fade-in zoom-in-95 duration-150
          "
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-[#1E355B]">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Map Legend
            </span>
            <span className="text-[9px] font-semibold text-slate-400">Naval, Biliran</span>
          </div>

          <div className="space-y-2">
            {legendItems.map((item) => (
              <div
                key={item.type}
                className={`
                  flex items-center justify-between
                  rounded-lg px-2 py-1.5
                  transition-colors
                  ${
                    item.isActive
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }
                `}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center justify-center w-5 h-4 shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {item.label}
                    </div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-400 leading-tight">
                      {item.subtext}
                    </div>
                  </div>
                </div>

                {item.isActive && (
                  <span className="text-[8px] font-extrabold uppercase tracking-wider bg-blue-600 text-white px-1.5 py-0.5 rounded-full shrink-0">
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
