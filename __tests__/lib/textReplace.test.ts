import { replaceFirst } from '@/lib/textReplace';

describe('replaceFirst', () => {
  it('replaces the first occurrence only', () => {
    const out = replaceFirst('a b a b', 'a', 'X');
    expect(out).toBe('X b a b');
  });

  it('returns original when phrase not found', () => {
    const out = replaceFirst('hello', 'world', 'X');
    expect(out).toBe('hello');
  });

  it('handles empty phrase gracefully', () => {
    const out = replaceFirst('hello', '', 'X');
    expect(out).toBe('hello');
  });
});

