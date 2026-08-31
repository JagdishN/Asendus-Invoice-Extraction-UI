import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { ExportColumn, HeaderFieldValue, InvoiceGroup, JobApiError, JobDetail } from '../../../core/models/job.models';
import { JobApiService } from '../../../core/services/job-api.service';
import { JobDetailStore } from '../../../core/services/job-detail-store.service';
import { ToastService } from '../../../core/services/toast.service';
import { triggerBlobDownload } from '../../../core/utils/download';
import { formatPageRanges } from '../../../core/utils/page-ranges';

/** Confirmed real value: "not_found". Exact vocabulary beyond that isn't confirmed, so this is matched loosely. */
const LOW_CONFIDENCE_PATTERN = /not.?found|low|missing/i;

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

  protected toggleSelectAllColumns(): void {
    this.selectedColumns.set(
      this.allColumnsSelected() ? new Set() : new Set(this.exportColumns().map((c) => c.field_name))
    );
  }

  protected isColumnSelected(fieldName: string): boolean {
    return this.selectedColumns().has(fieldName);
  }

  protected reviewFlag(group: InvoiceGroup): boolean {
    return !!group.needs_user_review || this.isLowConfidence(group.invoice_number_confidence);
  }

  protected fieldNeedsReview(group: InvoiceGroup, key: string): boolean {
    return this.isLowConfidence(group.header_field_confidences?.[key]);
  }

  protected headerFieldEntries(group: InvoiceGroup): [string, HeaderFieldValue][] {
    return Object.entries(group.header_fields ?? {});
  }

  protected lineItemColumns(group: InvoiceGroup): string[] {
    const keys = new Set<string>();
    for (const item of group.line_items ?? []) {
      Object.keys(item).forEach((key) => keys.add(key));
    }
    return [...keys];
  }

  protected formatColumnLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /** header_fields values seen so far are scalars, null, or an array (e.g. tax_bracket_summary) — rendered generically so unexpected shapes don't break the table. */
  protected formatFieldValue(value: HeaderFieldValue): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map((entry) => String(entry)).join(', ') : '—';
    }
    return String(value);
  }

  private isLowConfidence(confidence: string | null | undefined): boolean {
    return !!confidence && LOW_CONFIDENCE_PATTERN.test(confidence);
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
