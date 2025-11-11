/**
 * Wrath Shield v3 - WHOOP OAuth2 Callback Route
 *
 * GET /api/whoop/oauth/callback
 * Handles the OAuth2 callback from WHOOP, validates state, and exchanges code for tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { encryptData } from '@/lib/crypto';
import { insertTokens } from '@/lib/db/queries';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

/**
 * WHOOP Token Response
 */
interface WhoopTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Seconds until expiration
  refresh_token: string;
  scope: string;
}

/**
 * GET /api/whoop/oauth/callback
 *
 * Handles OAuth callback by:
 * 1. Reading authorization code and state from query parameters
 * 2. Validating state against cookie (CSRF protection)
 * 3. Clearing state cookie after validation
 * 4. Preparing code for token exchange (implemented in next subtask)
 *
 * Query params:
 * - code: Authorization code from WHOOP
 * - state: CSRF protection token (must match cookie)
 * - error: Error code if authorization failed
 * - error_description: Human-readable error description
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check for authorization errors
    const error = searchParams.get('error');
    if (error) {
      const errorDescription = searchParams.get('error_description') ?? 'Unknown error';
      console.error('[WHOOP OAuth Callback] Authorization error:', error, errorDescription);

      // Redirect to error page or home with error message
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('oauth_error', errorDescription);
      return NextResponse.redirect(errorUrl, { status: 302 });
    }

    // Extract authorization code and state
    const code = searchParams.get('code');
    const receivedState = searchParams.get('state');

    if (!code || !receivedState) {
      console.error('[WHOOP OAuth Callback] Missing code or state parameter');
      return NextResponse.json(
        { error: 'Missing required OAuth parameters' },
        { status: 400 }
      );
    }

    // Validate state against cookie (CSRF protection)
    const storedState = request.cookies.get('oauth_state')?.value;

    if (!storedState || storedState !== receivedState) {
      console.error('[WHOOP OAuth Callback] State mismatch - potential CSRF attack');
      return NextResponse.json(
        { error: 'Invalid state parameter - CSRF validation failed' },
        { status: 403 }
      );
    }

    // State is valid - clear the cookie
    const cookieResponse = NextResponse.json({ success: true });
    cookieResponse.cookies.delete('oauth_state');

    console.log('[WHOOP OAuth Callback] State validated, exchanging code for tokens');

    // Exchange authorization code for tokens
    const config = cfg();
    const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
    const host = request.headers.get('host') ?? 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/whoop/oauth/callback`;

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.whoop.clientId,
      client_secret: config.whoop.clientSecret,
    });

    // POST to WHOOP token endpoint
    const tokenResponse = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[WHOOP OAuth Callback] Token exchange failed:', tokenResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code for tokens' },
        { status: 500 }
      );
    }

    const tokenData = (await tokenResponse.json()) as WhoopTokenResponse;

    // Encrypt tokens using AES-256-GCM
    const accessTokenEnc = encryptData(tokenData.access_token);
    const refreshTokenEnc = encryptData(tokenData.refresh_token);

    // Calculate expiration timestamp (current time + expires_in seconds)
    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    // Store encrypted tokens in database (per-user scoping handled by DB defaults)
    insertTokens([
      {
        provider: 'whoop',
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        expires_at: expiresAt,
      },
    ]);

    console.log('[WHOOP OAuth Callback] Tokens exchanged and stored successfully');

    // Redirect to success page
    const successUrl = new URL('/', request.url);
    successUrl.searchParams.set('oauth_success', 'true');
    return NextResponse.redirect(successUrl, { status: 302 });
  } catch (error) {
    console.error('[WHOOP OAuth Callback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process OAuth callback' },
      { status: 500 }
    );
  }
}
