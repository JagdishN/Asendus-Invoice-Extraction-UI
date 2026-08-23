import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  finalize,
  of,
  shareReplay,
  startWith,
  switchMap
} from 'rxjs';

import { JobApiError, JobSummary } from '../models/job.models';
import { JobApiService } from './job-api.service';

/**
 * History list state as an RxJS stream: refresh() pushes into a Subject,
 * switchMap re-fetches (cancelling any in-flight request), loading/error are
 * tracked alongside via BehaviorSubjects so the template can render each
 * independently through the async pipe.
 */
@Injectable({ providedIn: 'root' })
export class JobsListStore {
  private readonly refreshes = new Subject<void>();
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<{ message: string; kind: JobApiError['kind'] } | null>(null);

  readonly loading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  readonly jobs$: Observable<JobSummary[]> = this.refreshes.pipe(
    startWith(undefined),
    switchMap(() => {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);
      return this.api.listJobs().pipe(
        catchError((error: JobApiError) => {
          this.errorSubject.next({ message: error.message, kind: error.kind });
          return of<JobSummary[]>([]);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(private readonly api: JobApiService) {}

  refresh(): void {
    this.refreshes.next();
  }
}
