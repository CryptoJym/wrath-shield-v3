/**
 * Wrath Shield v3 - Root Layout
 *
 * Provides the base HTML structure and global styling for the application.
 */

import type { Metadata } from 'next';
import './globals.css';

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
        <main>{children}</main>
      </body>
    </html>
  );
}
