import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { AuthApiError, LoginResponse } from '../models/auth.models';
import { buildApiUrl } from '../utils/api-url';
import { extractErrorDetail } from '../utils/http-error';

/** Thin HTTP wrapper around the backend's real POST /api/auth/login endpoint. */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  /** Exposed so authInterceptor can exclude this exact request from its 401-session-expiry handling. */
  readonly loginUrl = buildApiUrl('/auth/login');

  constructor(private readonly http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(this.loginUrl, { username, password })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.toAuthApiError(error))));
  }

  private toAuthApiError(error: HttpErrorResponse): AuthApiError {
    const detail = extractErrorDetail(error);
    return { message: detail ?? 'Unable to sign in. Please try again.', status: error.status };
  }
}
