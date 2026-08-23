/** Pulls a filename out of a Content-Disposition header, preferring the RFC 5987 filename*= form. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // Malformed encoding — fall through to the plain filename form.
    }
  }
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : null;
}

/** Triggers a browser download of a blob via the standard hidden-anchor-tag pattern. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
