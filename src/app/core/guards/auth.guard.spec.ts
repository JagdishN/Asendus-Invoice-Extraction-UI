import { provideRouter, Router, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthApiService } from '../services/auth-api.service';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { login: () => of({ access_token: 'jwt-123', token_type: 'bearer' }) } }
      ]
    });
  });

  it('allows activation when the user is authenticated', () => {
    const auth = TestBed.inject(AuthService);
    auth.login('Admin', 'Admin@123').subscribe();

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects to /login when the user is not authenticated', () => {
    const router = TestBed.inject(Router);
    const createUrlTreeSpy = vi.spyOn(router, 'createUrlTree');

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBeInstanceOf(UrlTree);
    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/login']);
  });
});
