/**
 * Guided secret setter for env vars (Twilio, OpenRouter, WHOOP placeholders, SMTP).
 *
 * Usage:
 *   npx tsx scripts/set-secrets.ts
 *
 * Notes:
 * - Writes/updates .env.local (gitignored).
 * - For safety, existing lines are replaced; others appended.
 * - If you leave a prompt blank, the variable is skipped/left unchanged.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');

const FIELDS: { key: string; label: string; required?: boolean; defaultValue?: string }[] = [
  { key: 'TWILIO_ACCOUNT_SID', label: 'Twilio Account SID' },
  { key: 'TWILIO_AUTH_TOKEN', label: 'Twilio Auth Token' },
  { key: 'TWILIO_FROM', label: 'Twilio From Number (e.g., +15551234567)' },
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key' },
  { key: 'OPENAI_API_KEY_DIRECT', label: 'OpenAI API Key (direct, optional)' },
  { key: 'XAI_API_KEY_DIRECT', label: 'xAI API Key (direct, optional)' },
  { key: 'CLERK_PUBLISHABLE_KEY', label: 'Clerk Publishable Key' },
  { key: 'CLERK_SECRET_KEY', label: 'Clerk Secret Key' },
  { key: 'MOTION_API_KEY', label: 'Motion API Key (optional)' },
  { key: 'MOTION_API_BASE', label: 'Motion API Base URL', defaultValue: 'https://api.usemotion.com/v1' },
  { key: 'MOTION_WORKSPACE_ID', label: 'Motion Workspace ID (required for Motion tasks)' },
  { key: 'MOTION_WORKSPACE_MAP', label: 'Motion Workspace Map (JSON, optional per-project routing)' },
  { key: 'WHOOP_CLIENT_ID', label: 'WHOOP Client ID', defaultValue: 'dummy' },
  { key: 'WHOOP_CLIENT_SECRET', label: 'WHOOP Client Secret', defaultValue: 'dummy' },
  { key: 'WHOOP_REDIRECT_URI', label: 'WHOOP Redirect URI', defaultValue: 'http://localhost:4242/api/whoop/oauth/callback' },
];

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  const out: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function saveEnv(env: Record<string, string>) {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Updated ${ENV_PATH}`);
}

async function main() {
  const env = loadEnv();
  console.log(`Setting secrets in ${ENV_PATH} (blank to skip, keep existing).`);
  for (const field of FIELDS) {
    const current = env[field.key];
    const hint = current ? '[press Enter to keep current]' : field.defaultValue ? `[default: ${field.defaultValue}]` : '';
    const val = await prompt(`${field.label}${hint ? ' ' + hint : ''}: `);
    if (val) {
      env[field.key] = val;
    } else if (field.defaultValue && !current) {
      env[field.key] = field.defaultValue;
    }
  }
  // Optional: multi-profile prompt
  const addProfiles = (await prompt('Paste SMTP_PROFILES JSON (include all mailboxes; leave blank to skip): ')).trim();
  if (addProfiles) {
    env['SMTP_PROFILES'] = addProfiles;
    const defProfile = await prompt('SMTP_DEFAULT_PROFILE (name, blank to skip): ');
    if (defProfile.trim()) env['SMTP_DEFAULT_PROFILE'] = defProfile.trim();
  } else {
    const guided = (await prompt('Use guided multi-profile setup for jamesbrady.org / noticingmind.com / utlyze.com / vuplicity.com? (y/N): ')).trim().toLowerCase();
    if (guided === 'y') {
      const p1 = await prompt('Password for James@jamesbrady.org (SMTP/app password): ');
      const p2 = await prompt('Password for James@noticingmind.com: ');
      const p3 = await prompt('Password for James@utlyze.com: ');
      const p4 = await prompt('Password for James@vuplicity.com: ');
      env['SMTP_PROFILES'] = JSON.stringify([
        {
          name: 'universal',
          host: 'smtp.gmail.com',
          port: 587,
          user: 'James@jamesbrady.org',
          pass: p1 || 'MISSING_PASSWORD',
          from: 'James Brady <James@jamesbrady.org>',
          domains: ['jamesbrady.org', 'noticingmind.com'],
        },
        {
          name: 'nm',
          host: 'smtp.gmail.com',
          port: 587,
          user: 'James@noticingmind.com',
          pass: p2 || 'MISSING_PASSWORD',
          from: 'James @ NoticingMind <James@noticingmind.com>',
          domains: ['noticingmind.com'],
        },
        {
          name: 'utlyze',
          host: 'smtp.office365.com',
          port: 587,
          user: 'James@utlyze.com',
          pass: p3 || 'MISSING_PASSWORD',
          from: 'James @ Utlyze <James@utlyze.com>',
          domains: ['utlyze.com'],
        },
        {
          name: 'vuplicity',
          host: 'smtp.office365.com',
          port: 587,
          user: 'James@vuplicity.com',
          pass: p4 || 'MISSING_PASSWORD',
          from: 'James @ Vuplicity <James@vuplicity.com>',
          domains: ['vuplicity.com'],
        },
      ]);
      env['SMTP_DEFAULT_PROFILE'] = 'universal';
    }
  }

  saveEnv(env);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
