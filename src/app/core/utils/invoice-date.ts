const DOT_DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats the invoice_date header field as DD-MMM-YYYY, e.g. "17.08.2026" -> "17-Aug-2026".
 * The backend sends it as "DD.MM.YYYY" (confirmed against a real job) — anything else is
 * returned unchanged rather than guessed at, so an unexpected format degrades gracefully
 * instead of showing something wrong.
 */
export function formatInvoiceDate(raw: string): string {
  const match = DOT_DATE_PATTERN.exec(raw);
  if (!match) {
    return raw;
  }

  const [, day, month, year] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return raw;
  }

  return `${day.padStart(2, '0')}-${MONTH_ABBREVIATIONS[monthIndex]}-${year}`;
}
