'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  ChevronDown,
  Edit3,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
} from 'lucide-react';

type Transaction = {
  id: string;
  date: string;
  vendor?: string;
  raw_desc?: string;
  amount: number;
  bucket?: string;
  reimbursable: boolean;
  assignee?: string;
  usage_note?: string;
  company?: string;
  project?: string;
  status?: string;
  confidence?: number;
};

// Extract clean merchant info from Plaid raw_desc
function extractMerchantInfo(rawDesc?: string): { category?: string; paymentMethod?: string } {
  if (!rawDesc) return {};
  try {
    const data = JSON.parse(rawDesc);
    const category = data.personal_finance_category?.primary?.replace(/_/g, ' ').toLowerCase();
    const paymentChannel = data.payment_channel;
    return {
      category: category ? category.charAt(0).toUpperCase() + category.slice(1) : undefined,
      paymentMethod: paymentChannel === 'online' ? 'Online' : paymentChannel === 'in store' ? 'In Store' : undefined,
    };
  } catch {
    return {};
  }
}

interface ReimbursementTableProps {
  transactions: Transaction[];
  assignees: string[];
  companies: string[];
  onUpdate: () => void;
}

export default function ReimbursementTable({
  transactions,
  assignees,
  companies,
  onUpdate,
}: ReimbursementTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'assignee' | 'usage_note' | 'company' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const updateTransaction = useCallback(
    async (id: string, updates: Record<string, any>) => {
      setSavingId(id);
      try {
        const res = await fetch(`/api/finance/transactions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('Failed to update');
        onUpdate();
      } catch (e) {
        console.error('Update error:', e);
      } finally {
        setSavingId(null);
        setEditingId(null);
        setEditingField(null);
      }
    },
    [onUpdate]
  );

  const bulkUpdate = useCallback(
    async (updates: Record<string, any>) => {
      if (selectedIds.size === 0) return;
      setSavingId('bulk');
      try {
        const res = await fetch('/api/finance/transactions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            updates,
          }),
        });
        if (!res.ok) throw new Error('Failed to bulk update');
        setSelectedIds(new Set());
        onUpdate();
      } catch (e) {
        console.error('Bulk update error:', e);
      } finally {
        setSavingId(null);
      }
    },
    [selectedIds, onUpdate]
  );

  const toggleReimbursable = (txn: Transaction) => {
    updateTransaction(txn.id, { reimbursable: !txn.reimbursable });
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatAmount = (amount: number) => {
    const isRefund = amount < 0;
    const formatted = `$${Math.abs(amount).toFixed(2)}`;
    return isRefund ? `-${formatted}` : formatted;
  };

  const isRefund = (amount: number) => amount < 0;

  const getBucketBadge = (bucket?: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      work_reimbursable: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'AI/SaaS' },
      personal_ai: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Personal AI' },
      family: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Family' },
      entertainment: { bg: 'bg-pink-500/10', text: 'text-pink-400', label: 'Entertainment' },
      other: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Other' },
    };
    const badge = badges[bucket || 'other'] || badges.other;
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        No transactions found for this filter.
      </div>
    );
  }

  return (
    <div>
      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between"
          >
            <span className="text-sm text-slate-300">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => bulkUpdate({ reimbursable: true })}
                disabled={savingId === 'bulk'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Reimbursable
              </button>
              <button
                onClick={() => bulkUpdate({ reimbursable: false })}
                disabled={savingId === 'bulk'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                <XCircle className="w-4 h-4" />
                Mark Non-Reimbursable
              </button>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    bulkUpdate({ assignee: e.target.value });
                  }
                }}
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm border-0 focus:ring-1 focus:ring-emerald-500"
                defaultValue=""
              >
                <option value="">Set Assignee...</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === transactions.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Assignee
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Usage Note
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                Reimb?
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {transactions.map((txn) => {
              const isEditing = editingId === txn.id;
              const isSaving = savingId === txn.id;

              return (
                <motion.tr
                  key={txn.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`hover:bg-slate-800/50 transition-colors ${
                    txn.reimbursable ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(txn.id)}
                      onChange={() => toggleSelect(txn.id)}
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {formatDate(txn.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-200">
                      {txn.vendor || 'Unknown'}
                    </div>
                    {(() => {
                      const info = extractMerchantInfo(txn.raw_desc);
                      const parts = [];
                      if (info.category) parts.push(info.category);
                      if (info.paymentMethod) parts.push(info.paymentMethod);
                      if (txn.project) parts.push(txn.project.replace(/_/g, ' '));
                      return parts.length > 0 ? (
                        <div className="text-xs text-slate-500">
                          {parts.join(' • ')}
                        </div>
                      ) : null;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${isRefund(txn.amount) ? 'text-red-400' : 'text-slate-200'}`}>
                      {formatAmount(txn.amount)}
                      {isRefund(txn.amount) && <span className="ml-1 text-xs text-red-400/70">(refund)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getBucketBadge(txn.bucket)}</td>
                  <td className="px-4 py-3">
                    {isEditing && editingField === 'company' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          if (editValue !== txn.company) {
                            updateTransaction(txn.id, { company: editValue || null });
                          } else {
                            setEditingId(null);
                            setEditingField(null);
                          }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">None</option>
                        {companies.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(txn.id);
                          setEditingField('company');
                          setEditValue(txn.company || '');
                        }}
                        className="text-sm text-slate-300 hover:text-slate-100 flex items-center gap-1 group"
                      >
                        {txn.company ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {txn.company}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Assign...</span>
                        )}
                        <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing && editingField === 'assignee' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          if (editValue !== txn.assignee) {
                            updateTransaction(txn.id, { assignee: editValue });
                          } else {
                            setEditingId(null);
                            setEditingField(null);
                          }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">Select...</option>
                        {assignees.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(txn.id);
                          setEditingField('assignee');
                          setEditValue(txn.assignee || '');
                        }}
                        className="text-sm text-slate-300 hover:text-slate-100 flex items-center gap-1 group"
                      >
                        {txn.assignee || (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                        <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing && editingField === 'usage_note' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateTransaction(txn.id, { usage_note: editValue });
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditingField(null);
                            }
                          }}
                          autoFocus
                          placeholder="Add note..."
                          className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        <button
                          onClick={() => updateTransaction(txn.id, { usage_note: editValue })}
                          className="p-1 hover:bg-slate-700 rounded"
                        >
                          <Save className="w-4 h-4 text-emerald-400" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(txn.id);
                          setEditingField('usage_note');
                          setEditValue(txn.usage_note || '');
                        }}
                        className="text-sm text-slate-300 hover:text-slate-100 flex items-center gap-1 group max-w-xs"
                      >
                        {txn.usage_note ? (
                          <span className="truncate">{txn.usage_note}</span>
                        ) : (
                          <span className="text-slate-500 italic">Add note...</span>
                        )}
                        <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleReimbursable(txn)}
                      disabled={isSaving}
                      className={`p-1.5 rounded-lg transition-colors ${
                        txn.reimbursable
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : txn.reimbursable ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="bg-slate-800/50 px-4 py-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Showing {transactions.length} transactions
        </span>
        <span className="text-emerald-400 font-medium">
          Total Reimbursable: $
          {transactions
            .filter((t) => t.reimbursable)
            .reduce((sum, t) => sum + t.amount, 0)
            .toFixed(2)}
        </span>
      </div>
    </div>
  );
}
