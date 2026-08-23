import { TestBed } from '@angular/core/testing';

import { ToastService } from '../../core/services/toast.service';
import { ToastHost } from './toast';

describe('ToastHost', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ToastHost>>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ToastHost] }).compileComponents();
    fixture = TestBed.createComponent(ToastHost);
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('renders nothing when there are no toasts', () => {
    expect(fixture.nativeElement.querySelectorAll('.toast').length).toBe(0);
  });

  it('renders a toast for each active message, tagged with its type', () => {
    toastService.success('Upload successful.');
    toastService.error('Something broke.');
    toastService.warning('Double-check this.');
    fixture.detectChanges();

    const toasts = fixture.nativeElement.querySelectorAll('.toast');
    expect(toasts.length).toBe(3);
    expect(toasts[0].getAttribute('data-type')).toBe('success');
    expect(toasts[0].textContent).toContain('Upload successful.');
    expect(toasts[1].getAttribute('data-type')).toBe('error');
    expect(toasts[1].textContent).toContain('Something broke.');
    expect(toasts[2].getAttribute('data-type')).toBe('warning');
    expect(toasts[2].textContent).toContain('Double-check this.');
  });

  it('shows a distinct icon per toast type', () => {
    toastService.success('ok');
    toastService.error('bad');
    toastService.warning('careful');
    fixture.detectChanges();

    const icons = Array.from(fixture.nativeElement.querySelectorAll('.toast__icon')).map((el) =>
      (el as HTMLElement).textContent?.trim()
    );

    expect(icons).toEqual(['✓', '✕', '⚠']);
  });

  it('dismiss button removes the toast', () => {
    toastService.error('Dismiss me.');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.toast__dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.toast').length).toBe(0);
  });
});
