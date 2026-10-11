/** Word-level edit distance: each insertion, deletion or substitution costs one. */
export function transcriptEdits(original: string, edited: string): number {
  const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
  const a = words(original);
  const b = words(edited);
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) {
      next.push(Math.min((row[j + 1] ?? 0) + 1, (next[j] ?? 0) + 1, (row[j] ?? 0) + (a[i] === b[j] ? 0 : 1)));
    }
    row = next;
  }
  return row[b.length] ?? 0;
}