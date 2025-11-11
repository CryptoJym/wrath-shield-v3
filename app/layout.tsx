/**
 * Wrath Shield v3 - Root Layout
 *
 * Provides the base HTML structure and global styling for the application.
 */

import type { Metadata } from 'next';
import './globals.css';
import '../styles/power.css';

export const metadata: Metadata = {
  title: 'Wrath Shield v3',
  description: 'Personal development dashboard combining WHOOP metrics and manipulation detection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
          padding: '0.75rem 1rem'
        }}>
          <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href="/" style={{ fontWeight: 600 }}>Wrath Shield v3</a>
            <a href="/chat" style={{ color: 'var(--color-text-secondary)' }}>Agentic Grok Chat</a>
            <a href="/eeg" style={{ color: 'var(--color-text-secondary)' }}>EEG Dashboard</a>
            <a href="/feed" style={{ color: 'var(--color-text-secondary)' }}>Feed</a>
            <a href="/users/default" style={{ color: 'var(--color-text-secondary)' }}>Default User</a>
          </nav>
        </header>
        <main style={{ padding: '1rem' }}>{children}</main>
      </body>
    </html>
  );
}
