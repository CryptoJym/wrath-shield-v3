/*
  Analyze .analysis/lifelogs.jsonl and produce .analysis/psych_profile.md
  - Basic stats by source
  - Time-of-day histogram
  - Simple sentiment (lexicon-based) and emotion keyword counts (very light heuristic)
  - Top terms (naive TF)

  NOTE: This is an informational analysis, not a clinical diagnosis.
*/
import fs from 'fs';
import path from 'path';
import readline from 'readline';

type Record = { timestamp?: string; source: string; type?: string; text?: string; metadata?: any };

const projectRoot = path.resolve(__dirname, '..');
const inPath = path.join(projectRoot, '..', '.analysis', 'lifelogs.jsonl');
const outPath = path.join(projectRoot, '..', '.analysis', 'psych_profile.md');

const POS = new Set([
  'good','great','excellent','love','happy','joy','calm','proud','confident','grateful','progress','win','improved','strong','peace','hope','trust','excited','energized','resilient','productive'
]);
const NEG = new Set([
  'bad','sad','angry','anxious','anxiety','stressed','stress','overwhelmed','tired','exhausted','failed','worried','fear','guilty','shame','panic','lonely','depressed','burnout','regret'
]);
const EMO: Record<string, string[]> = {
  joy: ['joy','happy','grateful','love','excited','optimistic','content'],
  sadness: ['sad','grief','down','blue','cry','lonely','depressed','regret'],
  anger: ['angry','rage','irritated','frustrated','mad','furious'],
  fear: ['fear','afraid','anxious','panic','worry','worried','tense'],
  disgust: ['disgust','gross','repulsed','nausea'],
  surprise: ['surprised','shock','amazed','unexpected'],
  trust: ['trust','secure','safe','confident','reliable'],
  anticipation: ['anticipate','eager','excited','looking forward','plan']
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

async function streamAnalyze() {
  const res = {
    bySource: {} as Record<string, number>,
    hourHist: Array.from({ length: 24 }, () => 0),
    total: 0,
    totalWords: 0,
    uniqueWords: 0,
    pos: 0,
    neg: 0,
    emoCounts: Object.fromEntries(Object.keys(EMO).map(k => [k, 0])) as Record<string, number>,
    vocab: new Map<string, number>(),
  };
  const rl = readline.createInterface({ input: fs.createReadStream(inPath, { encoding: 'utf8' }) });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    let r: Record | null = null;
    try { r = JSON.parse(t); } catch { continue; }
    res.total++;
    const src = r.source ?? 'unknown';
    res.bySource[src] = (res.bySource[src] ?? 0) + 1;
    const h = hour(r.timestamp);
    if (h !== undefined) res.hourHist[h]++;
    if (r.text) {
      const toks = tokenize(r.text);
      res.totalWords += toks.length;
      for (const w of toks) {
        res.vocab.set(w, (res.vocab.get(w) ?? 0) + 1);
        if (POS.has(w)) res.pos++;
        if (NEG.has(w)) res.neg++;
      }
      for (const [k, lex] of Object.entries(EMO)) {
        for (const kw of lex) {
          if (r.text.toLowerCase().includes(kw)) { (res.emoCounts as any)[k]++; break; }
        }
      }
    }
  }
  res.uniqueWords = res.vocab.size;
  const topTerms = [...res.vocab.entries()]
    .filter(([w]) => w.length > 3 && !POS.has(w) && !NEG.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  const sentimentScore = res.totalWords ? (res.pos - res.neg) / Math.max(1, res.pos + res.neg) : 0;
  return {
    bySource: res.bySource,
    hourHist: res.hourHist,
    total: res.total,
    totalWords: res.totalWords,
    uniqueWords: res.uniqueWords,
    ttr: res.totalWords ? res.uniqueWords / res.totalWords : 0,
    pos: res.pos,
    neg: res.neg,
    emoCounts: res.emoCounts,
    topTerms,
    sentimentScore,
  };
}

function hour(ts?: string): number | undefined {
  if (!ts) return undefined;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return undefined;
  return d.getHours();
}

function analyze(recs: Record[]) {
  const bySource: Record<string, number> = {} as any;
  const hourHist = Array.from({ length: 24 }, () => 0);
  let totalWords = 0;
  const vocab = new Map<string, number>();
  let pos = 0, neg = 0;
  const emoCounts: Record<string, number> = Object.fromEntries(Object.keys(EMO).map(k => [k, 0]));

  for (const r of recs) {
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    const h = hour(r.timestamp);
    if (h !== undefined) hourHist[h]++;
    if (!r.text) continue;
    const toks = tokenize(r.text);
    totalWords += toks.length;
    for (const w of toks) {
      vocab.set(w, (vocab.get(w) ?? 0) + 1);
      if (POS.has(w)) pos++;
      if (NEG.has(w)) neg++;
    }
    // Emotion keywords (very rough)
    for (const [k, lex] of Object.entries(EMO)) {
      for (const kw of lex) {
        if (r.text.toLowerCase().includes(kw)) { emoCounts[k]++; break; }
      }
    }
  }
  const uniqueWords = vocab.size;
  const ttr = totalWords ? uniqueWords / totalWords : 0;
  const sentimentScore = totalWords ? (pos - neg) / Math.max(1, pos + neg) : 0;
  const topTerms = [...vocab.entries()]
    .filter(([w]) => w.length > 3 && !POS.has(w) && !NEG.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  return { bySource, hourHist, total: recs.length, totalWords, uniqueWords, ttr, pos, neg, sentimentScore, emoCounts, topTerms };
}

function render(a: ReturnType<typeof analyze>) {
  const lines: string[] = [];
  lines.push('# Psychological Signal Analysis (Informational)\n');
  lines.push('_This analysis is informational only and not a diagnosis. If you have concerns about mental health or wellbeing, consider consulting a licensed professional._\n');
  lines.push('## Dataset\n');
  lines.push(`- Records analyzed: ${a.total}`);
  lines.push(`- Estimated words: ${a.totalWords}`);
  lines.push(`- Vocabulary size: ${a.uniqueWords}`);
  lines.push(`- Type-Token Ratio (lexical diversity): ${a.ttr.toFixed(3)}`);
  lines.push('');
  lines.push('### Sources');
  for (const [src, n] of Object.entries(a.bySource).sort((x, y) => y[1] - x[1])) {
    lines.push(`- ${src}: ${n}`);
  }
  lines.push('');
  lines.push('## Temporal Patterns');
  const busiest = a.hourHist.map((v, i) => ({ h: i, v })).sort((x, y) => y.v - x.v).slice(0, 5);
  lines.push('- Active hours (top 5 by entry volume):');
  for (const { h, v } of busiest) lines.push(`  - ${h}:00 → ${v} entries`);
  lines.push('');
  lines.push('## Affective Signals');
  lines.push(`- Sentiment (lexicon-based): ${a.sentimentScore >= 0 ? 'tilt positive' : 'tilt negative'} (${a.pos} positive terms vs ${a.neg} negative)`);
  lines.push('- Emotion keywords (rough counts):');
  for (const [k, n] of Object.entries(a.emoCounts).sort((x, y) => y[1] - x[1])) {
    lines.push(`  - ${k}: ${n}`);
  }
  lines.push('');
  lines.push('## Recurrent Themes (top terms)');
  lines.push(a.topTerms.map(([w, c]) => `- ${w}: ${c}`).join('\n'));
  lines.push('');
  lines.push('## Notes on Method');
  lines.push('- Local-only parsing; no data left this machine.');
  lines.push('- Sentiment/emotion are keyword-based heuristics and can be noisy.');
  lines.push('- Consider augmenting with physiological data (WHOOP) for richer correlations.');
  lines.push('');
  lines.push('## Next Suggestions');
  lines.push('- Add scheduled WHOOP + Limitless pulls and correlate mood terms with recovery/strain.');
  lines.push('- Identify stable “anchors” (values/goals) and track alignment mentions over time.');
  lines.push('- Add redaction layer for PII when sharing any excerpts.');
  return lines.join('\n');
}

async function main() {
  if (!fs.existsSync(inPath)) {
    console.error(`Input not found: ${inPath}. Run collect-lifelogs first.`);
    process.exit(1);
  }
  const a = await streamAnalyze();
  const md = render(a);
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`Report written: ${outPath}`);
  // Also write JSON summary next to the report for DB import
  const jsonOut = path.join(path.dirname(outPath), 'psych_profile.json');
  fs.writeFileSync(jsonOut, JSON.stringify({
    total: a.total,
    totalWords: a.totalWords,
    uniqueWords: a.uniqueWords,
    ttr: a.ttr,
    pos: a.pos,
    neg: a.neg,
    sentimentScore: a.sentimentScore,
    emoCounts: a.emoCounts,
    topTerms: a.topTerms,
    bySource: a.bySource,
    generatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
}

main();
