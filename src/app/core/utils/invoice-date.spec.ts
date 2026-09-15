import { formatInvoiceDate } from './invoice-date';

describe('formatInvoiceDate', () => {
  it('formats the real backend format (DD.MM.YYYY) as DD-MMM-YYYY', () => {
    expect(formatInvoiceDate('17.08.2026')).toBe('17-Aug-2026');
  });

  it('zero-pads a single-digit day', () => {
    expect(formatInvoiceDate('7.01.2026')).toBe('07-Jan-2026');
  });

  it('maps every month correctly', () => {
    expect(formatInvoiceDate('01.01.2026')).toBe('01-Jan-2026');
    expect(formatInvoiceDate('01.12.2026')).toBe('01-Dec-2026');
  });

  it('returns the raw string unchanged for an unrecognized format, rather than guessing', () => {
    expect(formatInvoiceDate('2026-08-17')).toBe('2026-08-17');
    expect(formatInvoiceDate('Aug-2026')).toBe('Aug-2026');
    expect(formatInvoiceDate('not a date')).toBe('not a date');
  });

  it('returns the raw string unchanged when the month is out of range', () => {
    expect(formatInvoiceDate('17.13.2026')).toBe('17.13.2026');
    expect(formatInvoiceDate('17.00.2026')).toBe('17.00.2026');
  });
});
