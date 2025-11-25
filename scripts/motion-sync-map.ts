/**
 * Refresh MOTION_WORKSPACE_MAP in .env.local by merging current entries with live workspaces.
 *
 * - Keeps existing mappings where possible.
 * - Adds new workspaces with empty values so you can fill manually.
 * - Leaves MOTION_WORKSPACE_ID untouched.
 *
 * Usage:
 *   npx tsx scripts/motion-sync-map.ts
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import fetch from 'node-fetch';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const MOTION_BASE = process.env.MOTION_API_BASE || 'https://api.usemotion.com/v1';

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  return fs
    .readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .reduce((acc, line) => {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) acc[m[1]] = m[2];
      return acc;
    }, {} as Record<string, string>);
}

function saveEnv(env: Record<string, string>) {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Updated ${ENV_PATH}`);
}

async function fetchWorkspaces(apiKey: string) {
  const resp = await fetch(`${MOTION_BASE}/workspaces`, {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Motion /workspaces failed ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  return data.workspaces || [];
}

async function promptYes(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith('y'));
    })
  );
}

async function main() {
  const env = loadEnv();
  const apiKey = env.MOTION_API_KEY;
  if (!apiKey) throw new Error('MOTION_API_KEY not set in .env.local');

  const workspaces = await fetchWorkspaces(apiKey);
  console.log(`Found ${workspaces.length} Motion workspaces`);

  const currentMapRaw = env.MOTION_WORKSPACE_MAP || '{}';
  let currentMap: Record<string, string>;
  try {
    currentMap = JSON.parse(currentMapRaw);
  } catch {
    currentMap = {};
  }

  const merged: Record<string, string> = { ...currentMap };
  for (const ws of workspaces) {
    const key = (ws.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!merged[key]) {
      merged[key] = ws.id; // suggest id
    }
  }

  // pretty print
  console.log('\nProposed MOTION_WORKSPACE_MAP:');
  console.log(JSON.stringify(merged, null, 2));

  const apply = await promptYes('\nApply this map to .env.local? (y/N): ');
  if (!apply) {
    console.log('Skipped updating .env.local');
    return;
  }

  env.MOTION_WORKSPACE_MAP = JSON.stringify(merged);
  saveEnv(env);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
