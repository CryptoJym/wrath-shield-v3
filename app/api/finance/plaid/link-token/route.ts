import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { currentUserOrThrow } from '../../../../../lib/auth/user';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'production') as keyof typeof PlaidEnvironments;

/**
 * Create a safe client_user_id for Plaid (must not contain emails or sensitive info)
 */
function getPlaidClientUserId(userId: string): string {
  // If userId looks like an email, hash it
  if (userId.includes('@')) {
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 32);
  }
  return userId;
}

export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return NextResponse.json({ error: 'Plaid not configured' }, { status: 500 });
    }

    const config = new Configuration({
      basePath: PlaidEnvironments[PLAID_ENV],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
          'PLAID-SECRET': PLAID_SECRET,
        },
      },
    });

    const client = new PlaidApi(config);

    // Get a Plaid-safe client_user_id (hashed if it's an email)
    const plaidUserId = getPlaidClientUserId(userId);

    // Request extended transaction history (up to 730 days / 2 years)
    const response = await client.linkTokenCreate({
      user: { client_user_id: plaidUserId },
      client_name: 'Wrath Shield Finance',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      transactions: {
        days_requested: 730,
      },
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (e: any) {
    console.error('[plaid/link-token] Error:', e?.response?.data || e);
    return NextResponse.json(
      { error: e?.response?.data?.error_message || e?.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}
