import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { ToastService } from './toast.service';

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_STORAGE_KEY = 'invoice-extraction-ui.auth-session';

interface StoredSession {
  token: string;
  expiresAt: number;
}

/**
 * Holds the logged-in session: an access token from the real
 * POST /api/auth/login endpoint (via AuthApiService), persisted to
 * localStorage alongside its absolute expiry time so a page refresh (or a
 * new tab) restores the session instead of forcing a re-login — it only
 * actually expires when the 30-minute timer from the original login elapses,
 * or a protected API call comes back 401. authInterceptor reads
 * accessToken() to attach it as a Bearer header.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly token = signal<string | null>(null);
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isAuthenticated = computed(() => this.token() !== null);
  readonly accessToken = this.token.asReadonly();

  constructor() {
    this.restoreSession();
  }

  /** Calls the real backend login endpoint; on success stores the returned access token. */
  login(username: string, password: string): Observable<void> {
    return this.authApi.login(username, password).pipe(
      tap((response) => this.startSession(response.access_token, SESSION_DURATION_MS)),
      map(() => undefined)
    );
  }

  /** User-initiated logout: clears the session and returns to Login, no toast. */
  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  /**
   * Involuntary session end — the 30-minute timer, or authInterceptor seeing
   * a 401 from a protected API route. Clears the session, tells the user why,
   * and returns to Login.
   */
  expireSession(): void {
    this.clearSession();
    this.toast.warning('Your session has expired. Please log in again.');
    this.router.navigateByUrl('/login');
  }

  /** Runs once at app startup: resumes a still-valid session from localStorage, or discards a stale one. */
  private restoreSession(): void {
    const stored = this.readStoredSession();
    if (!stored) {
      return;
    }
    const remainingMs = stored.expiresAt - Date.now();
    if (remainingMs <= 0) {
      this.removeStoredSession();
      return;
    }
    this.token.set(stored.token);
    this.scheduleExpiry(remainingMs);
  }

  private startSession(token: string, durationMs: number): void {
    const expiresAt = Date.now() + durationMs;
    this.token.set(token);
    this.writeStoredSession({ token, expiresAt });
    this.scheduleExpiry(durationMs);
  }

  private scheduleExpiry(delayMs: number): void {
    this.clearSessionTimer();
    this.sessionTimer = setTimeout(() => this.expireSession(), delayMs);
  }

  private clearSession(): void {
    this.token.set(null);
    this.clearSessionTimer();
    this.removeStoredSession();
  }

  private clearSessionTimer(): void {
    if (this.sessionTimer !== null) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  private readStoredSession(): StoredSession | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') {
        return null;
      }
      return { token: parsed.token, expiresAt: parsed.expiresAt };
    } catch {
      return null;
    }
  }

  private writeStoredSession(session: StoredSession): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) — session still works for this tab via the signal.
    }
  }

  private removeStoredSession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Nothing to clean up if localStorage isn't available in the first place.
    }
  }
}
