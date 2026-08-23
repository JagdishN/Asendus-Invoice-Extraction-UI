import { environment } from '../../../environments/environment';

/**
 * Builds a backend API URL from environment.apiBaseUrl. Every service that
 * calls the backend should go through this instead of concatenating
 * environment.apiBaseUrl inline, so the base URL only has to change in the
 * environment files.
 */
export function buildApiUrl(path: string): string {
  const base = environment.apiBaseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
