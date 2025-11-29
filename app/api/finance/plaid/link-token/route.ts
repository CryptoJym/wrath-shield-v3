import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { currentUserOrThrow } from '../../../../../lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'development') as keyof typeof PlaidEnvironments;

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

    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Wrath Shield Finance',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (e: any) {
    console.error('[plaid/link-token] Error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}
