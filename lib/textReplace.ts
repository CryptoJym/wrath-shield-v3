/**
 * Replace the first occurrence of a substring in text. If not found, returns original text.
 */
export function replaceFirst(text: string, phrase: string, replacement: string): string {
  if (!phrase) return text;
  const idx = text.indexOf(phrase);
  if (idx < 0) return text;
  return text.slice(0, idx) + replacement + text.slice(idx + phrase.length);
}

