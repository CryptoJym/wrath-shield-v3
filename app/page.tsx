/**
 * Wrath Shield v3 - Home/Dashboard Page
 *
 * Main dashboard displaying WHOOP metrics, manipulation detection results,
 * and coaching insights.
 *
 * Features:
 * - Server-side rendering for initial load
 * - Client-side data fetching from /api/metrics
 * - Today's metrics, 7-day trends, and 30-day trends
 * - Unbending score tracking
 */

import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Wrath Shield v3</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Personal development dashboard combining biometric tracking and assertiveness
          coaching
        </p>
      </header>

      <Dashboard />
    </div>
  );
}
