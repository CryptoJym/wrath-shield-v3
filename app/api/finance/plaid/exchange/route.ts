import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { currentUserOrThrow } from '../../../../../lib/auth/user';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'development') as keyof typeof PlaidEnvironments;

export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await request.json();
    const { public_token } = body;

    if (!public_token) {
      return NextResponse.json({ error: 'public_token required' }, { status: 400 });
    }

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

    // Exchange public token for access token
    const response = await client.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = response.data;

    // Get item details (institution info)
    const itemResponse = await client.itemGet({
      access_token,
    });

    const institution_id = itemResponse.data.item.institution_id || item_id;

    // Store access token in plaid-tokens.json
    const tokensFile = path.resolve(process.cwd(), '.data', 'finance', 'plaid-tokens.json');
    fs.mkdirSync(path.dirname(tokensFile), { recursive: true });

    let tokens: Record<string, any> = {};
    if (fs.existsSync(tokensFile)) {
      tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
    }

    tokens[item_id] = {
      access_token,
      item_id,
      institution_id,
      added_at: new Date().toISOString(),
      user_id: userId,
    };

    fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));

    return NextResponse.json({
      success: true,
      item_id,
      message: 'Account linked successfully'
    });
  } catch (e: any) {
    console.error('[plaid/exchange] Error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
