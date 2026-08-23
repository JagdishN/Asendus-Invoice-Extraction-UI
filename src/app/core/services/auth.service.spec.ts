import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

describe('AuthService', () => {
  let service: AuthService;
  let router: Router;
  let toastService: ToastService;
  let httpMock: HttpTestingController;
  let loginUrl: string;

  beforeEach(() => {
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
});
