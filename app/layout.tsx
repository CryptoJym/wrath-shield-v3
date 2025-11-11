/**
 * Wrath Shield v3 - Root Layout
 *
 * Provides the base HTML structure and global styling for the application.
 */

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import '../styles/power.css';

// Configure Inter font for body text
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Configure JetBrains Mono for code/monospace text
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={inter.className}>
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
          padding: '0.75rem 1rem'
        }}>
          <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href="/" style={{ fontWeight: 600 }}>Wrath Shield v3</a>
            <a href="/chat" style={{ color: 'var(--color-text-secondary)' }}>Agentic Grok Chat</a>
            <a href="/eeg" style={{ color: 'var(--color-text-secondary)' }}>EEG Dashboard</a>
          </nav>
        </header>
        <main style={{ padding: '1rem' }}>{children}</main>
      </body>
    </html>
  );
}
