'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CycleOption } from './CycleSelector';

type VendorStat = {
  vendor: string;
  total: number;
  count: number;
  reimbursable: boolean;
};

interface TopVendorsCardProps {
  vendors: VendorStat[];
  cycles: CycleOption[];
  selectedCycleLabel: string;
  onSelectCycle: (start: string, end: string) => void;
  onSelectAllTime: () => void;
  isAllTime: boolean;
  isLoading?: boolean;
}

export function TopVendorsCard({
  vendors,
  cycles,
  selectedCycleLabel,
  onSelectCycle,
  onSelectAllTime,
  isAllTime,
  isLoading,
}: TopVendorsCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedVendors = [...vendors].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).slice(0, 10);

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-50">Top Vendors</h2>
        </div>

        {/* Cycle Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-800/60 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <span>{isAllTime ? 'All time' : selectedCycleLabel}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="max-h-80 overflow-y-auto">
                  {/* All time option */}
                  <button
                    onClick={() => {
                      onSelectAllTime();
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b border-slate-800 transition-colors ${
                      isAllTime ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">All time</span>
                    {isAllTime && <Check className="w-4 h-4" />}
                  </button>

                  {/* Cycles */}
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Expense Cycles
                    </p>
                    {cycles.map(cycle => (
                      <button
                        key={`${cycle.start}-${cycle.end}`}
                        onClick={() => {
                          onSelectCycle(cycle.start, cycle.end);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                          selectedCycleLabel === cycle.label && !isAllTime
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium">{cycle.label}</span>
                          <span className="text-xs text-slate-500">{cycle.count} txns</span>
                        </div>
                        {selectedCycleLabel === cycle.label && !isAllTime && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Vendors Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-slate-800/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sortedVendors.length === 0 ? (
        <div className="text-center py-8">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No vendor data available</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Txns
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Reimb.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedVendors.map((vendor, idx) => (
                <motion.tr
                  key={vendor.vendor}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-200">{vendor.vendor}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${vendor.reimbursable ? 'text-emerald-400' : 'text-slate-300'}`}>
                      ${Math.abs(vendor.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-slate-400">{vendor.count}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {vendor.reimbursable ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-500 mx-auto" />
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
