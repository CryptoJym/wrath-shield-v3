/**
 * Wrath Shield v3 - Root Layout
 *
 * Provides the base HTML structure and global styling for the application.
 */

import type { Metadata } from 'next';
import './globals.css';
import '../styles/power.css';
import { ClerkProvider, UserButton } from '@clerk/nextjs';

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
    <body style={{ overflowX: 'hidden' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0.75rem 1rem'
      }}>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href="/" style={{ fontWeight: 600 }}>Wrath Shield v3</a>
            <a href="/chat" style={{ color: 'var(--color-text-secondary)' }}>Agentic Grok Chat</a>
            <a href="/inbox" style={{ color: 'var(--color-text-secondary)' }}>Inbox</a>
            <a href="/finance" style={{ color: 'var(--color-text-secondary)' }}>Finance</a>
            <a href="/eeg" style={{ color: 'var(--color-text-secondary)' }}>EEG</a>
            <a href="/feed" style={{ color: 'var(--color-text-secondary)' }}>Feed</a>
            <a href="/tasks" style={{ color: 'var(--color-text-secondary)' }}>Tasks</a>
            <a href="/privacy" style={{ color: 'var(--color-text-secondary)' }}>Privacy</a>
          </div>
          {hasClerk ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          ) : null}
        </nav>
      </header>
      <main style={{ padding: '1rem' }}>{children}</main>
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
