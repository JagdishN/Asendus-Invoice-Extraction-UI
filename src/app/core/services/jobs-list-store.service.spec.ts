import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { JobApiError, JobSummary } from '../models/job.models';
import { JobApiService } from './job-api.service';
import { JobsListStore } from './jobs-list-store.service';

describe('JobsListStore', () => {
  let store: JobsListStore;
  let listJobs: ReturnType<typeof vi.fn>;

  const jobs: JobSummary[] = [
    { job_id: '1', original_filename: 'a.pdf', status: 'queued', invoice_count: 0, created_at: '2026-01-01' }
  ];

  beforeEach(() => {
    listJobs = vi.fn().mockReturnValue(of(jobs));
    TestBed.configureTestingModule({
      providers: [JobsListStore, { provide: JobApiService, useValue: { listJobs } }]
    });
    store = TestBed.inject(JobsListStore);
  });

  it('fetches jobs on first subscription', () => {
    let result: JobSummary[] | undefined;
    store.jobs$.subscribe((j) => (result = j));

    expect(listJobs).toHaveBeenCalledTimes(1);
    expect(result).toEqual(jobs);
  });

  it('toggles loading around the fetch', () => {
    const loadingStates: boolean[] = [];
    store.loading$.subscribe((l) => loadingStates.push(l));
    store.jobs$.subscribe();

    expect(loadingStates).toEqual([false, true, false]);
  });

  it('refresh() triggers another fetch', () => {
    store.jobs$.subscribe();
    store.refresh();

    expect(listJobs).toHaveBeenCalledTimes(2);
  });

  it('sets an error message/kind and emits an empty list on failure', () => {
    const error: JobApiError = { kind: 'unknown', message: 'boom', status: 500 };
    listJobs.mockReturnValue(throwError(() => error));

    let jobsResult: JobSummary[] | undefined;
    let errorResult: { message: string; kind: JobApiError['kind'] } | null | undefined;
    store.jobs$.subscribe((j) => (jobsResult = j));
    store.error$.subscribe((e) => (errorResult = e));

    expect(jobsResult).toEqual([]);
    expect(errorResult).toEqual({ message: 'boom', kind: 'unknown' });
  });

  it('carries an unauthorized kind through so the page can skip its own toast', () => {
    const error: JobApiError = { kind: 'unauthorized', message: 'Session expired.', status: 401 };
    listJobs.mockReturnValue(throwError(() => error));

    let errorResult: { message: string; kind: JobApiError['kind'] } | null | undefined;
    store.jobs$.subscribe();
    store.error$.subscribe((e) => (errorResult = e));

    expect(errorResult).toEqual({ message: 'Session expired.', kind: 'unauthorized' });
  });
});
