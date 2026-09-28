import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { ExportColumn, HeaderFieldValue, InvoiceGroup, JobApiError, JobDetail } from '../../../core/models/job.models';
import { JobApiService } from '../../../core/services/job-api.service';
import { JobDetailStore } from '../../../core/services/job-detail-store.service';
import { ToastService } from '../../../core/services/toast.service';
import { triggerBlobDownload } from '../../../core/utils/download';
import { formatInvoiceDate } from '../../../core/utils/invoice-date';
import { formatPageRanges } from '../../../core/utils/page-ranges';

const INVOICE_DATE_FIELD = 'invoice_date';

// Internal confidence metadata, not user-facing invoice data.
const LINE_ITEM_COLUMN_EXCLUDE = new Set(['field_confidences']);

/**
 * Columns the business requires on every export — always selected, can't be unchecked.
 * Mapped from the requested list of S.No / HSN / Description / MFG info / Batch No / Expiry /
 * Packing / QTY / Free QTY / MRP / PTR / PTS / Discount / GST / Total Value onto the backend's
 * field_names (see GET /api/jobs/export/columns). "Item Code" (product code) still has no
 * corresponding export column, so it's not enforceable here — flagged to the user rather than
 * guessed at. "MFG info" maps to mfg_date, added by the backend after this list was first drafted.
 */
const MANDATORY_COLUMN_FIELD_NAMES = new Set([
  'line_number', // S.No
  'hsn_sac', // HSN
  'item_description', // Description
  'batch_number', // Batch No
  'expiry_date', // Expiry info
  'mfg_date', // MFG info
  'pack', // Packing info
  'quantity_sold', // QTY
  'quantity_free', // Free QTY
  'mrp',
  'ptr',
  'rate_pts', // PTS
  'discount_rate',
  'discount_amount',
  'cgst_rate',
  'cgst_amount',
  'sgst_rate',
  'sgst_amount',
  'igst_rate',
  'igst_amount',
  'line_total', // Total Value
  'taxable_value' // Total Value
]);

/**
 * Read-only preview of a completed job, reached automatically after upload
 * (extraction is synchronous, so there's no polling — the job is already
 * complete by the time this page loads). Editing is a deferred follow-up.
 */
