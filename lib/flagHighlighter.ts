export type Segment = { text: string; flagged: boolean };

export type FlagLike = {
  position: number; // start index
  phrase: string;   // matched phrase
};

/**
 * Build non-overlapping highlight segments given text and flags.
 * Flags are assumed to reference substrings within the text. Overlaps are merged.
 */
export function buildHighlightSegments(text: string, flags: FlagLike[]): Segment[] {
  if (!text) return [];
  if (!flags || flags.length === 0) return [{ text, flagged: false }];

  // Normalize and sort by start position
  const ranges = flags
    .map((f) => ({ start: f.position, end: f.position + f.phrase.length }))
    .filter((r) => r.start >= 0 && r.end > r.start && r.end <= text.length)
    .sort((a, b) => a.start - b.start);

  // Merge overlaps
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r.start > last.end) {
      merged.push({ ...r });
    } else {
      last.end = Math.max(last.end, r.end);
    }
  }

  const segs: Segment[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) segs.push({ text: text.slice(cursor, r.start), flagged: false });
    segs.push({ text: text.slice(r.start, r.end), flagged: true });
    cursor = r.end;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor), flagged: false });
  return segs;
}

