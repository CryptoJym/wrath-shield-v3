'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, Clock, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type CycleOption = {
  start: string;
  end: string;
  label: string;
  status: 'current' | 'closed';
  reimbursable: number;
  total: number;
  count: number;
  report_id?: string;
  report_status?: string;
};

type QuickRange = {
  key: string;
  label: string;
  days?: number;
};

const QUICK_RANGES: QuickRange[] = [
  { key: 'last30', label: 'Last 30 days', days: 30 },
  { key: 'last90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All data' },
];

interface CycleSelectorProps {
  cycles: CycleOption[];
  selectedCycle: CycleOption | null;
  selectedRange: string | null;
  onSelectCycle: (cycle: CycleOption) => void;
  onSelectRange: (range: string) => void;
  isLoading?: boolean;
}

export function CycleSelector({
  cycles,
  selectedCycle,
  selectedRange,
  onSelectCycle,
  onSelectRange,
  isLoading,
}: CycleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = selectedRange
    ? QUICK_RANGES.find(r => r.key === selectedRange)?.label || 'Select range'
    : selectedCycle?.label || 'Select cycle';

  const currentCycle = cycles.find(c => c.status === 'current');

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Calendar className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-50">Select Expense Cycle</h2>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-50 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <span className="flex items-center gap-2">
            {selectedCycle?.status === 'current' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                Current
              </span>
            )}
            <span className="font-medium">{displayLabel}</span>
            {selectedCycle && !selectedRange && (
              <span className="text-slate-400 text-sm">
                ({selectedCycle.count} txns)
              </span>
            )}
          </span>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="max-h-[400px] overflow-y-auto">
                {/* Quick Ranges */}
                <div className="p-2 border-b border-slate-800">
                  <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Quick Ranges
                  </p>
                  {QUICK_RANGES.map(range => (
                    <button
                      key={range.key}
                      onClick={() => {
                        onSelectRange(range.key);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                        selectedRange === range.key
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {range.label}
                      </span>
                      {selectedRange === range.key && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>

                {/* Expense Cycles */}
                <div className="p-2">
                  <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Expense Cycles (8th to 8th)
                  </p>
                  {cycles.map(cycle => (
                    <button
                      key={`${cycle.start}-${cycle.end}`}
                      onClick={() => {
                        onSelectCycle(cycle);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        selectedCycle?.start === cycle.start && !selectedRange
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cycle.label}</span>
                            {cycle.status === 'current' && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 rounded">
                                CURRENT
                              </span>
                            )}
                            {cycle.report_id && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 rounded flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {cycle.report_status === 'submitted' ? 'SUBMITTED' : 'REPORT'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {cycle.count} transactions
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-emerald-400">
                            ${cycle.reimbursable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-500">reimbursable</p>
                        </div>
                        {selectedCycle?.start === cycle.start && !selectedRange && (
                          <Check className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Range Buttons */}
      <div className="flex gap-2 mt-4">
        {QUICK_RANGES.map(range => (
          <button
            key={range.key}
            onClick={() => onSelectRange(range.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedRange === range.key
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            {range.label}
          </button>
        ))}
        {currentCycle && selectedRange && (
          <button
            onClick={() => onSelectCycle(currentCycle)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            Current Cycle
          </button>
        )}
      </div>
    </div>
  );
}
