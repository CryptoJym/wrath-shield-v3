type SmtpProfile = {
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  domains?: string[];
};

export function loadSmtpProfiles(): { profiles: SmtpProfile[]; defaultName?: string } {
  let profiles: SmtpProfile[] = [];
  const raw = process.env.SMTP_PROFILES;
  if (raw) {
    try {
      profiles = JSON.parse(raw);
    } catch (e) {
      console.warn('[smtp] failed to parse SMTP_PROFILES JSON');
    }
  }
  const def = process.env.SMTP_DEFAULT_PROFILE;
  // Single profile fallback from legacy env
  if (!profiles.length && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    profiles = [
      {
        name: 'default',
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        domains: process.env.SMTP_ALLOW_DOMAIN ? [process.env.SMTP_ALLOW_DOMAIN.replace(/^@/, '')] : undefined,
      },
    ];
  }
  return { profiles, defaultName: def };
}

export function resolveProfile(recipients: string[], preferred?: string): SmtpProfile | null {
  const { profiles, defaultName } = loadSmtpProfiles();
  if (!profiles.length) return null;
  if (preferred) {
    const p = profiles.find((x) => x.name === preferred);
    if (p) return p;
  }
  // Match by recipient domain
  const domains = recipients.map((r) => r.split('@')[1]?.toLowerCase()).filter(Boolean);
  for (const p of profiles) {
    if (p.domains?.some((d) => domains.includes(d.toLowerCase()))) return p;
  }
  // Default
  if (defaultName) {
    const p = profiles.find((x) => x.name === defaultName);
    if (p) return p;
  }
  return profiles[0] || null;
}
