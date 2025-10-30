import { buildHighlightSegments } from '@/lib/flagHighlighter';

describe('buildHighlightSegments', () => {
  it('returns whole text as unflagged when no flags', () => {
    const segs = buildHighlightSegments('hello world', []);
    expect(segs).toEqual([{ text: 'hello world', flagged: false }]);
  });

  it('splits into flagged and unflagged segments for single flag', () => {
    const segs = buildHighlightSegments('hello world', [{ position: 6, phrase: 'world' }]);
    expect(segs).toEqual([
      { text: 'hello ', flagged: false },
      { text: 'world', flagged: true },
    ]);
  });

  it('merges overlapping flags', () => {
    const segs = buildHighlightSegments('abcdef', [
      { position: 1, phrase: 'bcd' }, // 1..4
      { position: 3, phrase: 'def' }, // 3..6
    ]);
    expect(segs).toEqual([
      { text: 'a', flagged: false },
      { text: 'bcdef', flagged: true },
    ]);
  });

  it('ignores out-of-bound flags', () => {
    const segs = buildHighlightSegments('abc', [
      { position: -1, phrase: 'a' },
      { position: 2, phrase: 'cd' }, // goes beyond length
    ]);
    expect(segs).toEqual([{ text: 'abc', flagged: false }]);
  });
});

