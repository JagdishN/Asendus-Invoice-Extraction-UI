import { DatePipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { JobsListStore } from '../../../core/services/jobs-list-store.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-history-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './history-list-page.html',
  styleUrl: './history-list-page.scss'
})
export class HistoryListPage {
  private readonly store = inject(JobsListStore);
  private readonly toast = inject(ToastService);

  protected readonly jobs = toSignal(this.store.jobs$, { initialValue: [] });
  protected readonly loading = toSignal(this.store.loading$, { initialValue: false });
  protected readonly error = toSignal(this.store.error$, { initialValue: null });

  // A 401 (kind 'unauthorized') is already handled by authInterceptor —
  // AuthService shows its own session-expired toast and redirects to Login,
  // so skip it here to avoid a second, redundant toast.
  private readonly notifyOnError = effect(() => {
    const error = this.error();
    if (error && error.kind !== 'unauthorized') {
      this.toast.error(error.message);
    }
  });

  protected refresh(): void {
    this.store.refresh();
  }
}
