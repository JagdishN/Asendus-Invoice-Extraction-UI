import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ExportColumn, JobApiError, JobDetail, JobExportResult } from '../../../core/models/job.models';
import { JobApiService } from '../../../core/services/job-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PreviewPage } from './preview-page';

describe('PreviewPage', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PreviewPage>>;
  let getJob: ReturnType<typeof vi.fn>;
  let exportJob: ReturnType<typeof vi.fn>;
  let exportInvoice: ReturnType<typeof vi.fn>;
  let getExportColumns: ReturnType<typeof vi.fn>;
  let paramMap$: Subject<ReturnType<typeof convertToParamMap>>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  const singleGroupJob: JobDetail = {
    job_id: 'job-1',
    original_filename: 'invoice-a.pdf',
    status: 'completed',
    created_at: '2026-01-01T00:00:00Z',
    invoice_groups: [
      {
        invoice_number: 'INV-001',
        header_fields: { vendor: 'Acme Co', total: '100.00' },
        line_items: [
          { description: 'Widget', qty: 2, unit_price: '10.00' },
          { description: 'Gadget', qty: 1, unit_price: '80.00' }
        ],
        source_page_list: [1, 2, 3],
        needs_user_review: false
      }
    ]
  };

  const multiGroupJob: JobDetail = {
    job_id: 'job-2',
    original_filename: 'batch.pdf',
    status: 'completed',
    created_at: '2026-01-01T00:00:00Z',
    invoice_groups: [
      {
        invoice_number: 'INV-001',
        header_fields: { vendor: 'Acme Co' },
        line_items: [{ description: 'Widget' }],
        source_page_list: [1, 2],
        needs_user_review: false
      },
      {
        invoice_number: 'INV-002',
        header_fields: { vendor: 'Beta LLC' },
        line_items: [{ description: 'Sprocket' }],
        source_page_list: [3],
        needs_user_review: true
      }
    ]
  };

  // Mirrors a real response captured from the backend: invoice_number can be null, confidence
  // is reported per header field (not a single numeric score), and header_fields can contain
  // an array value (tax_bracket_summary).
  const unreviewedJob: JobDetail = {
    job_id: 'job-3',
    original_filename: 'unrecognized.pdf',
    status: 'review_required',
    created_at: '2026-01-01T00:00:00Z',
    invoice_groups: [
      {
        invoice_number: null,
        invoice_number_confidence: 'not_found',
        header_fields: { party_name: null, invoice_total: null, tax_bracket_summary: [] },
        header_field_confidences: { party_name: 'not_found', invoice_total: 'not_found' },
        line_items: [],
        source_page_list: [1],
        needs_user_review: true
      }
    ]
  };

  // None of these three are on the mandatory-columns list, so the dropdown behaves like a plain
  // multi-select for this default fixture — mandatory-column locking gets its own describe block below.
  const exportColumns: ExportColumn[] = [
    { field_name: 'quantity', label: 'Quantity' },
    { field_name: 'uom', label: 'UOM' },
    { field_name: 'unit_rate', label: 'Unit Rate' }
  ];

  async function createComponent(): Promise<void> {
    paramMap$ = new Subject();
    await TestBed.configureTestingModule({
      imports: [PreviewPage],
      providers: [
        provideRouter([]),
        { provide: JobApiService, useValue: { getJob, exportJob, exportInvoice, getExportColumns } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(PreviewPage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    getJob = vi.fn().mockReturnValue(of(singleGroupJob));
    exportJob = vi.fn();
    exportInvoice = vi.fn();
    getExportColumns = vi.fn().mockReturnValue(of(exportColumns));

    let nextUrl = 0;
    createObjectURL = vi.fn(() => `blob:export-${++nextUrl}`);
    revokeObjectURL = vi.fn();
    // Assign directly onto the real URL constructor (rather than vi.stubGlobal-replacing it
    // wholesale) so `new URL(...)` still works for Router internals under the hood.
    (URL as unknown as { createObjectURL: unknown; revokeObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { createObjectURL: unknown; revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockRestore();
  });

  it('shows a loading hint before the job resolves', async () => {
    getJob.mockReturnValue(new Subject());
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading job');
  });

  it('shows a clear error with a way back to Upload when the job fetch fails', async () => {
    const error: JobApiError = { kind: 'unknown', message: 'Job not found.', status: 404 };
    getJob.mockReturnValue(throwError(() => error));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'missing' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Job not found.');
    const backLinks = fixture.nativeElement.querySelectorAll('a[href="/upload"]');
    expect(backLinks.length).toBeGreaterThan(0);
  });

  it('renders the filename, status, and a single invoice group without a tab bar', async () => {
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('invoice-a.pdf');
    expect(text).toContain('completed');
    expect(text).toContain('INV-001');
    expect(text).toContain('Pages 1-3');
    expect(fixture.nativeElement.querySelector('.invoice-tabs')).toBeFalsy();
  });

  it('renders header fields and a line-items table with dynamic columns', async () => {
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Vendor');
    expect(text).toContain('Acme Co');

    const headers = Array.from(fixture.nativeElement.querySelectorAll('.line-items-table th')).map(
      (th) => (th as HTMLElement).textContent
    );
    expect(headers).toEqual(['Description', 'Qty', 'Unit Price']);
    const rows = fixture.nativeElement.querySelectorAll('.line-items-table tbody tr');
    expect(rows.length).toBe(2);
  });

  it('shows tabs for multiple invoice groups and switches the visible section on click', async () => {
    getJob.mockReturnValue(of(multiGroupJob));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-2' }));
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.invoice-tabs__tab');
    expect(tabs.length).toBe(2);
    expect(fixture.nativeElement.querySelector('.invoice-section h2').textContent).toContain('INV-001');

    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.invoice-section h2').textContent).toContain('INV-002');
  });

  it('flags a needs_user_review invoice group with a visible badge', async () => {
    getJob.mockReturnValue(of(multiGroupJob));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-2' }));
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.invoice-tabs__tab');
    expect((tabs[1] as HTMLElement).querySelector('.review-badge')).toBeTruthy();
    expect((tabs[0] as HTMLElement).querySelector('.review-badge')).toBeFalsy();
  });

  it('falls back to a placeholder label and hides the per-invoice download link when invoice_number is null', async () => {
    getJob.mockReturnValue(of(unreviewedJob));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-3' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.invoice-section h2').textContent).toContain('Untitled invoice');
    expect(fixture.nativeElement.querySelector('.download-link')).toBeFalsy();
  });

  it('flags a low-confidence header field individually and renders an empty array field as a placeholder', async () => {
    getJob.mockReturnValue(of(unreviewedJob));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-3' }));
    fixture.detectChanges();

    const rows = Array.from(fixture.nativeElement.querySelectorAll('.detail-grid__row'));
    const partyNameRow = rows.find((row) => (row as HTMLElement).textContent?.includes('Party Name')) as HTMLElement;
    expect(partyNameRow.querySelector('.review-badge')).toBeTruthy();
    expect(partyNameRow.querySelector('dd')?.textContent?.trim()).toBe('—');

    const taxBracketRow = rows.find((row) =>
      (row as HTMLElement).textContent?.includes('Tax Bracket Summary')
    ) as HTMLElement;
    expect(taxBracketRow.querySelector('dd')?.textContent?.trim()).toBe('—');
  });

  it('shows the whole-group review badge when needs_user_review is true even with no per-field confidences', async () => {
    getJob.mockReturnValue(of(unreviewedJob));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-3' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.invoice-section .review-badge--block')).toBeTruthy();
  });

  it('downloads the job export using the Content-Disposition filename', async () => {
    const result: JobExportResult = {
      blob: new Blob(['data']),
      filename: 'job-1-export.csv',
      contentType: 'text/csv'
    };
    exportJob.mockReturnValue(of(result));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.download-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(exportJob).toHaveBeenCalledWith('job-1', undefined);
    expect(createObjectURL).toHaveBeenCalledWith(result.blob);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('falls back to a generated filename when Content-Disposition is missing', async () => {
    exportJob.mockReturnValue(of({ blob: new Blob(['data']), filename: null, contentType: 'application/zip' }));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.download-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(createObjectURL).toHaveBeenCalled();
  });

  it('downloads a single invoice via its "Download this invoice only" link', async () => {
    const result: JobExportResult = { blob: new Blob(['data']), filename: 'INV-001.csv', contentType: 'text/csv' };
    exportInvoice.mockReturnValue(of(result));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.download-link') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(exportInvoice).toHaveBeenCalledWith('job-1', 'INV-001', undefined);
    expect(createObjectURL).toHaveBeenCalledWith(result.blob);
  });

  it('shows an error toast and stays on the page when the job download fails', async () => {
    const error: JobApiError = { kind: 'unknown', message: 'Export failed.', status: 500 };
    exportJob.mockReturnValue(throwError(() => error));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.download-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().map((t) => t.message)).toContain('Export failed.');
    expect(fixture.nativeElement.querySelector('.invoice-section')).toBeTruthy();
  });

  it('does not show its own toast for an unauthorized (401) download error — authInterceptor already handles that', async () => {
    const error: JobApiError = { kind: 'unauthorized', message: 'Session expired.', status: 401 };
    exportJob.mockReturnValue(throwError(() => error));
    await createComponent();
    paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.download-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().map((t) => t.message)).not.toContain('Session expired.');
  });

  describe('column selection dropdown', () => {
    function toggle(): void {
      (fixture.nativeElement.querySelector('.columns-dropdown__toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    function checkboxFor(label: string): HTMLInputElement {
      const options = Array.from(
        fixture.nativeElement.querySelectorAll('.columns-dropdown__option')
      ) as HTMLLabelElement[];
      const option = options.find((el) => el.textContent?.trim().includes(label));
      return option?.querySelector('input') as HTMLInputElement;
    }

    beforeEach(async () => {
      exportJob.mockReturnValue(new Subject());
      await createComponent();
      paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
      fixture.detectChanges();
    });

    it('loads the columns list and defaults to every column selected', () => {
      expect(getExportColumns).toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.columns-dropdown__toggle').textContent).toContain('Columns (3/3)');

      toggle();
      const allCheckbox = checkboxFor('Select All');
      expect(allCheckbox.checked).toBe(true);
      expect(allCheckbox.indeterminate).toBe(false);
      expect(checkboxFor('Quantity').checked).toBe(true);
      expect(checkboxFor('UOM').checked).toBe(true);
      expect(checkboxFor('Unit Rate').checked).toBe(true);
    });

    it('opens and closes the panel via the toggle button, and updates the count when a column is deselected', () => {
      expect(fixture.nativeElement.querySelector('.columns-dropdown__panel')).toBeFalsy();

      toggle();
      expect(fixture.nativeElement.querySelector('.columns-dropdown__panel')).toBeTruthy();

      checkboxFor('Quantity').dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.columns-dropdown__toggle').textContent).toContain('Columns (2/3)');
      const allCheckbox = checkboxFor('Select All');
      expect(allCheckbox.checked).toBe(false);
      expect(allCheckbox.indeterminate).toBe(true);

      toggle();
      expect(fixture.nativeElement.querySelector('.columns-dropdown__panel')).toBeFalsy();
    });

    it('closes the panel on an outside click', () => {
      toggle();
      expect(fixture.nativeElement.querySelector('.columns-dropdown__panel')).toBeTruthy();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.columns-dropdown__panel')).toBeFalsy();
    });

    it('"Select All" deselects everything when all are selected, and reselects everything when clicked again', () => {
      toggle();
      checkboxFor('Select All').dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.columns-dropdown__toggle').textContent).toContain('Columns (0/3)');

      checkboxFor('Select All').dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.columns-dropdown__toggle').textContent).toContain('Columns (3/3)');
    });

    it('downloads with only the selected column field_names, omitting the deselected one', () => {
      toggle();
      checkboxFor('Quantity').dispatchEvent(new Event('change'));
      fixture.detectChanges();
      toggle();

      (fixture.nativeElement.querySelector('.download-btn') as HTMLButtonElement).click();

      expect(exportJob).toHaveBeenCalledWith('job-1', ['uom', 'unit_rate']);
    });

    it('blocks the download and shows an error toast when every column is deselected', () => {
      toggle();
      checkboxFor('Select All').dispatchEvent(new Event('change'));
      fixture.detectChanges();
      toggle();

      (fixture.nativeElement.querySelector('.download-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(exportJob).not.toHaveBeenCalled();
      const toastService = TestBed.inject(ToastService);
      expect(toastService.toasts().map((t) => t.message)).toContain('Select at least one column before downloading.');
    });
  });

  describe('mandatory columns', () => {
    const mixedColumns: ExportColumn[] = [
      { field_name: 'line_number', label: 'Line #' }, // mandatory (S.No)
      { field_name: 'quantity', label: 'Quantity' } // not mandatory
    ];

    function toggle(): void {
      (fixture.nativeElement.querySelector('.columns-dropdown__toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    function optionFor(label: string): HTMLLabelElement {
      const options = Array.from(
        fixture.nativeElement.querySelectorAll('.columns-dropdown__option')
      ) as HTMLLabelElement[];
      return options.find((el) => el.textContent?.trim().includes(label)) as HTMLLabelElement;
    }

    beforeEach(async () => {
      getExportColumns.mockReturnValue(of(mixedColumns));
      exportJob.mockReturnValue(new Subject());
      await createComponent();
      paramMap$.next(convertToParamMap({ jobId: 'job-1' }));
      fixture.detectChanges();
      toggle();
    });

    it('shows a mandatory column as checked, disabled, and labeled "Required"; optional columns stay interactive', () => {
      const lineNumberInput = optionFor('Line #').querySelector('input') as HTMLInputElement;
      expect(lineNumberInput.checked).toBe(true);
      expect(lineNumberInput.disabled).toBe(true);
      expect(optionFor('Line #').textContent).toContain('Required');

      const quantityInput = optionFor('Quantity').querySelector('input') as HTMLInputElement;
      expect(quantityInput.disabled).toBe(false);
      expect(optionFor('Quantity').textContent).not.toContain('Required');
    });

    it('does not let a mandatory column be deselected via its own checkbox', () => {
      const lineNumberInput = optionFor('Line #').querySelector('input') as HTMLInputElement;
      lineNumberInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.columns-dropdown__toggle').textContent).toContain('Columns (2/2)');
    });

    it('"Select All" unchecking keeps the mandatory column selected and only clears optional ones', () => {
      const allCheckbox = optionFor('Select All').querySelector('input') as HTMLInputElement;
      allCheckbox.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.columns-dropdown__toggle').textContent).toContain('Columns (1/2)');
      expect((optionFor('Line #').querySelector('input') as HTMLInputElement).checked).toBe(true);
      expect((optionFor('Quantity').querySelector('input') as HTMLInputElement).checked).toBe(false);
    });

    it('still includes the mandatory field_name in the download after clearing optional columns via "Select All"', () => {
      const allCheckbox = optionFor('Select All').querySelector('input') as HTMLInputElement;
      allCheckbox.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      toggle();

      (fixture.nativeElement.querySelector('.download-btn') as HTMLButtonElement).click();

      expect(exportJob).toHaveBeenCalledWith('job-1', ['line_number']);
    });
  });
});
