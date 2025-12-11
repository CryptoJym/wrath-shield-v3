#!/usr/bin/env npx tsx
/**
 * Google Calendar OAuth Setup Script
 *
 * This script initiates the OAuth flow to obtain a refresh token
 * for Google Calendar API access.
 *
 * Prerequisites:
 * 1. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set in .env.local
 *
 * Usage:
 *   npx tsx scripts/google-oauth-setup.ts
 *
 * After running, follow the instructions to authorize and copy
 * the refresh token to your .env.local file.
 */

import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

// Scopes needed for calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: Missing Google OAuth credentials');
  console.error('   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

async function getRefreshToken(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create a simple HTTP server to handle the OAuth callback
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url || '', true);

        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code as string;

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Error: No authorization code received</h1>');
            return;
          }

          // Exchange the authorization code for tokens
          const { tokens } = await oauth2Client.getToken(code);

          console.log('\n✅ Successfully obtained tokens!\n');
          console.log('='.repeat(60));
          console.log('REFRESH TOKEN (add to .env.local):');
          console.log('='.repeat(60));
          console.log(`\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
          console.log('='.repeat(60));

          // Optionally append to .env.local
          if (tokens.refresh_token) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            if (!envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
              fs.appendFileSync(envPath, `\n# Google Calendar OAuth Refresh Token\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
              console.log('\n✅ Refresh token automatically added to .env.local');
            } else {
              console.log('\n⚠️  GOOGLE_REFRESH_TOKEN already exists in .env.local');
              console.log('   Please manually update it if needed.');
            }
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>Google OAuth Success</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                         padding: 40px; max-width: 600px; margin: 0 auto; }
                  .success { color: #22c55e; }
                  code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
                </style>
              </head>
              <body>
                <h1 class="success">✅ Authorization Successful!</h1>
                <p>Your Google Calendar is now connected to Life OS.</p>
                <p>Refresh token has been saved to <code>.env.local</code></p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          server.close();
          resolve();
        }
      } catch (error) {
        console.error('Error during OAuth callback:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Error during authorization</h1>');
        server.close();
        reject(error);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      // Generate the authorization URL
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force consent to ensure refresh token
      });

      console.log('\n🔐 Google Calendar OAuth Setup');
      console.log('='.repeat(60));
      console.log('\nOpening browser for Google authorization...');
      console.log('\nIf the browser does not open, visit this URL manually:');
      console.log(`\n${authUrl}\n`);
      console.log('='.repeat(60));
      console.log('\nWaiting for authorization callback...\n');

      // Try to open the browser
      try {
        const platform = process.platform;
        if (platform === 'darwin') {
          execSync(`open "${authUrl}"`);
        } else if (platform === 'linux') {
          execSync(`xdg-open "${authUrl}"`);
        } else if (platform === 'win32') {
          execSync(`start "${authUrl}"`);
        }
      } catch (e) {
        // Browser opening failed, user will need to copy URL manually
        console.log('Could not open browser automatically.');
      }
    });

    server.on('error', reject);
  });
}

// Run the OAuth flow
getRefreshToken()
  .then(() => {
    console.log('\n✅ OAuth setup complete!');
    console.log('   You can now use the Google Calendar integration.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ OAuth setup failed:', error);
    process.exit(1);
  });
