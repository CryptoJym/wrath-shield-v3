/**
 * List Motion workspaces using MOTION_API_KEY.
 *
 * Usage:
 *   npx tsx scripts/motion-list-workspaces.ts
 */

import fetch from 'node-fetch';

async function main() {
  const apiKey = process.env.MOTION_API_KEY;
  const base = process.env.MOTION_API_BASE || 'https://api.usemotion.com/v1';
  if (!apiKey) throw new Error('MOTION_API_KEY not set');

  const resp = await fetch(`${base}/workspaces`, {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Motion /workspaces failed ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
