import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exposes loginUrl built from environment.apiBaseUrl', () => {
    expect(service.loginUrl).toBe('/api/auth/login');
  });

  it('posts { username, password } as JSON and returns the access token on success', () => {
    service.login('Admin', 'Admin@123').subscribe((result) => {
      expect(result).toEqual({ access_token: 'jwt-123', token_type: 'bearer' });
    });

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'Admin', password: 'Admin@123' });
    req.flush({ access_token: 'jwt-123', token_type: 'bearer' });
  });

  it('surfaces the backend detail message on a 401', () => {
    let captured: unknown;
    service.login('Admin', 'wrong').subscribe({ error: (err) => (captured = err) });

    const req = httpMock.expectOne('/api/auth/login');
    req.flush({ detail: 'Invalid username or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(captured).toEqual({ message: 'Invalid username or password', status: 401 });
  });

  it('falls back to a generic message when the error body has no detail', () => {
    let captured: unknown;
    service.login('Admin', 'wrong').subscribe({ error: (err) => (captured = err) });

    const req = httpMock.expectOne('/api/auth/login');
    req.flush({}, { status: 500, statusText: 'Internal Server Error' });

    expect(captured).toEqual({ message: 'Unable to sign in. Please try again.', status: 500 });
  });
});
