import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { JobApiError, JobDetail } from '../models/job.models';
import { JobApiService } from './job-api.service';
import { JobDetailState, JobDetailStore } from './job-detail-store.service';

describe('JobDetailStore', () => {
  let store: JobDetailStore;
  let getJob: ReturnType<typeof vi.fn>;

  const job: JobDetail = {
    job_id: '1',
    original_filename: 'a.pdf',
    status: 'completed',
    created_at: '2026-01-01'
  };

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [JobDetailStore, { provide: JobApiService, useValue: { getJob } }]
    });
    store = TestBed.inject(JobDetailStore);
  }

  function collect(): JobDetailState[] {
    const seen: JobDetailState[] = [];
    store.state$.subscribe((s) => seen.push(s));
    return seen;
  }

  it('goes loading -> loaded when load() succeeds', () => {
    getJob = vi.fn().mockReturnValue(of(job));
    setup();

    const seen = collect();
    store.load('1');

    expect(seen).toEqual([{ phase: 'loading' }, { phase: 'loaded', job }]);
    expect(getJob).toHaveBeenCalledWith('1');
  });

  it('goes loading -> error when load() fails', () => {
    const error: JobApiError = { kind: 'unknown', message: 'not found', status: 404 };
    getJob = vi.fn().mockReturnValue(throwError(() => error));
    setup();

    const seen = collect();
    store.load('missing');

    expect(seen).toEqual([{ phase: 'loading' }, { phase: 'error', message: 'not found', kind: 'unknown' }]);
  });

  it('carries an unauthorized kind through so the page can skip its own toast', () => {
    const error: JobApiError = { kind: 'unauthorized', message: 'Session expired.', status: 401 };
    getJob = vi.fn().mockReturnValue(throwError(() => error));
    setup();

    const seen = collect();
    store.load('1');

    expect(seen).toEqual([
      { phase: 'loading' },
      { phase: 'error', message: 'Session expired.', kind: 'unauthorized' }
    ]);
  });

  it('re-loading with a different id cancels the previous request (switchMap)', () => {
    getJob = vi.fn().mockReturnValueOnce(of({ ...job, job_id: 'first' })).mockReturnValueOnce(of({ ...job, job_id: 'second' }));
    setup();

    const seen = collect();
    store.load('first');
    store.load('second');

    expect(seen[seen.length - 1]).toEqual({ phase: 'loaded', job: { ...job, job_id: 'second' } });
  });
});
