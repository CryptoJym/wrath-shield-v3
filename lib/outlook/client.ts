import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

export type OutlookMessage = {
  subject?: string;
  from?: string;
  preview?: string;
  dateTimeReceived?: string;
};

function getMailboxByVar(refreshVar?: string) {
  if (refreshVar && process.env[refreshVar]) {
    const slug = refreshVar.replace('O365_REFRESH_TOKEN_', '').toLowerCase();
    const email = process.env[`O365_EMAIL_${slug}`] || undefined;
    return { slug, refreshToken: process.env[refreshVar] as string, email };
  }
  const entries = Object.entries(process.env).filter(([k]) => k.startsWith('O365_REFRESH_TOKEN_'));
  if (!entries.length) return null;
  const [key, refreshToken] = entries[0];
  const slug = key.replace('O365_REFRESH_TOKEN_', '').toLowerCase();
  const email = process.env[`O365_EMAIL_${slug}`] || undefined;
  return { slug, refreshToken, email };
}

async function exchangeRefreshToken(refreshToken: string) {
  const clientId = process.env.O365_CLIENT_ID;
  const clientSecret = process.env.O365_CLIENT_SECRET;
  const tenant = process.env.O365_TENANT_ID || 'common';
  if (!clientId || !clientSecret) throw new Error('Missing O365 client credentials');

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/.default',
  });
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error(`O365 token error: ${resp.status} ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

export class OutlookClient {
  constructor(private accessToken: string) {}

  static async fromEnv(refreshVar?: string): Promise<OutlookClient | null> {
    const mailbox = getMailboxByVar(refreshVar);
    if (!mailbox) return null;
    const access = await exchangeRefreshToken(mailbox.refreshToken);
    return new OutlookClient(access);
  }

  async searchMessages(query: string, max = 5): Promise<OutlookMessage[]> {
    const encoded = encodeURIComponent(query);
    const url = `https://graph.microsoft.com/v1.0/me/messages?$search=${encoded}&$top=${max}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
        ConsistencyLevel: 'eventual',
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Graph search error ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    const value = data.value || [];
    return value.map((m: any) => ({
      subject: m.subject,
      from: m.from?.emailAddress?.address,
      preview: m.bodyPreview,
      dateTimeReceived: m.receivedDateTime,
    }));
  }
}
