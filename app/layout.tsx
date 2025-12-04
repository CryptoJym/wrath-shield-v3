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
            <a href="/chat" style={{ color: 'var(--color-text-secondary)' }}>Orchestrator</a>
            <a href="/agents/roster" style={{ color: 'var(--color-text-secondary)' }}>Team Roster</a>
            <a href="/inbox" style={{ color: 'var(--color-text-secondary)' }}>Inbox</a>
            <a href="/pm" style={{ color: 'var(--color-text-secondary)' }}>PM</a>
            <a href="/finance" style={{ color: 'var(--color-text-secondary)' }}>Finance</a>
            <a href="/comms" style={{ color: 'var(--color-text-secondary)' }}>Comms</a>
            <a href="/hyro" style={{ color: 'var(--color-text-secondary)' }}>Education</a>
            <a href="/eeg" style={{ color: 'var(--color-text-secondary)' }}>EEG</a>
            <a href="/feed" style={{ color: 'var(--color-text-secondary)' }}>Feed</a>
            <a href="/tasks" style={{ color: 'var(--color-text-secondary)' }}>Tasks</a>
            <a href="/legal" style={{ color: 'var(--color-text-secondary)' }}>Legal Advisor</a>
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
