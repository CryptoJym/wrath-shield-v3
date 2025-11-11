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

async function getSystemStatus() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/system/status`, { cache: 'no-store' });
    return await res.json();
  } catch {
    // Fallback: try relative path (works in dev)
    try {
      const res2 = await fetch(`/api/system/status`, { cache: 'no-store' });
      return await res2.json();
    } catch {
      return null;
    }
  }
}

export default async function Home() {
  const status = await getSystemStatus();

  return (
    <div>
      <header style={{ marginBottom: '1rem' }}>
        <h1>Wrath Shield v3</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Personal development dashboard combining biometric tracking and assertiveness coaching
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: '1rem' }}>
        <div className="card">
          <div className="text-secondary">Agentic Grok</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {status?.agentic?.status ?? 'unknown'}
          </div>
          <div className="text-secondary" style={{ marginTop: 4 }}>
            Model: {status?.agentic?.model ?? '-'}
          </div>
          <div className="text-secondary" style={{ marginTop: 4 }}>
            Tools: {Array.isArray(status?.agentic?.tools) ? status.agentic.tools.length : 0}
          </div>
          <div style={{ marginTop: 8 }}>
            <a className="btn" href="/chat">Open Chat</a>
          </div>
        </div>

        <div className="card">
          <div className="text-secondary">Database (TimescaleDB)</div>
          {status?.db ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>EEG tokens: {status.db.eeg_tokens?.row_count ?? '-'}</li>
              <li>WHOOP metrics: {status.db.whoop_metrics?.row_count ?? '-'}</li>
              <li>Life logs: {status.db.limitless_events?.row_count ?? '-'}</li>
              <li>Chat logs: {status.db.chat_logs?.row_count ?? '-'}</li>
            </ul>
          ) : (
            <div className="text-secondary">Unavailable</div>
          )}
        </div>

        <div className="card">
          <div className="text-secondary">EEG Dashboard</div>
          <div style={{ marginTop: 8 }}>
            <a className="btn" href="/eeg">Open EEG Dashboard</a>
          </div>
        </div>

        <div className="card">
          <div className="text-secondary">Feed</div>
          <div style={{ marginTop: 8 }}>
            <a className="btn" href="/feed">Open Feed</a>
          </div>
        </div>

        <div className="card">
          <div className="text-secondary">Default User</div>
          <div style={{ marginTop: 8 }}>
            <a className="btn" href="/users/default">Manage Default User</a>
          </div>
        </div>
      </section>

      <Dashboard />
    </div>
  );
}
