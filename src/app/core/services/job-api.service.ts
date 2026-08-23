import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

import { CreateJobResponse, JobApiError, JobDetail, JobExportResult, JobSummary } from '../models/job.models';
import { buildApiUrl } from '../utils/api-url';
import { filenameFromContentDisposition } from '../utils/download';
import { extractErrorDetail } from '../utils/http-error';

/**
 * Thin HTTP wrapper around the FastAPI job endpoints.
 * Translates the backend's 409 "no split value" response into a typed
 * confirmation-required error so callers can prompt instead of treating it
 * as a failure, and a 401 into an "unauthorized" error so callers can skip
 * their own generic error toast (authInterceptor already handles the
 * session-expired redirect for that case).
 */
@Injectable({ providedIn: 'root' })
export class JobApiService {
  private readonly baseUrl = buildApiUrl('/jobs');

  constructor(private readonly http: HttpClient) {}

  createJob(file: File, splitValue: string, confirmedNoSplit: boolean): Observable<CreateJobResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (splitValue) {
      formData.append('split_value', splitValue);
    }
    formData.append('confirmed_no_split', String(confirmedNoSplit));

    return this.http
      .post<CreateJobResponse>(this.baseUrl, formData)
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.toJobApiError(error))));
  }

  listJobs(): Observable<JobSummary[]> {
    return this.http
      .get<JobSummary[]>(this.baseUrl)
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.toJobApiError(error))));
  }

  getJob(jobId: string): Observable<JobDetail> {
    return this.http
      .get<JobDetail>(`${this.baseUrl}/${jobId}`)
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.toJobApiError(error))));
  }

  /** Default export: a zip when the job has multiple invoices, the single CSV directly otherwise — same call either way, per the backend's own default-download logic. */
  exportJob(jobId: string): Observable<JobExportResult> {
    return this.http
      .get(`${this.baseUrl}/${jobId}/export`, { observe: 'response', responseType: 'blob' })
      .pipe(
        map((response) => this.toExportResult(response)),
        catchError((error: HttpErrorResponse) => this.toBlobError(error))
      );
  }

  /** Exports a single invoice's CSV. invoice_number may contain '/', so it's percent-encoded before going into the URL path. */
  exportInvoice(jobId: string, invoiceNumber: string): Observable<JobExportResult> {
    return this.http
      .get(`${this.baseUrl}/${jobId}/export/${encodeURIComponent(invoiceNumber)}`, {
        observe: 'response',
        responseType: 'blob'
      })
      .pipe(
        map((response) => this.toExportResult(response)),
        catchError((error: HttpErrorResponse) => this.toBlobError(error))
      );
  }

  private toExportResult(response: HttpResponse<Blob>): JobExportResult {
    return {
      blob: response.body as Blob,
      filename: filenameFromContentDisposition(response.headers.get('content-disposition')),
      contentType: response.headers.get('content-type')
    };
  }

  /**
   * Requests made with responseType: 'blob' deliver the error body as a Blob too (Angular
   * doesn't sniff content-type to auto-parse it), so the JSON `detail` has to be read out of
   * the blob asynchronously before it can be mapped the same way as a normal JSON error.
   */
  private toBlobError(error: HttpErrorResponse): Observable<never> {
    const body: unknown = error.error;
    if (!(body instanceof Blob)) {
      return throwError(() => this.toJobApiError(error));
    }
    return from(body.text()).pipe(
      switchMap((text) => {
        let detail: string | null = null;
        try {
          const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
          detail = typeof parsed.detail === 'string' ? parsed.detail : typeof parsed.message === 'string' ? parsed.message : null;
        } catch {
          // Not JSON — fall back to the generic message in toJobApiError.
        }
        return throwError(() => this.toJobApiError(error, detail));
      })
    );
  }

  private toJobApiError(error: HttpErrorResponse, detailOverride?: string | null): JobApiError {
    const detail = detailOverride ?? extractErrorDetail(error);

    if (error.status === 401) {
      return { kind: 'unauthorized', message: detail ?? 'Your session has expired. Please log in again.', status: 401 };
    }
    if (error.status === 409) {
      return { kind: 'confirmation-required', message: detail ?? 'Confirmation required.', status: 409 };
    }
    if (error.status === 400) {
      return { kind: 'validation-error', message: detail ?? 'The request was invalid.', status: 400 };
    }
    return {
      kind: 'unknown',
      message: detail ?? 'Something went wrong talking to the server. Please try again.',
      status: error.status
    };
  }
}
