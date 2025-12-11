/**
 * Wrath Shield v3 - Root Layout
 *
 * Provides the base HTML structure and global styling for the application.
 */

import type { Metadata } from 'next';
import './globals.css';
import '../styles/power.css';
import { ClerkProvider, UserButton } from '@clerk/nextjs';
import { Navigation } from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Wrath Shield v3',
  description: 'Personal development dashboard combining WHOOP metrics and manipulation detection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY;

  const Shell = (
    <body className="overflow-x-hidden min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Navigation with optional Clerk UserButton */}
      <div className="relative">
        <Navigation />
        {hasClerk && (
          <div className="absolute top-3 right-4 z-50">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-7xl mx-auto">
        {children}
      </main>
    </body>
  );

  if (hasClerk) {
    return (
      <ClerkProvider>
        <html lang="en">{Shell}</html>
      </ClerkProvider>
    );
  }

  return (
    <html lang="en">
      {Shell}
    </html>
  );
}
