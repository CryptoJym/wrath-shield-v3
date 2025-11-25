/**
 * Ingest local macOS Contacts into relationships.db display names.
 *
 * Usage:
 *   npx tsx scripts/ingest-contacts.ts
 */
import fs from 'fs';
import path from 'path';
import BetterSqlite3 from 'better-sqlite3';
import { updateDisplayNameByHandle } from '../lib/relationshipDb';

const CANDIDATE_FILES = [
  'AddressBook-v22.abcddb',
  'AddressBook-v21.abcddb',
  'AddressBook-v20.abcddb',
  'AddressBook-v19.abcddb',
];

function findAddressBook(): string | null {
  const base = path.resolve(process.env.HOME || '~', 'Library', 'Application Support', 'AddressBook');
  for (const f of CANDIDATE_FILES) {
    const p = path.join(base, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function normalizeHandle(h: string): string {
  if (!h) return '';
  const trimmed = h.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const digits = trimmed.replace(/[^0-9]/g, '');
  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
}

function main() {
  const dbPath = findAddressBook();
  if (!dbPath) {
    console.error('Contacts DB not found under ~/Library/Application Support/AddressBook');
    process.exit(1);
  }
  const adb = new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true });

  const names: Record<string, string> = {};

  // Phones
  try {
    const rows = adb
      .prepare(
        `SELECT r.ZFIRSTNAME, r.ZLASTNAME, p.ZFULLNUMBER
         FROM ZABCDRECORD r
         JOIN ZABCDPHONENUMBER p ON p.ZOWNER = r.Z_PK
         WHERE p.ZFULLNUMBER IS NOT NULL`
      )
      .all();
    for (const r of rows) {
      const name = [r.ZFIRSTNAME, r.ZLASTNAME].filter(Boolean).join(' ').trim();
      const handle = normalizeHandle(r.ZFULLNUMBER || '');
      if (handle && name) names[handle] = name;
    }
  } catch (e) {
    console.warn('Phone ingest failed:', e);
  }

  // Emails
  try {
    const rows = adb
      .prepare(
        `SELECT r.ZFIRSTNAME, r.ZLASTNAME, e.ZADDRESS
         FROM ZABCDRECORD r
         JOIN ZABCDEMAILADDRESS e ON e.ZOWNER = r.Z_PK
         WHERE e.ZADDRESS IS NOT NULL`
      )
      .all();
    for (const r of rows) {
      const name = [r.ZFIRSTNAME, r.ZLASTNAME].filter(Boolean).join(' ').trim();
      const handle = normalizeHandle(r.ZADDRESS || '');
      if (handle && name) names[handle] = name;
    }
  } catch (e) {
    console.warn('Email ingest failed:', e);
  }

  let updated = 0;
  for (const [handle, name] of Object.entries(names)) {
    updateDisplayNameByHandle(handle, name);
    updated++;
  }
  console.log(`Updated ${updated} contact display names from Contacts DB.`);
}

main();
