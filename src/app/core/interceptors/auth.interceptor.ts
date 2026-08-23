import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthApiService } from '../services/auth-api.service';
import { AuthService } from '../services/auth.service';

/**
 * Attaches `Authorization: Bearer <token>` to API requests once logged in
 * (no header at all when there's no token — never a Basic-auth fallback).
 * A 401 from any protected API route is treated as an expired/invalid
 * session: AuthService clears it and redirects to Login. The login request
 * itself is excluded — a 401 there just means wrong credentials, which
 * LoginPage handles and displays directly.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const authApi = inject(AuthApiService);

  const token = auth.accessToken();
  const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
  const isLoginRequest = req.url === authApi.loginUrl;

  const authedReq = token && isApiRequest ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isApiRequest && !isLoginRequest) {
        auth.expireSession();
      }
      return throwError(() => error);
    })
  );
};
