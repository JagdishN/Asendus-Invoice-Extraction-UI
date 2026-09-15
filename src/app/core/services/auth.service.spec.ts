import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

// Mirrors AuthService's private SESSION_STORAGE_KEY — there's no exported constant to import.
const SESSION_STORAGE_KEY = 'invoice-extraction-ui.auth-session';

describe('AuthService', () => {
  let service: AuthService;
  let router: Router;
  let toastService: ToastService;
  let httpMock: HttpTestingController;
  let loginUrl: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    toastService = TestBed.inject(ToastService);
    httpMock = TestBed.inject(HttpTestingController);
    loginUrl = TestBed.inject(AuthApiService).loginUrl;
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
    localStorage.clear();
  });

  function login(username = 'Admin', password = 'Admin@123'): void {
    service.login(username, password).subscribe();
    const req = httpMock.expectOne(loginUrl);
    req.flush({ access_token: 'jwt-123', token_type: 'bearer' });
  }

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('login() posts { username, password } to /api/auth/login', () => {
    service.login('Admin', 'Admin@123').subscribe();

    const req = httpMock.expectOne(loginUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'Admin', password: 'Admin@123' });
    req.flush({ access_token: 'jwt-123', token_type: 'bearer' });
  });

  it('login() success stores the access token and sets isAuthenticated', () => {
    login();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('jwt-123');
  });

  it('login() failure (401) propagates the error and leaves the user unauthenticated', () => {
    let captured: unknown;
    service.login('Admin', 'wrong').subscribe({ error: (err) => (captured = err) });

    const req = httpMock.expectOne(loginUrl);
    req.flush({ detail: 'Invalid username or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(captured).toEqual({ message: 'Invalid username or password', status: 401 });
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('logout() clears the token and navigates to /login without a toast', () => {
    login();
    const toastSpy = vi.spyOn(toastService, 'warning');

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('expireSession() clears the token, toasts a warning, and navigates to /login', () => {
    login();
    const toastSpy = vi.spyOn(toastService, 'warning');

    service.expireSession();

    expect(service.isAuthenticated()).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Your session has expired. Please log in again.');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('auto-expires the session after 30 minutes', () => {
    vi.useFakeTimers();
    login();

    vi.advanceTimersByTime(30 * 60 * 1000 - 1);
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(service.isAuthenticated()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('logging in again resets the 30 minute session timer', () => {
    vi.useFakeTimers();
    login();
    vi.advanceTimersByTime(20 * 60 * 1000);

    login();
    vi.advanceTimersByTime(20 * 60 * 1000);

    // 40 minutes have passed since the first login, but only 20 since the second.
    expect(service.isAuthenticated()).toBe(true);
  });

  describe('persisting the session across a page refresh (localStorage)', () => {
    /** Simulates an app restart: a fresh TestBed injector, so AuthService's constructor re-runs against whatever localStorage holds right now. */
    function reinject(): AuthService {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
      });
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      return TestBed.inject(AuthService);
    }

    it('login() persists the token and an absolute expiry time to localStorage', () => {
      login();

      const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null');
      expect(stored.token).toBe('jwt-123');
      expect(stored.expiresAt).toBeGreaterThan(Date.now());
      expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + 30 * 60 * 1000);
    });

    it('restores a still-valid session from localStorage on startup, instead of forcing a re-login', () => {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ token: 'restored-jwt', expiresAt: Date.now() + 5 * 60 * 1000 })
      );

      const restored = reinject();

      expect(restored.isAuthenticated()).toBe(true);
      expect(restored.accessToken()).toBe('restored-jwt');
    });

    it('discards an expired stored session and starts unauthenticated', () => {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ token: 'stale-jwt', expiresAt: Date.now() - 1000 })
      );

      const restored = reinject();

      expect(restored.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });

    it('schedules expiry for the remaining time left, not a fresh 30 minutes, after restoring', () => {
      vi.useFakeTimers();
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ token: 'restored-jwt', expiresAt: Date.now() + 2 * 60 * 1000 })
      );

      const restored = reinject();

      vi.advanceTimersByTime(2 * 60 * 1000 - 1);
      expect(restored.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(1);
      expect(restored.isAuthenticated()).toBe(false);
    });

    it('logout() removes the stored session so a refresh afterward stays logged out', () => {
      login();

      service.logout();

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });

    it('expireSession() removes the stored session', () => {
      login();

      service.expireSession();

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });
  });
});
