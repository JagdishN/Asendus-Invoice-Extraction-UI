import { TestBed } from '@angular/core/testing';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ToastService] });
    service = TestBed.inject(ToastService);
  });

  it('starts with no toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('success() adds a success toast', () => {
    service.success('Upload successful.');

    expect(service.toasts()).toEqual([{ id: expect.any(Number), type: 'success', message: 'Upload successful.' }]);
  });

  it('error() adds an error toast', () => {
    service.error('Something went wrong.');

    expect(service.toasts()).toEqual([{ id: expect.any(Number), type: 'error', message: 'Something went wrong.' }]);
  });

  it('warning() adds a warning toast', () => {
    service.warning('Double-check this before continuing.');

    expect(service.toasts()).toEqual([
      { id: expect.any(Number), type: 'warning', message: 'Double-check this before continuing.' }
    ]);
  });

  it('assigns each toast a unique, increasing id', () => {
    service.error('first');
    service.error('second');

    const [first, second] = service.toasts();
    expect(second.id).toBeGreaterThan(first.id);
  });

  it('dismiss() removes only the matching toast', () => {
    service.error('first');
    service.error('second');
    const [first] = service.toasts();

    service.dismiss(first.id);

    expect(service.toasts().map((t) => t.message)).toEqual(['second']);
  });

  it('auto-dismisses a toast after its duration elapses', () => {
    vi.useFakeTimers();

    service.error('temporary', 1000);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(1000);

    expect(service.toasts()).toEqual([]);
    vi.useRealTimers();
  });

  it('defaults to a 15 second display time', () => {
    vi.useFakeTimers();

    service.error('temporary');
    vi.advanceTimersByTime(14999);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toEqual([]);

    vi.useRealTimers();
  });
});
