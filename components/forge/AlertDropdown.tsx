'use client';

/**
 * HYRO FORGE: Alert Dropdown Component
 * Dropdown showing recent alerts with actions
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlertItem } from './AlertItem';
import type { Alert } from '@/lib/hyro/forge-alerts';

interface AlertDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  maxAlerts?: number;
  className?: string;
}

export function AlertDropdown({
  isOpen,
  onClose,
  maxAlerts = 10,
  className = '',
}: AlertDropdownProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch alerts when opened
  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, filter]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const unreadOnly = filter === 'unread';
      const response = await fetch(
        `/api/hyro/alerts?unread_only=${unreadOnly}&limit=${maxAlerts}`
      );

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('[AlertDropdown] Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const response = await fetch('/api/hyro/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'read' }),
      });

      if (response.ok) {
        // Update local state
        setAlerts(prev =>
          prev.map(alert =>
            alert.id === id ? { ...alert, read_at: Math.floor(Date.now() / 1000) } : alert
          )
        );
      }
    } catch (error) {
      console.error('[AlertDropdown] Failed to mark as read:', error);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const response = await fetch('/api/hyro/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'dismiss' }),
      });

      if (response.ok) {
        // Remove from local state
        setAlerts(prev => prev.filter(alert => alert.id !== id));
      }
    } catch (error) {
      console.error('[AlertDropdown] Failed to dismiss alert:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch('/api/hyro/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });

      if (response.ok) {
        // Refresh alerts
        fetchAlerts();
      }
    } catch (error) {
      console.error('[AlertDropdown] Failed to mark all read:', error);
    }
  };

  const handleAlertClick = (alert: Alert) => {
    if (alert.action_url) {
      window.location.href = alert.action_url;
      onClose();
    }
  };

  if (!isOpen) return null;

  const unreadCount = alerts.filter(a => !a.read_at).length;

  return (
    <div
      ref={dropdownRef}
      className={`
        absolute right-0 mt-2 w-96 max-h-[600px] bg-gray-800 rounded-lg shadow-2xl border border-gray-700 overflow-hidden z-50
        ${className}
      `}
    >
      {/* Header */}
      <div className="bg-gray-900 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-white">Notifications</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unread')}
            className={`
              px-3 py-1 text-sm rounded transition-colors
              ${filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            `}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`
              px-3 py-1 text-sm rounded transition-colors
              ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            `}
          >
            All
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="ml-auto px-3 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg
              className="w-16 h-16 text-gray-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-400">
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {alerts.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onRead={handleMarkRead}
                onDismiss={handleDismiss}
                onClick={handleAlertClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="bg-gray-900 px-4 py-3 border-t border-gray-700">
          <a
            href="/hyro/forge/alerts"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            onClick={onClose}
          >
            View all notifications →
          </a>
        </div>
      )}
    </div>
  );
}
