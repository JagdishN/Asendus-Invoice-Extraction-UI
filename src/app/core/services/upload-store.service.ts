import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  catchError,
  map,
  merge,
  of,
  shareReplay,
  startWith,
  switchMap
} from 'rxjs';

import { CreateJobResponse, JobApiError } from '../models/job.models';
import { JobApiService } from './job-api.service';

export type UploadState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'needs-confirmation'; message: string }
  | { phase: 'success'; result: CreateJobResponse }
  | { phase: 'error'; message: string; kind: JobApiError['kind'] };

interface SubmitRequest {
  file: File;
  splitValue: string;
  confirmedNoSplit: boolean;
}

/**
 * Drives the upload workflow as an RxJS state stream rather than imperative
 * subscribe() calls: submit()/reset() push into Subjects, merge() combines
 * them into a single UploadState stream the component subscribes to via the
 * async pipe. Scoped to the Upload page (provided at component level) so
 * state resets on navigation.
 */
@Injectable()
export class UploadStore {
  private readonly submitRequests = new Subject<SubmitRequest>();
  private readonly resets = new Subject<void>();

  readonly state$: Observable<UploadState> = merge(
    this.submitRequests.pipe(
      switchMap((request) =>
        this.api.createJob(request.file, request.splitValue, request.confirmedNoSplit).pipe(
          map((result): UploadState => ({ phase: 'success', result })),
          catchError((error: JobApiError) => {
            if (error.kind === 'confirmation-required') {
              return of<UploadState>({ phase: 'needs-confirmation', message: error.message });
            }
            return of<UploadState>({ phase: 'error', message: error.message, kind: error.kind });
          }),
          startWith<UploadState>({ phase: 'submitting' })
        )
      )
    ),
    this.resets.pipe(map((): UploadState => ({ phase: 'idle' })))
  ).pipe(
    startWith<UploadState>({ phase: 'idle' }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(private readonly api: JobApiService) {}

  submit(file: File, splitValue: string, confirmedNoSplit = false): void {
    this.submitRequests.next({ file, splitValue, confirmedNoSplit });
  }

  reset(): void {
    this.resets.next();
  }
}
