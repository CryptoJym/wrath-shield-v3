# Google Calendar Integration Setup

This guide explains how to connect the EA (Executive Assistant) agent to Google Calendar.

## Overview

The EA agent can integrate with Google Calendar to:
- Fetch upcoming events
- Create calendar events and time blocks
- Check for scheduling conflicts
- Find optimal meeting times
- Protect family time blocks

## Prerequisites

- Google Cloud Platform account
- Access to the Google Calendar you want to integrate

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### 2. Enable Google Calendar API

1. In your Google Cloud project, go to **APIs & Services > Library**
2. Search for "Google Calendar API"
3. Click **Enable**

### 3. Create OAuth 2.0 Credentials

#### Option A: OAuth 2.0 (Recommended for personal use)

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > OAuth client ID**
3. Configure consent screen if prompted:
   - User Type: **External** (for personal) or **Internal** (for organization)
   - App name: "Wrath Shield EA Agent"
   - User support email: Your email
   - Developer contact: Your email
4. Application type: **Web application**
5. Name: "Wrath Shield Calendar Access"
6. Authorized redirect URIs:
   - Add: `http://localhost:3000/api/auth/google/callback` (for development)
   - Add: `https://your-domain.com/api/auth/google/callback` (for production)
7. Click **CREATE**
8. **Save the Client ID and Client Secret**

#### Option B: Service Account (For automated access)

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > Service account**
3. Service account name: "wrath-shield-calendar"
4. Grant role: **Project > Editor**
5. Click **DONE**
6. Click on the created service account
7. Go to **KEYS** tab
8. Click **ADD KEY > Create new key**
9. Choose **JSON** format
10. **Save the JSON file securely**

### 4. Get Refresh Token (OAuth Only)

For OAuth setup, you need to obtain a refresh token:

1. Create a temporary script `get-refresh-token.js`:

```javascript
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:3000/api/auth/google/callback'
);

const scopes = ['https://www.googleapis.com/auth/calendar'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent',
});

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', async (code) => {
  rl.close();
  const { tokens } = await oauth2Client.getToken(code);
  console.log('Refresh Token:', tokens.refresh_token);
});
```

2. Run it:
```bash
node get-refresh-token.js
```

3. Follow the URL, authorize, and copy the refresh token

### 5. Configure Environment Variables

Add to your `.env.local` file:

#### For OAuth:
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
```

#### For Service Account:
```bash
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

### 6. Grant Calendar Access (Service Account Only)

If using a service account:
1. Open [Google Calendar](https://calendar.google.com)
2. Go to Settings > Settings for my calendars > [Your Calendar] > Share with specific people
3. Add the service account email (e.g., `wrath-shield-calendar@project-id.iam.gserviceaccount.com`)
4. Grant permission: **Make changes to events**

### 7. Test the Integration

Restart your development server:
```bash
npm run dev
```

Test the EA agent status endpoint:
```bash
curl http://localhost:4242/api/ea/status
```

If configured correctly, you should see:
```json
{
  "ok": true,
  "status": "active",
  "capabilities": ["calendar_management", "meeting_scheduling", ...]
}
```

## Usage

### Get Upcoming Events

```typescript
import { getGoogleCalendarClient } from '@/lib/integrations/GoogleCalendarClient';

const client = getGoogleCalendarClient();
const events = await client.getUpcomingEvents(10);
console.log('Upcoming events:', events);
```

### Create Time Block

```typescript
const event = await client.createEvent({
  title: 'Focus Time',
  description: 'Deep work session',
  start: new Date('2025-12-08T09:00:00'),
  end: new Date('2025-12-08T11:00:00'),
  status: 'confirmed',
});
```

### Find Optimal Meeting Time

```typescript
const slot = await client.findOptimalSlot(
  60, // 60 minutes
  new Date('2025-12-08T08:00:00'),
  new Date('2025-12-08T18:00:00')
);

if (slot) {
  console.log('Optimal time:', slot.start, 'to', slot.end);
}
```

## Security Notes

- **Never commit credentials to git**
- Store `.env.local` in `.gitignore`
- Use environment variables for all secrets
- For production, use Secret Manager or similar
- Rotate credentials regularly
- Use service accounts for automated processes
- Use OAuth for user-specific calendars

## Troubleshooting

### "Google Calendar not configured" error

- Check that environment variables are set correctly
- Verify the OAuth refresh token is valid
- Ensure the service account has calendar access

### "Insufficient permissions" error

- Check that the Google Calendar API is enabled
- Verify the service account has been granted calendar access
- For OAuth, ensure the correct scopes are requested

### Events not appearing

- Check that you're querying the correct calendar ID
- Verify the time range includes the events
- Ensure the calendar is not hidden in Google Calendar settings

## Next Steps

Once Google Calendar is connected, the EA agent will:
1. Automatically fetch upcoming events
2. Monitor for scheduling conflicts
3. Suggest optimal meeting times
4. Protect family time blocks
5. Generate daily agendas

See `lib/agents/ea-agent.ts` for implementation details.
