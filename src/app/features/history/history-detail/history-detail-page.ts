import { Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { JobDetailStore } from '../../../core/services/job-detail-store.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-history-detail-page',
  standalone: true,
  imports: [RouterLink],
  providers: [JobDetailStore],
  templateUrl: './history-detail-page.html',
  styleUrl: './history-detail-page.scss'
})
export class HistoryDetailPage {
  private readonly store = inject(JobDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly state = toSignal(this.store.state$, { initialValue: { phase: 'loading' as const } });

  // A 401 (kind 'unauthorized') is already handled by authInterceptor —
  // AuthService shows its own session-expired toast and redirects to Login,
  // so skip it here to avoid a second, redundant toast.
  private readonly notifyOnError = effect(() => {
    const s = this.state();
    if (s.phase === 'error' && s.kind !== 'unauthorized') {
      this.toast.error(s.message);
    }
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('jobId')),
        filter((jobId): jobId is string => !!jobId),
        takeUntilDestroyed()
      )
      .subscribe((jobId) => this.store.load(jobId));
  }
}
