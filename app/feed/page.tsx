"use client";
import { useEffect, useState } from "react";

type Metric = {
  date: string;
  strain: number | null;
  recovery_score: number | null;
  sleep_performance: number | null;
  manipulation_count: number;
  wrath_deployed: number;
  unbending_score: number | null;
};

export default function FeedPage() {
  const [defaultUserId, setDefaultUserId] = useState<string>("default");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [anchors, setAnchors] = useState<any[]>([]);

  async function load() {
    const d = await fetch("/api/users/default").then((r) => r.json());
    const uid = d?.defaultUserId || 'default';
    setDefaultUserId(uid);
    const res = await fetch(`/api/feed?userId=${encodeURIComponent(uid)}`);
    const data = await res.json();
    setMetrics(data.metrics || []);
    setAnchors(data.anchors || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Feed</h1>
      <p>User: <code>{defaultUserId}</code></p>

      <h2>Last 7 Days</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Recovery</th>
            <th style={th}>Strain</th>
            <th style={th}>Sleep %</th>
            <th style={th}>Manipulations</th>
            <th style={th}>Wrath</th>
            <th style={th}>Unbending</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.date}>
              <td style={td}>{m.date}</td>
              <td style={td}>{m.recovery_score ?? '-'}</td>
              <td style={td}>{m.strain ?? '-'}</td>
              <td style={td}>{m.sleep_performance ?? '-'}</td>
              <td style={td}>{m.manipulation_count}</td>
              <td style={td}>{m.wrath_deployed}</td>
              <td style={td}>{m.unbending_score?.toFixed?.(1) ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Anchors</h2>
      <ul>
        {anchors.map((a) => (
          <li key={a.id || a.memory_id}>
            <strong>{a?.metadata?.date ?? ''}</strong> — {a.text ?? a.memory}
            {a?.metadata?.category ? <em> [{a.metadata.category}]</em> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const th: React.CSSProperties = { border: '1px solid #ddd', padding: 8, textAlign: 'left' };
const td: React.CSSProperties = { border: '1px solid #eee', padding: 8 };

