import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { JobApiError, JobDetail } from '../../../core/models/job.models';
import { JobApiService } from '../../../core/services/job-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { HistoryDetailPage } from './history-detail-page';

describe('HistoryDetailPage', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HistoryDetailPage>>;
  let getJob: ReturnType<typeof vi.fn>;
  let paramMap$: Subject<ReturnType<typeof convertToParamMap>>;

  const job: JobDetail = {
    job_id: '1',
    original_filename: 'invoice-a.pdf',
    status: 'completed',
    created_at: '2026-01-01T00:00:00Z',
    page_count: 3,
    invoice_groups: [
      { invoice_number: 'INV-001', header_fields: {}, line_items: [], source_page_list: [1, 2] },
      { invoice_number: 'INV-002', header_fields: {}, line_items: [], source_page_list: [3] }
    ],
    split_value_raw: '1-3'
  };

  async function createComponent(): Promise<void> {
    paramMap$ = new Subject();
    await TestBed.configureTestingModule({
      imports: [HistoryDetailPage],
      providers: [
        provideRouter([]),
        { provide: JobApiService, useValue: { getJob } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryDetailPage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    getJob = vi.fn().mockReturnValue(of(job));
  });

  it('shows a loading hint before the job resolves', async () => {
    getJob.mockReturnValue(new Subject());
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: '1' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading job');
  });

  it('loads the job for the route jobId and renders its fields', async () => {
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: '1' }));
    fixture.detectChanges();

    expect(getJob).toHaveBeenCalledWith('1');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('invoice-a.pdf');
    expect(text).toContain('completed');
    expect(text).toContain('1-3');
  });

  it('toasts the error message when the job fails to load', async () => {
    const error: JobApiError = { kind: 'unknown', message: 'Job not found.', status: 404 };
    getJob.mockReturnValue(throwError(() => error));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'missing' }));
    fixture.detectChanges();

    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().map((t) => t.message)).toContain('Job not found.');
  });

  it('does not show its own toast for an unauthorized (401) error — authInterceptor already handles that', async () => {
    const error: JobApiError = { kind: 'unauthorized', message: 'Session expired.', status: 401 };
    getJob.mockReturnValue(throwError(() => error));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: '1' }));
    fixture.detectChanges();

    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().map((t) => t.message)).not.toContain('Session expired.');
  });

  it('re-fetches when the route jobId changes', async () => {
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: '1' }));
    fixture.detectChanges();

    paramMap$.next(convertToParamMap({ jobId: '2' }));
    fixture.detectChanges();

    expect(getJob).toHaveBeenNthCalledWith(1, '1');
    expect(getJob).toHaveBeenNthCalledWith(2, '2');
  });
});
