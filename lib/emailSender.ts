import nodemailer from 'nodemailer';
import { resolveProfile } from './smtpProfiles';

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  preferredProfile?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; profile?: string }> {
  const recipients = Array.isArray(input.to) ? (input.to as any) : [input.to];
  const profile = resolveProfile(recipients, input.preferredProfile);
  if (!profile) throw new Error('SMTP not configured');

  const transport = nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.port === 465,
    auth: { user: profile.user, pass: profile.pass },
  });

  const info = await transport.sendMail({
    from: profile.from || profile.user,
    to: recipients.join(','),
    subject: input.subject || '(no subject)',
    text: input.text,
  });
  return { ok: true, id: info.messageId, profile: profile.name };
}
