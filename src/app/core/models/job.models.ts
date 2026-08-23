export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | string;

export interface CreateJobResponse {
  job_id: string;
  status: JobStatus;
  page_count: number;
}

export interface JobSummary {
  job_id: string;
  original_filename: string;
  status: JobStatus;
  invoice_count: number;
  created_at: string;
  updated_at?: string;
}

/**
 * A single line item within an invoice group. Confirmed against a real upload that the
 * job/invoice-group shape below is correct, but the test document wasn't recognized as an
 * invoice by extraction, so line_items came back empty — its actual field names are still
 * unverified. Left open-ended and rendered as a dynamic table (columns inferred from whatever
 * keys are present) so it degrades gracefully either way — see PreviewPage.
 */
export interface InvoiceLineItem {
  [field: string]: string | number | boolean | null | undefined;
}

/** header_fields values seen so far are scalars or null, except tax_bracket_summary (an array) — kept loose to tolerate other structured values too. */
export type HeaderFieldValue = string | number | boolean | null | undefined | unknown[];

export interface InvoiceGroup {
  invoice_number: string | null;
  /** Per-field extraction confidence, e.g. "not_found" — vocabulary beyond that isn't confirmed. */
  invoice_number_confidence?: string | null;
  header_fields: Record<string, HeaderFieldValue>;
  header_field_confidences?: Record<string, string | null | undefined>;
  line_items: InvoiceLineItem[];
  source_page_list: number[];
  needs_user_review?: boolean;
}

export interface JobDetail {
  job_id: string;
  user_id?: string;
  original_filename: string;
  file_type?: string;
  status: JobStatus;
  created_at: string;
  updated_at?: string;
  page_count?: number;
  split_value_raw?: string | null;
  split_ranges?: unknown[];
  invoice_groups?: InvoiceGroup[];
  error_message?: string | null;
  export?: string | null;
}

/** Result of a blob-download export call — filename comes from Content-Disposition when the backend sends one. */
export interface JobExportResult {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
}

/** Structured error surfaced by JobApiService for the upload workflow. */
export interface JobApiError {
  kind: 'confirmation-required' | 'validation-error' | 'unauthorized' | 'unknown';
  message: string;
  status: number;
}
