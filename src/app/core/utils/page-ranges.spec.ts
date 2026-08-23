import { formatPageRanges } from './page-ranges';

describe('formatPageRanges', () => {
  it('formats a non-contiguous list with runs collapsed', () => {
    expect(formatPageRanges([1, 2, 3, 7])).toBe('Pages 1-3, 7');
  });

  it('formats a single page', () => {
    expect(formatPageRanges([5])).toBe('Pages 5');
  });

  it('formats a fully contiguous range', () => {
    expect(formatPageRanges([1, 2, 3, 4])).toBe('Pages 1-4');
  });

  it('sorts and dedupes out-of-order input', () => {
    expect(formatPageRanges([3, 1, 2, 1])).toBe('Pages 1-3');
  });

  it('handles multiple separate runs', () => {
    expect(formatPageRanges([1, 2, 5, 6, 9])).toBe('Pages 1-2, 5-6, 9');
  });

  it('falls back to a placeholder for empty or missing input', () => {
    expect(formatPageRanges([])).toBe('Pages —');
    expect(formatPageRanges(undefined)).toBe('Pages —');
    expect(formatPageRanges(null)).toBe('Pages —');
  });
});
