/**
 * Simple forecaster: follow-ups + near-term event prep -> agentic_actions.
 */
import crypto from 'crypto';
import { listRecentEvents } from '../lib/events';
import { insertAgenticActions } from '../lib/db/queries';

const MIN_CONF = parseFloat(process.env.FORECAST_CONFIDENCE || '0.82');
const NOW = Date.now() / 1000;

function upcomingEventActions() {
  const events = listRecentEvents(300).filter(
    (e) => e.channel === 'calendar' || e.channel === 'event'
  );
  const soon = events.filter((e) => e.ts > NOW && e.ts < NOW + 3 * 86400);
  return soon.map((e) => ({
    id: crypto.randomUUID(),
    user_id: 'default',
    type: 'reminder',
    target: 'calendar',
    title: e.subject || 'Upcoming event',
    content: `Prep for ${e.subject || 'event'} (${new Date(e.ts * 1000).toISOString()})`,
    confidence: MIN_CONF,
    status: 'proposed' as const,
    source: 'forecaster',
    metadata: JSON.stringify({ event_id: e.id, contact: e.contact }),
  }));
}

function followupEmailActions() {
  const mail = listRecentEvents(400).filter(
    (e) => e.channel === 'email' && e.ts > NOW - 2 * 86400
  );
  return mail.slice(0, 20).map((m) => ({
    id: crypto.randomUUID(),
    user_id: 'default',
    type: 'task',
    target: 'email',
    title: `Follow up: ${m.subject || 'email'}`,
    content: `Reply or follow up with ${m.contact || 'contact'} about "${m.subject || ''}"`,
    confidence: MIN_CONF - 0.05,
    status: 'proposed' as const,
    source: 'forecaster',
    metadata: JSON.stringify({ message_id: m.id, contact: m.contact }),
  }));
}

function main() {
  const actions = [...upcomingEventActions(), ...followupEmailActions()];
  if (!actions.length) {
    console.log('No forecast actions created.');
    return;
  }
  insertAgenticActions(actions);
  console.log(`Forecaster wrote ${actions.length} actions.`);
}

main();
