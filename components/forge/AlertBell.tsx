'use client';

/**
 * HYRO FORGE: Alert Bell Component
 * Notification bell icon with unread count badge
 * Triggers dropdown when clicked
 */

import React, { useState, useEffect } from 'react';

interface AlertBellProps {
  onToggle?: (isOpen: boolean) => void;
  className?: string;
}

export function AlertBell({ onToggle, className = '' }: AlertBellProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Fetch unread count
  useEffect(() => {
    fetchUnreadCount();

    // Poll every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/hyro/alerts?count_only=true');
      if (response.ok) {
        const data = await response.json();
        const newCount = data.count || 0;

        // Animate if count increased
        if (newCount > unreadCount) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 500);
        }

        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('[AlertBell] Failed to fetch unread count:', error);
    }
  };

  const handleClick = () => {
    onToggle?.(true);
  };

  return (
    <button
      onClick={handleClick}
      className={`relative p-2 rounded-lg hover:bg-gray-700 transition-colors ${className}`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      {/* Bell icon */}
      <svg
        className={`w-6 h-6 text-gray-300 ${isAnimating ? 'animate-bounce' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full border-2 border-gray-900">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
