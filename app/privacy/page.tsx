import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';

export const revalidate = 3600; // refresh hourly

function loadPolicy(): string {
  const filePath = path.join(process.cwd(), 'docs', 'policies', 'privacy-policy.md');
  return fs.readFileSync(filePath, 'utf8');
}

export default function PrivacyPage() {
  const content = loadPolicy();
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>Privacy Policy</h1>
      <div style={{ color: 'var(--color-text-secondary)' }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
