/** Formats a possibly non-contiguous page list, e.g. [1, 2, 3, 7] -> "Pages 1-3, 7". */
export function formatPageRanges(pages: number[] | undefined | null): string {
  if (!pages || pages.length === 0) {
    return 'Pages —';
  }

  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
      continue;
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    start = current;
    end = current;
  }

  return `Pages ${parts.join(', ')}`;
}
