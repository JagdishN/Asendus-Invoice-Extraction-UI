import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { JobApiError, JobSummary } from '../../../core/models/job.models';
import { JobApiService } from '../../../core/services/job-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { HistoryListPage } from './history-list-page';

describe('HistoryListPage', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HistoryListPage>>;
  let listJobs: ReturnType<typeof vi.fn>;

  const jobs: JobSummary[] = [
    {
      job_id: '1',
      original_filename: 'invoice-a.pdf',
      status: 'completed',
      invoice_count: 3,
      created_at: '2026-01-01T00:00:00Z'
    },
    {
      job_id: '2',
      original_filename: 'invoice-b.png',
      status: 'failed',
      invoice_count: 0,
      created_at: '2026-01-02T00:00:00Z'
    }
  ];

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HistoryListPage],
      providers: [provideRouter([]), { provide: JobApiService, useValue: { listJobs } }]
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryListPage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    listJobs = vi.fn().mockReturnValue(of(jobs));
  });

  it('renders each job as a table row with filename, status, invoice count, and created date', async () => {
    await createComponent();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('invoice-a.pdf');
    expect(rows[0].textContent).toContain('completed');
    expect(rows[0].textContent).toContain('3');
  });

  it('shows an empty-state hint when there are no jobs', async () => {
    listJobs.mockReturnValue(of([]));
    await createComponent();

    expect(fixture.nativeElement.textContent).toContain('No jobs yet');
  });

  it('toasts the error message when the list request fails', async () => {
    const error: JobApiError = { kind: 'unknown', message: 'Could not load jobs.', status: 500 };
    listJobs.mockReturnValue(throwError(() => error));
    await createComponent();

    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().map((t) => t.message)).toContain('Could not load jobs.');
  });

  it('does not show its own toast for an unauthorized (401) error — authInterceptor already handles that', async () => {
    const error: JobApiError = { kind: 'unauthorized', message: 'Session expired.', status: 401 };
    listJobs.mockReturnValue(throwError(() => error));
    await createComponent();

    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().map((t) => t.message)).not.toContain('Session expired.');
  });

  it('refresh button triggers another fetch', async () => {
    await createComponent();
    expect(listJobs).toHaveBeenCalledTimes(1);

    (fixture.nativeElement.querySelector('.refresh-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(listJobs).toHaveBeenCalledTimes(2);
  });

  it('links each row to its job detail route', async () => {
    await createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    (rows[1] as HTMLElement).click();

    expect(navigateSpy).toHaveBeenCalled();
    expect(navigateSpy.mock.calls[0][0].toString()).toBe('/history/2');
  });
});
