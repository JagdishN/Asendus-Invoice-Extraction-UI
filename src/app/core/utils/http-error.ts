import { HttpErrorResponse } from '@angular/common/http';

/** Pulls a user-readable message out of a FastAPI-style error body ({ detail } or { message }). */
export function extractErrorDetail(error: HttpErrorResponse): string | null {
  const body = error.error;
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object') {
    if (typeof (body as { detail?: unknown }).detail === 'string') {
      return (body as { detail: string }).detail;
    }
    if (typeof (body as { message?: unknown }).message === 'string') {
      return (body as { message: string }).message;
    }
  }
  return null;
}
