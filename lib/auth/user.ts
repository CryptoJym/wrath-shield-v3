import { auth } from '@clerk/nextjs/server';
import { upsertUser, UserRecord } from '../db/users';

export function currentUserOrThrow(): { userId: string; record: UserRecord } {
  const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY;
  const bypass = process.env.DISABLE_AUTH === '1' || process.env.NODE_ENV === 'development';
  if (!hasClerk || bypass) return { userId: 'default', record: { user_id: 'default' } };
  const { userId, sessionClaims } = auth();
  if (!userId) {
    if (bypass) return { userId: 'default', record: { user_id: 'default' } };
    throw new Error('unauthorized');
  }
  const username = (sessionClaims as any)?.username || (sessionClaims as any)?.preferred_username;
  const primaryEmail =
    (sessionClaims as any)?.email ||
    (sessionClaims as any)?.primary_email ||
    (sessionClaims as any)?.email_address;
  const emails = (sessionClaims as any)?.email_addresses || (sessionClaims as any)?.emails || [];
  const aliases: string[] = [];
  if (primaryEmail) aliases.push(primaryEmail);
  for (const e of emails) {
    if (typeof e === 'string' && !aliases.includes(e)) aliases.push(e);
  }
  const record: UserRecord = {
    user_id: userId,
    username: username || primaryEmail || userId,
    primary_email: primaryEmail,
    aliases,
  };
  upsertUser(record);
  return { userId, record };
}
