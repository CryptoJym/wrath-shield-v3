/**
 * Wrath Shield v3 - WHOOP OAuth2 Initiate Route
 *
 * GET /api/whoop/oauth/initiate
 * Initiates the OAuth2 authorization flow by redirecting to WHOOP's authorization endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cfg } from '@/lib/config';

const WHOOP_AUTH_BASE_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
// Include 'offline' to receive a refresh_token (per WHOOP docs)
const WHOOP_SCOPES = ['read:recovery', 'read:cycles', 'read:sleep', 'offline'];

/**
 * Generate a cryptographically secure random state parameter for CSRF protection
 */
function generateState(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Build the WHOOP authorization URL with all required parameters
 */
function buildAuthorizationUrl(state: string): string {
  const config = cfg();
  const redirectUri = config.whoop.redirectUri;

  const params = new URLSearchParams({
    client_id: config.whoop.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: WHOOP_SCOPES.join(' '),
    state,
  });

  return `${WHOOP_AUTH_BASE_URL}?${params.toString()}`;
}

/**
 * GET /api/whoop/oauth/initiate
 *
 * Initiates OAuth flow by:
 * 1. Generating a random state parameter for CSRF protection
 * 2. Building the authorization URL with client_id, redirect_uri, scopes
 * 3. Setting a cookie with the state for validation in callback
 * 4. Redirecting user to WHOOP authorization page (302)
 */
export async function GET(_request: NextRequest) {
  try {
    // Generate state for CSRF protection
    const state = generateState();

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(state);

    // Create response with redirect
    const response = NextResponse.redirect(authUrl, { status: 302 });

    // Set state cookie for validation in callback (httpOnly, secure in prod, 10 min expiry)
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/api/whoop/oauth',
    });

    return response;
  } catch (error) {
    console.error('[WHOOP OAuth Initiate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
