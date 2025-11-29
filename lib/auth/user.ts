import { auth } from '@clerk/nextjs/server';
import { upsertUser, UserRecord } from '../db/users';

// Prefer primary email as app user id so existing data (finance/events) keyed by email loads when signed in.
function selectAppUserId(userId: string, primaryEmail?: string | null) {
  if (primaryEmail && typeof primaryEmail === 'string') return primaryEmail.toLowerCase();
  return userId;
}

export function currentUserOrThrow(): { userId: string; record: UserRecord } {
  // Hard override: if USER_ID is set, always use it (ensures data keyed by email loads even when Clerk session is present/missing).
  if (process.env.USER_ID && process.env.USER_ID.trim() !== '') {
    const uid = process.env.USER_ID.trim();
    upsertUser({ user_id: uid });
    return { userId: uid, record: { user_id: uid } };
  }

  const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY;
  const bypass = process.env.DISABLE_AUTH === '1';

  // Local/dev fallback keeps data visible without Clerk keys.
  if (!hasClerk || bypass) return { userId: process.env.USER_ID || 'default', record: { user_id: process.env.USER_ID || 'default' } };

  const { userId, sessionClaims } = auth();
  // If Clerk failed to attach a session (dev browser missing), fall back to explicit USER_ID if provided.
  if (!userId) {
    if (process.env.USER_ID) {
      const uid = process.env.USER_ID;
      upsertUser({ user_id: uid });
      return { userId: uid, record: { user_id: uid } };
    }
    throw new Error('unauthorized');
  }

  const username = (sessionClaims as any)?.username || (sessionClaims as any)?.preferred_username;
  const primaryEmail =
    (sessionClaims as any)?.email ||
    (sessionClaims as any)?.primary_email ||
    (sessionClaims as any)?.email_address;
  const emails = (sessionClaims as any)?.email_addresses || (sessionClaims as any)?.emails || [];
  const aliases: string[] = [];
  if (primaryEmail) aliases.push(primaryEmail.toLowerCase());
  for (const e of emails) {
    if (typeof e === 'string') {
      const lower = e.toLowerCase();
      if (!aliases.includes(lower)) aliases.push(lower);
    }
  }

  const appUserId = selectAppUserId(userId, primaryEmail);

  const record: UserRecord = {
    user_id: appUserId,
    username: username || primaryEmail || appUserId,
    primary_email: primaryEmail || undefined,
    aliases,
  };
  upsertUser(record);
  return { userId: appUserId, record };
}

export function currentUserOptional(): { userId: string; record: UserRecord } | null {
  if (process.env.USER_ID && process.env.USER_ID.trim() !== '') {
    const uid = process.env.USER_ID.trim();
    upsertUser({ user_id: uid });
    return { userId: uid, record: { user_id: uid } };
  }

  const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY;
  const bypass = process.env.DISABLE_AUTH === '1';
  if (!hasClerk || bypass) {
    const fallbackId = process.env.USER_ID || 'default';
    return { userId: fallbackId, record: { user_id: fallbackId } };
  }
  const { userId, sessionClaims } = auth();
  if (!userId) return null;
  const primaryEmail =
    (sessionClaims as any)?.email ||
    (sessionClaims as any)?.primary_email ||
    (sessionClaims as any)?.email_address;
  const appUserId = selectAppUserId(userId, primaryEmail);
  const record: UserRecord = {
    user_id: appUserId,
    username: (sessionClaims as any)?.username || (sessionClaims as any)?.preferred_username || primaryEmail || appUserId,
    primary_email: primaryEmail || undefined,
  };
  upsertUser(record);
  return { userId: appUserId, record };
}
