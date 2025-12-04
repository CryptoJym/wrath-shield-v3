'use client';

/**
 * HYRO FORGE: Alert Item Component
 * Displays a single alert with priority styling
 */

import React from 'react';
import type { Alert } from '@/lib/hyro/forge-alerts';

interface AlertItemProps {
  alert: Alert;
  onRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onClick?: (alert: Alert) => void;
  showActions?: boolean;
}

export function AlertItem({
  alert,
  onRead,
  onDismiss,
  onClick,
  showActions = true,
}: AlertItemProps) {
  const isUnread = !alert.read_at;

  // Priority colors
  const priorityColors = {
    high: 'border-red-500 bg-red-500/5',
    medium: 'border-yellow-500 bg-yellow-500/5',
    low: 'border-blue-500 bg-blue-500/5',
  };

  const priorityIcons = {
    high: '🔴',
    medium: '🟡',
    low: '🔵',
  };

  // Type icons
  const typeIcons: Record<string, string> = {
    streak_at_risk: '🔥',
    streak_milestone: '🎉',
    session_complete: '✅',
    level_up: '⬆️',
    achievement_earned: '🏆',
    weekly_report: '📊',
    growth_opportunity: '📈',
    quest_reminder: '⏰',
  };

  const handleClick = () => {
    if (isUnread && onRead) {
      onRead(alert.id);
    }
    if (alert.action_url && onClick) {
      onClick(alert);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(alert.id);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`
        relative p-4 border-l-4 rounded-r-lg cursor-pointer transition-all
        ${priorityColors[alert.priority]}
        ${isUnread ? 'bg-opacity-100' : 'bg-opacity-50 opacity-75'}
        hover:bg-opacity-100 hover:opacity-100
      `}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1">
          {/* Type icon */}
          <span className="text-xl flex-shrink-0">
            {typeIcons[alert.type] || '📢'}
          </span>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold text-white ${isUnread ? '' : 'opacity-75'}`}>
              {alert.title}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatTimestamp(alert.created_at)}
            </p>
          </div>
        </div>

        {/* Unread indicator */}
        {isUnread && (
          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1"></span>
        )}
      </div>

      {/* Message */}
      <p className="text-sm text-gray-300 mb-3 pl-7">
        {alert.message}
      </p>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 pl-7">
          {alert.action_url && (
            <span className="text-xs text-blue-400 hover:text-blue-300">
              View Details →
            </span>
          )}

          {!alert.dismissed && (
            <button
              onClick={handleDismiss}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
