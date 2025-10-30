export type Severity = 'low' | 'medium' | 'high';
export interface FlagEvent { severity: Severity; timestamp: number; }

/**
 * Returns true if there are >= 2 medium+ flags within the last windowMinutes.
 * Defaults to 180 minutes (3 hours) per Task 9 spec.
 */
export function shouldMiddayPing(events: FlagEvent[], now = Date.now(), windowMinutes = 180): boolean {
  const windowMs = windowMinutes * 60 * 1000;
  const cutoff = now - windowMs;
  const qualifying = events.filter(e => e.timestamp >= cutoff && (e.severity === 'medium' || e.severity === 'high'));
  return qualifying.length >= 2;
}
