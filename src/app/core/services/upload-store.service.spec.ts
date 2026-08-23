import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { CreateJobResponse, JobApiError } from '../models/job.models';
import { JobApiService } from './job-api.service';
import { UploadState, UploadStore } from './upload-store.service';

describe('UploadStore', () => {
  let store: UploadStore;
  let createJob: ReturnType<typeof vi.fn>;
  const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [UploadStore, { provide: JobApiService, useValue: { createJob } }]
    });
    store = TestBed.inject(UploadStore);
  }

  function collect(): UploadState[] {
    const seen: UploadState[] = [];
    store.state$.subscribe((s) => seen.push(s));
    return seen;
  }

  beforeEach(() => {
    createJob = vi.fn();
  });

  it('starts idle', () => {
    setup();
    expect(collect()).toEqual([{ phase: 'idle' }]);
  });

  it('goes submitting -> success on a successful upload', () => {
    const response: CreateJobResponse = { job_id: 'j1', status: 'queued', page_count: 2 };
    createJob.mockReturnValue(of(response));
    setup();

    const seen = collect();
    store.submit(file, '1-2', false);

    expect(seen).toEqual([
      { phase: 'idle' },
      { phase: 'submitting' },
      { phase: 'success', result: response }
    ]);
    expect(createJob).toHaveBeenCalledWith(file, '1-2', false);
  });

  it('goes submitting -> needs-confirmation when the API reports a 409', () => {
    const error: JobApiError = { kind: 'confirmation-required', message: 'Confirm please.', status: 409 };
    createJob.mockReturnValue(throwError(() => error));
    setup();

    const seen = collect();
    store.submit(file, '', false);

    expect(seen).toEqual([
      { phase: 'idle' },
      { phase: 'submitting' },
      { phase: 'needs-confirmation', message: 'Confirm please.' }
    ]);
  });

  it('goes submitting -> error for validation and unknown failures', () => {
    const error: JobApiError = { kind: 'validation-error', message: 'Bad split value.', status: 400 };
    createJob.mockReturnValue(throwError(() => error));
    setup();

    const seen = collect();
    store.submit(file, 'abc', false);

    expect(seen).toEqual([
      { phase: 'idle' },
      { phase: 'submitting' },
      { phase: 'error', message: 'Bad split value.', kind: 'validation-error' }
    ]);
  });

  it('carries an unauthorized kind through so the page can skip its own toast', () => {
    const error: JobApiError = { kind: 'unauthorized', message: 'Session expired.', status: 401 };
    createJob.mockReturnValue(throwError(() => error));
    setup();

    const seen = collect();
    store.submit(file, '1', false);

    expect(seen).toEqual([
      { phase: 'idle' },
      { phase: 'submitting' },
      { phase: 'error', message: 'Session expired.', kind: 'unauthorized' }
    ]);
  });

  it('reset() returns to idle', () => {
    createJob.mockReturnValue(of({ job_id: 'j1', status: 'queued', page_count: 1 } as CreateJobResponse));
    setup();

    const seen = collect();
    store.submit(file, '1', false);
    store.reset();

    expect(seen[seen.length - 1]).toEqual({ phase: 'idle' });
  });

  it('cancels an in-flight request when submit is called again (switchMap)', () => {
    let emitLate: ((value: CreateJobResponse) => void) | undefined;
    const late$ = new Observable<CreateJobResponse>((subscriber) => {
      emitLate = (value) => {
        subscriber.next(value);
        subscriber.complete();
      };
    });
    const second: CreateJobResponse = { job_id: 'second', status: 'queued', page_count: 1 };

    createJob.mockReturnValueOnce(late$).mockReturnValueOnce(of(second));
    setup();

    const seen = collect();
    store.submit(file, '1', false);
    store.submit(file, '2', false);

    // The first request's late emission should be dropped by switchMap.
    emitLate?.({ job_id: 'first', status: 'queued', page_count: 1 });

    expect(seen).toEqual([
      { phase: 'idle' },
      { phase: 'submitting' },
      { phase: 'submitting' },
      { phase: 'success', result: second }
    ]);
  });
});
