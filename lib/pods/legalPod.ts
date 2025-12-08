import { PodInput, PodOutput } from './types';
import { listLegalContextRequests } from '../legal/store';

// Seed filters for legal context
const LEGAL_CONTACTS = [
  'zach start',
  'zachary start',
  'moodybrown',
  'destiny hyte',
  'destiny',
];

const JURISDICTION = 'Utah 4th District (Provo) - Family';

/**
 * Legal pod (stub)
 * Focus: custody/tax/legal threads. Filters signals to legal contacts,
 * enriches with jurisdiction metadata. Intended to run under a separate
 * orchestrator / approval chain.
 */
export async function runLegalPod(input: PodInput): Promise<PodOutput> {
  const lower = (s: any) => (s ? String(s).toLowerCase() : '');
  const legalEvents = input.events.filter((e) => {
    const contact = lower(e.contact || '');
    return LEGAL_CONTACTS.some((c) => contact.includes(c));
  });

  const pending = listLegalContextRequests('pending', input.userId);

  const notes = [
    `LegalPod stub: ${legalEvents.length}/${input.events.length} events tagged legal.`,
    `Jurisdiction: ${JURISDICTION}`,
    `Pending legal context requests: ${pending.length}`,
    'TODO: add Zep timeline collection per matter; extract filings/deadlines; propose filings/tasks; map to GitHub milestones.',
  ];

  // No side-effect actions yet; we just surface notes for now.
  return { actions: [], notes, confidence: legalEvents.length ? 0.2 : 0.0 };
}
