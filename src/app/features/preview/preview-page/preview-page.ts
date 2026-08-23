import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { HeaderFieldValue, InvoiceGroup, JobApiError, JobDetail } from '../../../core/models/job.models';
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
  }

  protected selectInvoice(index: number): void {
    this.selectedIndex.set(index);
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
    this.downloadingJob.set(true);
    this.jobApi.exportJob(job.job_id).subscribe({
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
    this.downloadingInvoice.set(invoiceNumber);
    this.jobApi.exportInvoice(job.job_id, invoiceNumber).subscribe({
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

  private fallbackJobFilename(job: JobDetail, contentType: string | null): string {
    const base = job.original_filename.replace(/\.[^.]+$/, '') || job.job_id;
    const ext = contentType?.includes('zip') ? 'zip' : 'csv';
    return `${base}-export.${ext}`;
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_');
  }
}
