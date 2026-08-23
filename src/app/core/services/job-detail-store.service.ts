import { Injectable } from '@angular/core';
import { Observable, Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { JobApiError, JobDetail } from '../models/job.models';
import { JobApiService } from './job-api.service';

export type JobDetailState =
  | { phase: 'loading' }
  | { phase: 'loaded'; job: JobDetail }
  | { phase: 'error'; message: string; kind: JobApiError['kind'] };

/**
 * Loads a single job's detail as an RxJS stream keyed by job id. Scoped to
 * the History detail page (component-level provider) so switching jobs
 * cancels any in-flight request via switchMap.
 */
@Injectable()
export class JobDetailStore {
  private readonly jobIds = new Subject<string>();

  readonly state$: Observable<JobDetailState> = this.jobIds.pipe(
    switchMap((jobId) =>
      this.api.getJob(jobId).pipe(
        map((job): JobDetailState => ({ phase: 'loaded', job })),
        catchError((error: JobApiError) =>
          of<JobDetailState>({ phase: 'error', message: error.message, kind: error.kind })
        ),
        startWith<JobDetailState>({ phase: 'loading' })
      )
    )
  );

  constructor(private readonly api: JobApiService) {}

  load(jobId: string): void {
    this.jobIds.next(jobId);
  }
}
