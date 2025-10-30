type Timestamp = number;

interface Hit {
  phrase: string;
  at: Timestamp;
}

interface RepPlan {
  phrase: string;
  times: Timestamp[]; // planned times
}

const hits: Hit[] = [];
const plans: Map<string, RepPlan> = new Map();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function recordHit(phrase: string, at: Timestamp = Date.now()) {
  hits.push({ phrase, at });
  // prune old hits beyond 7 days
  const cutoff = at - WEEK_MS;
  for (let i = hits.length - 1; i >= 0; i--) {
    if (hits[i].at < cutoff) hits.splice(i, 1);
  }
  maybePlan(phrase, at);
}

export function getHits(phrase: string, now: Timestamp = Date.now()): Hit[] {
  const cutoff = now - WEEK_MS;
  return hits.filter(h => h.phrase === phrase && h.at >= cutoff).slice().sort((a,b)=>a.at-b.at);
}

function maybePlan(phrase: string, now: Timestamp) {
  const recent = getHits(phrase, now);
  if (recent.length >= 3) {
    // Schedule 3 reps: now, +8h, +36h
    const base = now;
    const eightH = 8 * 60 * 60 * 1000;
    const thirtySixH = 36 * 60 * 60 * 1000;
    const times = [base, base + eightH, base + thirtySixH];
    plans.set(phrase, { phrase, times });
  }
}

export function getPlans(now: Timestamp = Date.now()): RepPlan[] {
  // prune past-only plans (all reps completed) handled by completeRep
  return Array.from(plans.values()).sort((a,b)=>a.phrase.localeCompare(b.phrase));
}

export function getDue(now: Timestamp = Date.now()): RepPlan[] {
  return getPlans(now).map(p=>({
    phrase: p.phrase,
    times: p.times.filter(t => t <= now)
  })).filter(p=>p.times.length>0);
}

export function completeRep(phrase: string, at: Timestamp): boolean {
  const p = plans.get(phrase);
  if (!p) return false;
  const idx = p.times.findIndex(t => t === at);
  if (idx >= 0) {
    p.times.splice(idx,1);
    if (p.times.length === 0) plans.delete(phrase);
    return true;
  }
  // If no exact match, complete earliest due
  if (p.times.length > 0) {
    p.times.shift();
    if (p.times.length === 0) plans.delete(phrase);
    return true;
  }
  return false;
}
