import { filenameFromContentDisposition, triggerBlobDownload } from './download';

describe('filenameFromContentDisposition', () => {
  it('returns null for a missing header', () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
  });

  it('reads a plain filename= form', () => {
    expect(filenameFromContentDisposition('attachment; filename="invoice-1.csv"')).toBe('invoice-1.csv');
  });

  it('reads an unquoted filename= form', () => {
    expect(filenameFromContentDisposition('attachment; filename=invoice-1.csv')).toBe('invoice-1.csv');
  });

  it("prefers the RFC 5987 filename*= form when both are present", () => {
    const header = "attachment; filename=\"fallback.csv\"; filename*=UTF-8''invoice%20%231.csv";
    expect(filenameFromContentDisposition(header)).toBe('invoice #1.csv');
  });

  it('returns null when neither form is present', () => {
    expect(filenameFromContentDisposition('attachment')).toBeNull();
  });
});

describe('triggerBlobDownload', () => {
  it('creates an object URL, clicks a hidden anchor with the given filename, then revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const blob = new Blob(['data'], { type: 'text/csv' });
    triggerBlobDownload(blob, 'invoice-1.csv');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
