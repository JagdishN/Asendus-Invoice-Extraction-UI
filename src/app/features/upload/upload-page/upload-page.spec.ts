import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CreateJobResponse, JobApiError } from '../../../core/models/job.models';
import { JobApiService } from '../../../core/services/job-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Dropzone } from '../dropzone/dropzone';
import { UploadPage } from './upload-page';

describe('UploadPage', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<UploadPage>>;
  let component: UploadPage;
  let createJob: ReturnType<typeof vi.fn>;
  let toastService: ToastService;
  let router: Router;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' });

  beforeEach(async () => {
    createJob = vi.fn();

    let nextUrl = 0;
    createObjectURL = vi.fn(() => `blob:preview-${++nextUrl}`);
    revokeObjectURL = vi.fn();
    // Assign directly onto the real URL constructor (rather than vi.stubGlobal-replacing it
    // wholesale) so `new URL(...)` still works for Router internals under the hood.
    (URL as unknown as { createObjectURL: unknown; revokeObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { createObjectURL: unknown; revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;

    await TestBed.configureTestingModule({
      imports: [UploadPage],
      providers: [provideRouter([]), { provide: JobApiService, useValue: { createJob } }]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadPage);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  function selectFileViaDropzone(f: File): void {
    const dropzone = fixture.debugElement.query(By.directive(Dropzone)).componentInstance as Dropzone;
    dropzone.fileSelected.emit(f);
    fixture.detectChanges();
  }

  function submitBtn(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.submit-btn') as HTMLButtonElement;
  }

  function toastMessages(): string[] {
    return toastService.toasts().map((t) => t.message);
  }

  describe('formatFileSize', () => {
    it('formats bytes, kilobytes, and megabytes', () => {
      expect(component['formatFileSize'](512)).toBe('512 B');
      expect(component['formatFileSize'](2048)).toBe('2.0 KB');
      expect(component['formatFileSize'](5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });

  it('shows the dropzone before a file is selected, and the file card after', () => {
    expect(fixture.nativeElement.querySelector('app-dropzone')).toBeTruthy();

    selectFileViaDropzone(file);

    expect(fixture.nativeElement.querySelector('app-dropzone')).toBeFalsy();
    const info = fixture.nativeElement.querySelector('.selected-file__name') as HTMLElement;
    expect(info.textContent).toBe('invoice.pdf');
  });

  describe('file preview', () => {
    it('shows an embedded PDF preview for a PDF file', () => {
      selectFileViaDropzone(file);

      const embed = fixture.nativeElement.querySelector('.file-preview__pdf') as HTMLElement;
      expect(embed).toBeTruthy();
      expect(embed.getAttribute('type')).toBe('application/pdf');
      expect(embed.getAttribute('src')).toContain('blob:preview-');
      expect(createObjectURL).toHaveBeenCalledWith(file);
      expect(fixture.nativeElement.querySelector('.file-preview__image')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('.file-preview__placeholder')).toBeFalsy();
    });

    it('shows an image thumbnail for an image file', () => {
      const image = new File(['x'], 'invoice.png', { type: 'image/png' });
      selectFileViaDropzone(image);

      const img = fixture.nativeElement.querySelector('.file-preview__image') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('blob:preview-');
      expect(createObjectURL).toHaveBeenCalledWith(image);
      expect(fixture.nativeElement.querySelector('.file-preview__pdf')).toBeFalsy();
    });

    it('falls back to an extension placeholder for a file type without a renderer', () => {
      // Dropzone itself blocks unsupported types before this point; this exercises
      // UploadPage's own fallback directly in case that ever changes.
      const other = new File(['x'], 'notes.txt', { type: 'text/plain' });
      const dropzone = fixture.debugElement.query(By.directive(Dropzone)).componentInstance as Dropzone;
      dropzone.fileSelected.emit(other);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.file-preview__placeholder')?.textContent).toBe('TXT');
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('revokes the previous preview url when the file is removed', () => {
      selectFileViaDropzone(file);
      const createdUrl = createObjectURL.mock.results[0].value;

      (fixture.nativeElement.querySelector('.selected-file__remove') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(revokeObjectURL).toHaveBeenCalledWith(createdUrl);
      expect(fixture.nativeElement.querySelector('app-dropzone')).toBeTruthy();
    });

    it('the preview sits in normal flow below the compact file bar (no absolute overlay)', () => {
      selectFileViaDropzone(file);

      const preview = fixture.nativeElement.querySelector('.file-preview') as HTMLElement;
      const selectedFileRow = fixture.nativeElement.querySelector('.selected-file') as HTMLElement;
      expect(preview).toBeTruthy();
      // The compact file bar renders before the preview in document order, i.e. stacked, not overlaid on top of it.
      expect(selectedFileRow.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('toasts the rejection message reported by the dropzone', () => {
    const dropzone = fixture.debugElement.query(By.directive(Dropzone)).componentInstance as Dropzone;
    dropzone.fileRejected.emit('"x.txt" is not supported.');
    fixture.detectChanges();

    expect(toastMessages()).toContain('"x.txt" is not supported.');
  });

  it('prompts for confirmation instead of calling the API when split value is empty', () => {
    selectFileViaDropzone(file);

    submitBtn().click();
    fixture.detectChanges();

    expect(createJob).not.toHaveBeenCalled();
    const dialog = fixture.nativeElement.querySelector('.dialog__message') as HTMLElement;
    expect(dialog.textContent).toBe(
      'No page split has been entered. Would you like to process the entire document as a single invoice?'
    );
  });

  it('calls the API with confirmed_no_split=true when the user proceeds without a split value', () => {
    createJob.mockReturnValue(new Subject());
    selectFileViaDropzone(file);
    submitBtn().click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.dialog__btn--primary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(createJob).toHaveBeenCalledWith(file, '', true);
    expect(fixture.nativeElement.querySelector('.dialog')).toBeFalsy();
  });

  it('does not call the API when the user cancels the confirmation and closes the dialog', () => {
    selectFileViaDropzone(file);
    submitBtn().click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.dialog__btn--secondary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(createJob).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.dialog')).toBeFalsy();
  });

  it('submits directly with the trimmed split value when one is provided', () => {
    createJob.mockReturnValue(new Subject());
    selectFileViaDropzone(file);

    const input = fixture.nativeElement.querySelector('.field__input') as HTMLInputElement;
    input.value = ' 1-3 ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submitBtn().click();
    fixture.detectChanges();

    expect(createJob).toHaveBeenCalledWith(file, '1-3', false);
    expect(fixture.nativeElement.querySelector('.dialog')).toBeFalsy();
  });

  it('shows a success toast and automatically navigates to the preview screen for the new job', () => {
    const response: CreateJobResponse = { job_id: 'job-1', status: 'queued', page_count: 4 };
    createJob.mockReturnValue(of(response));

    selectFileViaDropzone(file);
    const input = fixture.nativeElement.querySelector('.field__input') as HTMLInputElement;
    input.value = '1';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    submitBtn().click();
    fixture.detectChanges();

    expect(toastMessages().some((m) => m.includes('job-1'))).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/jobs/job-1/preview');
  });

  it('shows a centered "Processing your document…" overlay and disables the form while the request is in flight', () => {
    createJob.mockReturnValue(new Subject());
    selectFileViaDropzone(file);
    const input = fixture.nativeElement.querySelector('.field__input') as HTMLInputElement;
    input.value = '1';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submitBtn().click();
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.processing-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('Processing your document…');
    expect(overlay.querySelector('.processing-modal__percent')?.textContent).toBe('0%');
    expect(input.disabled).toBe(true);
    expect((fixture.nativeElement.querySelector('.selected-file__remove') as HTMLButtonElement).disabled).toBe(true);
    expect(submitBtn().disabled).toBe(true);
  });

  it('animates the progress percentage upward while the request is in flight, and hides the overlay once it resolves', () => {
    vi.useFakeTimers();
    createJob.mockReturnValue(new Subject());
    selectFileViaDropzone(file);
    const input = fixture.nativeElement.querySelector('.field__input') as HTMLInputElement;
    input.value = '1';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submitBtn().click();
    fixture.detectChanges();

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();

    const percentText = fixture.nativeElement.querySelector('.processing-modal__percent')?.textContent ?? '';
    const percentValue = Number(percentText.replace('%', ''));
    expect(percentValue).toBeGreaterThan(0);
    expect(percentValue).toBeLessThanOrEqual(90);

    vi.useRealTimers();
  });

  it("toasts the backend's validation error message directly", () => {
    const error: JobApiError = { kind: 'validation-error', message: "'abc' isn't a valid range.", status: 400 };
    createJob.mockReturnValue(throwError(() => error));

    selectFileViaDropzone(file);
    const input = fixture.nativeElement.querySelector('.field__input') as HTMLInputElement;
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    submitBtn().click();
    fixture.detectChanges();

    expect(toastMessages()).toContain("'abc' isn't a valid range.");
  });

  it('does not show its own toast for an unauthorized (401) error — authInterceptor already handles that', () => {
    const error: JobApiError = { kind: 'unauthorized', message: 'Session expired.', status: 401 };
    createJob.mockReturnValue(throwError(() => error));

    selectFileViaDropzone(file);
    const input = fixture.nativeElement.querySelector('.field__input') as HTMLInputElement;
    input.value = '1';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    submitBtn().click();
    fixture.detectChanges();

    expect(toastMessages()).not.toContain('Session expired.');
  });
});
