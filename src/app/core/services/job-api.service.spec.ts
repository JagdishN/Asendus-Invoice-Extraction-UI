import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CreateJobResponse, JobDetail, JobSummary } from '../models/job.models';
import { JobApiService } from './job-api.service';

describe('JobApiService', () => {
  let service: JobApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [JobApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(JobApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createJob', () => {
    it('posts a multipart request with file, split_value, and confirmed_no_split', () => {
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });
      const response: CreateJobResponse = { job_id: 'abc123', status: 'queued', page_count: 3 };

      service.createJob(file, '1-3', false).subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/jobs');
      expect(req.request.method).toBe('POST');
      const body = req.request.body as FormData;
      expect(body.get('file')).toBe(file);
      expect(body.get('split_value')).toBe('1-3');
      expect(body.get('confirmed_no_split')).toBe('false');
      req.flush(response);
    });

    it('omits split_value from the form data when empty', () => {
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });

      service.createJob(file, '', true).subscribe();

      const req = httpMock.expectOne('/api/jobs');
      const body = req.request.body as FormData;
      expect(body.get('split_value')).toBeNull();
      expect(body.get('confirmed_no_split')).toBe('true');
      req.flush({ job_id: 'x', status: 'queued', page_count: 1 });
    });

    it('translates a 401 response into an unauthorized error', () => {
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });
      let captured: unknown;

      service.createJob(file, '', false).subscribe({ error: (err) => (captured = err) });

      const req = httpMock.expectOne('/api/jobs');
      req.flush({ detail: 'Not authenticated' }, { status: 401, statusText: 'Unauthorized' });

      expect(captured).toEqual({ kind: 'unauthorized', message: 'Not authenticated', status: 401 });
    });

    it('translates a 409 response into a confirmation-required error', () => {
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });
      let captured: unknown;

      service.createJob(file, '', false).subscribe({ error: (err) => (captured = err) });

      const req = httpMock.expectOne('/api/jobs');
      req.flush(
        { detail: 'No split value has been entered.' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(captured).toEqual({
        kind: 'confirmation-required',
        message: 'No split value has been entered.',
        status: 409
      });
    });

    it('translates a 400 response into a validation-error', () => {
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });
      let captured: unknown;

      service.createJob(file, 'abc', false).subscribe({ error: (err) => (captured = err) });

      const req = httpMock.expectOne('/api/jobs');
      req.flush({ detail: "'abc' isn't a valid page or range." }, { status: 400, statusText: 'Bad Request' });

      expect(captured).toEqual({
        kind: 'validation-error',
        message: "'abc' isn't a valid page or range.",
        status: 400
      });
    });

    it('surfaces a raw string error body for unexpected error statuses', () => {
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });
      let captured: unknown;

      service.createJob(file, '', false).subscribe({ error: (err) => (captured = err) });

      const req = httpMock.expectOne('/api/jobs');
      req.flush('server exploded', { status: 500, statusText: 'Internal Server Error' });

      expect(captured).toEqual({ kind: 'unknown', message: 'server exploded', status: 500 });
    });

    it('falls back to a generic message when the error body has no detail/message', () => {
      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });
      let captured: unknown;

      service.createJob(file, '', false).subscribe({ error: (err) => (captured = err) });

      const req = httpMock.expectOne('/api/jobs');
      req.flush({}, { status: 500, statusText: 'Internal Server Error' });

      expect(captured).toEqual({
        kind: 'unknown',
        message: 'Something went wrong talking to the server. Please try again.',
        status: 500
      });
    });
  });

  describe('listJobs', () => {
    it('gets the jobs list', () => {
      const jobs: JobSummary[] = [
        {
          job_id: '1',
          original_filename: 'a.pdf',
          status: 'queued',
          invoice_count: 0,
          created_at: '2026-01-01T00:00:00Z'
        }
      ];

      service.listJobs().subscribe((result) => expect(result).toEqual(jobs));

      const req = httpMock.expectOne('/api/jobs');
      expect(req.request.method).toBe('GET');
      req.flush(jobs);
    });
  });

  describe('getJob', () => {
    it('gets a single job by id', () => {
      const job: JobDetail = {
        job_id: '1',
        original_filename: 'a.pdf',
        status: 'queued',
        created_at: '2026-01-01T00:00:00Z'
      };

      service.getJob('1').subscribe((result) => expect(result).toEqual(job));

      const req = httpMock.expectOne('/api/jobs/1');
      expect(req.request.method).toBe('GET');
      req.flush(job);
    });
  });

  describe('exportJob', () => {
    it('gets the export as a blob and reads the filename off Content-Disposition', () => {
      const blob = new Blob(['a,b\n1,2'], { type: 'text/csv' });
      let result: { blob: Blob; filename: string | null; contentType: string | null } | undefined;

      service.exportJob('1').subscribe((r) => (result = r));

      const req = httpMock.expectOne('/api/jobs/1/export');
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(blob, {
        headers: { 'Content-Disposition': 'attachment; filename="job-1.csv"', 'Content-Type': 'text/csv' }
      });

      expect(result?.blob).toBe(blob);
      expect(result?.filename).toBe('job-1.csv');
      expect(result?.contentType).toBe('text/csv');
    });

    it('returns a null filename when Content-Disposition is absent', () => {
      const blob = new Blob(['data']);
      let result: { filename: string | null } | undefined;

      service.exportJob('1').subscribe((r) => (result = r));

      httpMock.expectOne('/api/jobs/1/export').flush(blob);

      expect(result?.filename).toBeNull();
    });

    it('translates a blob-bodied 401 error into an unauthorized JobApiError', async () => {
      let captured: unknown;
      service.exportJob('1').subscribe({ error: (err) => (captured = err) });

      const req = httpMock.expectOne('/api/jobs/1/export');
      const errorBlob = new Blob([JSON.stringify({ detail: 'Not authenticated' })], { type: 'application/json' });
      req.flush(errorBlob, { status: 401, statusText: 'Unauthorized' });

      await vi.waitFor(() => expect(captured).toBeDefined());
      expect(captured).toEqual({ kind: 'unauthorized', message: 'Not authenticated', status: 401 });
    });

    it('falls back to a generic message when the blob error body is not JSON', async () => {
      let captured: unknown;
      service.exportJob('1').subscribe({ error: (err) => (captured = err) });

      const req = httpMock.expectOne('/api/jobs/1/export');
      const errorBlob = new Blob(['not json'], { type: 'text/plain' });
      req.flush(errorBlob, { status: 500, statusText: 'Internal Server Error' });

      await vi.waitFor(() => expect(captured).toBeDefined());
      expect(captured).toEqual({
        kind: 'unknown',
        message: 'Something went wrong talking to the server. Please try again.',
        status: 500
      });
    });
  });

  describe('exportInvoice', () => {
    it('gets a single invoice export, percent-encoding a "/" in the invoice number', () => {
      const blob = new Blob(['a,b\n1,2'], { type: 'text/csv' });
      let result: { blob: Blob } | undefined;

      service.exportInvoice('1', 'INV/2026/001').subscribe((r) => (result = r));

      const req = httpMock.expectOne('/api/jobs/1/export/INV%2F2026%2F001');
      expect(req.request.method).toBe('GET');
      req.flush(blob);

      expect(result?.blob).toBe(blob);
    });
  });
});
