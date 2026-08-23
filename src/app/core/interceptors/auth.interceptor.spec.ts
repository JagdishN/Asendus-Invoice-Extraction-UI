import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { AuthApiService } from '../services/auth-api.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let loginUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    loginUrl = TestBed.inject(AuthApiService).loginUrl;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function login(): void {
    auth.login('Admin', 'Admin@123').subscribe();
    const req = httpMock.expectOne(loginUrl);
    req.flush({ access_token: 'jwt-123', token_type: 'bearer' });
  }

  it('does not attach an Authorization header when the user is not logged in', () => {
    http.get('/api/jobs').subscribe();

    const req = httpMock.expectOne('/api/jobs');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('attaches a Bearer Authorization header for API requests once logged in', () => {
    login();

    http.get('/api/jobs').subscribe();

    const req = httpMock.expectOne('/api/jobs');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush([]);
  });

  it('never falls back to Basic auth', () => {
    login();

    http.get('/api/jobs').subscribe();

    const req = httpMock.expectOne('/api/jobs');
    expect(req.request.headers.get('Authorization')).not.toContain('Basic');
    req.flush([]);
  });

  it('does not attach the header to requests outside the API base URL', () => {
    login();

    http.get('/assets/config.json').subscribe();

    const req = httpMock.expectOne('/assets/config.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('on a 401 from a protected API route, expires the session and redirects to /login', () => {
    login();
    const router = TestBed.inject(Router);
    const toastService = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toastService, 'warning');

    http.get('/api/jobs').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/jobs');
    req.flush({ detail: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Your session has expired. Please log in again.');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('a 401 on GET /api/jobs before ever logging in is also handled gracefully (session expiry, not a raw error)', () => {
    const router = TestBed.inject(Router);

    http.get('/api/jobs').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/jobs');
    req.flush({ detail: 'Not authenticated' }, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('does not trigger session expiry for a 401 on the login endpoint itself', () => {
    const router = TestBed.inject(Router);

    auth.login('Admin', 'wrong').subscribe({ error: () => {} });
    const req = httpMock.expectOne(loginUrl);
    req.flush({ detail: 'Invalid username or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
