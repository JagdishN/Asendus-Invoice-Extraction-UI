import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { ToastService } from '../../../core/services/toast.service';
import { UploadStore } from '../../../core/services/upload-store.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { Dropzone } from '../dropzone/dropzone';

const NO_SPLIT_VALUE_CONFIRM_MESSAGE =
  'No page split has been entered. Would you like to process the entire document as a single invoice?';

const PREVIEWABLE_IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;
const PDF_PATTERN = /\.pdf$/i;

// The backend call is synchronous with no progress signal, so this is a simulated
// percentage that eases toward (but never quite reaches) 90% while waiting, then
// jumps to 100% once the response actually comes back.
const PROGRESS_INTERVAL_MS = 150;
const PROGRESS_CEILING = 90;
const PROGRESS_EASING = 0.12;
const PROGRESS_RING_RADIUS = 42;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

type PreviewKind = 'image' | 'pdf' | null;

@Component({
  selector: 'app-upload-page',
  standalone: true,
  imports: [Dropzone, ConfirmDialog, FormsModule],
  providers: [UploadStore],
  templateUrl: './upload-page.html',
  styleUrl: './upload-page.scss'
})
export class UploadPage implements OnDestroy {
  private readonly store = inject(UploadStore);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly pageTitle = computed(() => (this.selectedFile() ? 'Review Invoice' : 'Upload Invoice'));
  protected readonly pageSubtitle = computed(() =>
    this.selectedFile()
      ? 'Review the document and extraction settings before processing.'
      : 'Upload a PDF or image to extract invoice data.'
  );
  protected readonly previewKind = signal<PreviewKind>(null);
  protected readonly previewImageUrl = signal<string | null>(null);
  protected readonly previewPdfUrl = signal<SafeResourceUrl | null>(null);
  protected readonly splitValue = signal('');
  protected readonly awaitingSplitConfirmation = signal(false);
  protected readonly confirmMessage = NO_SPLIT_VALUE_CONFIRM_MESSAGE;

  protected readonly state = toSignal(this.store.state$, { initialValue: { phase: 'idle' as const } });

  protected readonly isSubmitting = computed(() => this.state().phase === 'submitting');

  protected readonly uploadProgress = signal(0);
  protected readonly displayProgress = computed(() => Math.round(this.uploadProgress()));
  protected readonly ringCircumference = PROGRESS_RING_CIRCUMFERENCE;
  protected readonly ringOffset = computed(
    () => this.ringCircumference * (1 - this.uploadProgress() / 100)
  );

  // A 401 (kind 'unauthorized') is already handled by authInterceptor —
  // AuthService shows its own session-expired toast and redirects to Login,
  // so skip it here to avoid a second, redundant toast.
  private readonly notifyOnStateChange = effect(() => {
    const s = this.state();
    if (s.phase === 'submitting') {
      this.startProgressAnimation();
    } else {
      this.stopProgressAnimation();
    }

    if (s.phase === 'success') {
      this.uploadProgress.set(100);
      this.toast.success(`Upload successful — job ${s.result.job_id} queued (${s.result.page_count} pages).`);
      this.router.navigateByUrl(`/jobs/${s.result.job_id}/preview`);
    } else if (s.phase === 'error' && s.kind !== 'unauthorized') {
      this.toast.error(s.message);
    }
  });

  private objectUrl: string | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    this.clearPreview();
    this.stopProgressAnimation();
  }

  protected onFileSelected(file: File): void {
    this.selectedFile.set(file);
    this.setPreview(file);
    this.store.reset();
  }

  protected onFileRejected(message: string): void {
    this.toast.error(message);
  }

  protected removeSelectedFile(): void {
    this.selectedFile.set(null);
    this.splitValue.set('');
    this.clearPreview();
    this.store.reset();
  }

  protected onSubmit(): void {
    const file = this.selectedFile();
    if (!file || this.isSubmitting()) {
      return;
    }

    if (this.splitValue().trim() === '') {
      this.awaitingSplitConfirmation.set(true);
      return;
    }

    this.store.submit(file, this.splitValue().trim(), false);
  }

  protected confirmProceedWithoutSplit(): void {
    const file = this.selectedFile();
    this.awaitingSplitConfirmation.set(false);
    if (file) {
      this.store.submit(file, '', true);
    }
  }

  protected cancelProceedWithoutSplit(): void {
    this.awaitingSplitConfirmation.set(false);
    this.store.reset();
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected fileExtensionLabel(file: File): string {
    const ext = file.name.split('.').pop();
    return ext ? ext.toUpperCase() : 'FILE';
  }

  private setPreview(file: File): void {
    this.clearPreview();

    if (this.isImage(file)) {
      this.objectUrl = URL.createObjectURL(file);
      this.previewImageUrl.set(this.objectUrl);
      this.previewKind.set('image');
    } else if (this.isPdf(file)) {
      this.objectUrl = URL.createObjectURL(file);
      this.previewPdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
      this.previewKind.set('pdf');
    }
  }

  private clearPreview(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.previewImageUrl.set(null);
    this.previewPdfUrl.set(null);
    this.previewKind.set(null);
  }

  private isImage(file: File): boolean {
    return file.type.startsWith('image/') || PREVIEWABLE_IMAGE_PATTERN.test(file.name);
  }

  private isPdf(file: File): boolean {
    return file.type === 'application/pdf' || PDF_PATTERN.test(file.name);
  }

  private startProgressAnimation(): void {
    if (this.progressTimer) {
      return;
    }
    this.uploadProgress.set(0);
    this.progressTimer = setInterval(() => {
      this.uploadProgress.update((value) => value + (PROGRESS_CEILING - value) * PROGRESS_EASING);
    }, PROGRESS_INTERVAL_MS);
  }

  private stopProgressAnimation(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    this.uploadProgress.set(0);
  }
}
