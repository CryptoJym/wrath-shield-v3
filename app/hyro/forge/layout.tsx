'use client';

/**
 * HYRO FORGE: Layout with Kid-Friendly Navigation
 *
 * Wraps all HYRO Forge pages with consistent navigation that's
 * colorful, icon-rich, and easy for any age to use.
 */

import { ForgeNav } from '@/components/hyro/ForgeNav';

export default function ForgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <ForgeNav />
      {children}
    </div>
  );
}
