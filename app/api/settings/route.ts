/**
 * Wrath Shield v3 - Settings API Route
 *
 * POST /api/settings - Accept and validate API keys for third-party services
 *
 * Supports:
 * - Limitless API key validation and storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { encryptData } from '@/lib/crypto';
import { insertSettings, getSetting } from '@/lib/db/queries';
import { httpsRequest } from '@/lib/https-proxy-request';

interface SettingsRequest {
  provider: 'limitless';
  key: string;
}

/**
 * Validate Limitless API key by probing the API
 */
async function validateLimitlessKey(apiKey: string): Promise<boolean> {
  try {
    const response = await httpsRequest('https://api.limitless.ai/v1/lifelogs?limit=1', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey, // Limitless uses X-API-Key, NOT Authorization Bearer!
      },
    });

    // 200 or 204 = valid key
    // 401/403 = invalid key
    return response.status === 200 || response.status === 204;
  } catch (error) {
    console.error('[Settings API] Limitless validation error:', error);
    return false;
  }
}

/**
 * POST /api/settings
 * Accept and store encrypted API keys
 */
export async function POST(request: NextRequest) {
  try {
    const body: SettingsRequest = await request.json();

    // Validate request structure
    if (!body.provider || !body.key) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, key' },
        { status: 400 }
      );
    }

    // Only Limitless is supported for now
    if (body.provider !== 'limitless') {
      return NextResponse.json(
        { error: 'Unsupported provider. Currently only "limitless" is supported.' },
        { status: 400 }
      );
    }

    // Validate Limitless API key by probing the API
    const isValid = await validateLimitlessKey(body.key);

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Invalid Limitless API key. Unable to authenticate with Limitless API.',
        },
        { status: 401 }
      );
    }

    // Encrypt the API key
    const encryptedKey = encryptData(body.key);

    // Store in settings table
    insertSettings([
      {
        key: `${body.provider}_api_key`,
        value_enc: encryptedKey,
      },
    ]);

    return NextResponse.json(
      {
        success: true,
        message: `${body.provider} API key validated and stored successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Settings API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing settings' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/settings?provider=limitless
 * Check if API key is configured (without revealing the key)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'Missing provider parameter' }, { status: 400 });
    }

    const settingKey = `${provider}_api_key`;
    const setting = getSetting(settingKey);

    if (!setting) {
      return NextResponse.json(
        {
          configured: false,
          provider,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        configured: true,
        provider,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Settings API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
