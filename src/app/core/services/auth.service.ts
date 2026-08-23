import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { ToastService } from './toast.service';

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Holds the logged-in session: an access token from the real
 * POST /api/auth/login endpoint (via AuthApiService), in memory only — never
 * localStorage/sessionStorage, so a page refresh logs the user out.
 * authInterceptor reads accessToken() to attach it as a Bearer header.
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

  /** Calls the real backend login endpoint; on success stores the returned access token. */
  login(username: string, password: string): Observable<void> {
    return this.authApi.login(username, password).pipe(
      tap((response) => {
        this.token.set(response.access_token);
        this.startSessionTimer();
      }),
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

  private startSessionTimer(): void {
    this.clearSessionTimer();
    this.sessionTimer = setTimeout(() => this.expireSession(), SESSION_DURATION_MS);
  }

  private clearSession(): void {
    this.token.set(null);
    this.clearSessionTimer();
  }

  private clearSessionTimer(): void {
    if (this.sessionTimer !== null) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }
}
