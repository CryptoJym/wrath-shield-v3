"use client";
import { useEffect } from 'react';

export interface GlobalShortcutsProps {
  onReplace?: () => void; // Alt+R
  onForge?: () => void;   // Alt+F
}

export default function GlobalShortcuts({ onReplace, onForge }: GlobalShortcutsProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        onReplace?.();
      } else if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        onForge?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onReplace, onForge]);
  return null;
}