@Component({
  selector: 'app-preview-page',
  standalone: true,
  imports: [RouterLink],
  providers: [JobDetailStore],
  templateUrl: './preview-page.html',
  styleUrl: './preview-page.scss'
})
export class PreviewPage {
  private readonly store = inject(JobDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly jobApi = inject(JobApiService);

  protected readonly state = toSignal(this.store.state$, { initialValue: { phase: 'loading' as const } });
  protected readonly selectedIndex = signal(0);
  protected readonly downloadingJob = signal(false);
  protected readonly downloadingInvoice = signal<string | null>(null);
  protected readonly formatPageRanges = formatPageRanges;

  protected readonly exportColumns = signal<ExportColumn[]>([]);
  protected readonly selectedColumns = signal<Set<string>>(new Set());
  protected readonly columnsPanelOpen = signal(false);

  protected readonly allColumnsSelected = computed(
    () => this.exportColumns().length > 0 && this.selectedColumns().size === this.exportColumns().length
  );
  protected readonly someColumnsSelected = computed(
    () => this.selectedColumns().size > 0 && !this.allColumnsSelected()
  );
  protected readonly columnsSummary = computed(() => {
    const total = this.exportColumns().length;
    return total === 0 ? 'Columns' : `Columns (${this.selectedColumns().size}/${total})`;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('jobId')),
        filter((jobId): jobId is string => !!jobId),
        takeUntilDestroyed()
      )
      .subscribe((jobId) => {
        this.selectedIndex.set(0);
        this.store.load(jobId);
      });

    this.jobApi.getExportColumns().subscribe({
      next: (columns) => {
        this.exportColumns.set(columns);
        this.selectedColumns.set(new Set(columns.map((c) => c.field_name)));
      },
      error: (error: JobApiError) => {
        if (error.kind !== 'unauthorized') {
          this.toast.error(error.message);
        }
      }
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.columnsPanelOpen() && !(event.target as HTMLElement).closest('.columns-dropdown')) {
      this.columnsPanelOpen.set(false);
    }
  }

  protected selectInvoice(index: number): void {
    this.selectedIndex.set(index);
  }

  protected toggleColumnsPanel(): void {
    this.columnsPanelOpen.update((open) => !open);
  }

  protected toggleColumn(fieldName: string): void {
    if (this.isMandatoryColumn(fieldName)) {
      return;
    }
    this.selectedColumns.update((current) => {
      const next = new Set(current);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  }

  /** "Select All" toggles between every column and just the mandatory ones — mandatory columns can never be deselected. */
  protected toggleSelectAllColumns(): void {
    this.selectedColumns.set(
      this.allColumnsSelected()
        ? new Set(this.exportColumns().filter((c) => this.isMandatoryColumn(c.field_name)).map((c) => c.field_name))
        : new Set(this.exportColumns().map((c) => c.field_name))
    );
  }

  protected isColumnSelected(fieldName: string): boolean {
    return this.selectedColumns().has(fieldName);
  }

  protected isMandatoryColumn(fieldName: string): boolean {
    return MANDATORY_COLUMN_FIELD_NAMES.has(fieldName);
  }

  protected lineItemColumns(group: InvoiceGroup): string[] {
    const keys = new Set<string>();
    for (const item of group.line_items ?? []) {
      Object.keys(item)
        .filter((key) => !LINE_ITEM_COLUMN_EXCLUDE.has(key))
        .forEach((key) => keys.add(key));
    }
    return [...keys];
  }

  protected formatColumnLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /** header_fields values seen so far are scalars, null, or an array (e.g. tax_bracket_summary) — rendered generically so unexpected shapes don't break the table, except invoice_date which gets DD-MMM-YYYY formatting. */
  protected formatFieldValue(key: string, value: HeaderFieldValue): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map((entry) => String(entry)).join(', ') : '—';
    }
    if (key === INVOICE_DATE_FIELD && typeof value === 'string') {
      return formatInvoiceDate(value);
    }
    return String(value);
  }

  protected downloadJob(job: JobDetail): void {
    if (this.downloadingJob()) {
      return;
    }
    if (this.selectedColumns().size === 0) {
      this.toast.error('Select at least one column before downloading.');
      return;
    }
    this.downloadingJob.set(true);
    this.jobApi.exportJob(job.job_id, this.columnsForExport()).subscribe({
      next: (result) => {
        this.downloadingJob.set(false);
        triggerBlobDownload(result.blob, result.filename ?? this.fallbackJobFilename(job, result.contentType));
      },
      error: (error: JobApiError) => {
        this.downloadingJob.set(false);
        if (error.kind !== 'unauthorized') {
          this.toast.error(error.message);
        }
      }
    });
  }

  protected downloadInvoice(job: JobDetail, invoiceNumber: string): void {
    if (this.downloadingInvoice()) {
      return;
    }
    if (this.selectedColumns().size === 0) {
      this.toast.error('Select at least one column before downloading.');
      return;
    }
    this.downloadingInvoice.set(invoiceNumber);
    this.jobApi.exportInvoice(job.job_id, invoiceNumber, this.columnsForExport()).subscribe({
      next: (result) => {
        this.downloadingInvoice.set(null);
        triggerBlobDownload(result.blob, result.filename ?? `${this.sanitizeFilename(invoiceNumber)}.csv`);
      },
      error: (error: JobApiError) => {
        this.downloadingInvoice.set(null);
        if (error.kind !== 'unauthorized') {
          this.toast.error(error.message);
        }
      }
    });
  }

  /** Omit the columns param entirely when every column is selected — the backend reuses its cached "every column" export in that case, only rebuilding fresh for a filtered set. */
  private columnsForExport(): string[] | undefined {
    return this.allColumnsSelected() ? undefined : Array.from(this.selectedColumns());
  }

  private fallbackJobFilename(job: JobDetail, contentType: string | null): string {
    const base = job.original_filename.replace(/\.[^.]+$/, '') || job.job_id;
    const ext = contentType?.includes('zip') ? 'zip' : 'csv';
    return `${base}-export.${ext}`;
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_');
  }
}
