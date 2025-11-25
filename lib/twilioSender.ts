import twilio from 'twilio';

export type SmsInput = { to: string; body: string };

export function hasTwilioConfig(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms({ to, body }: SmsInput): Promise<{ ok: boolean; sid?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) throw new Error('Twilio env vars not set');

  const client = twilio(sid, token);
  const msg = await client.messages.create({ from, to, body });
  return { ok: true, sid: msg.sid };
}
