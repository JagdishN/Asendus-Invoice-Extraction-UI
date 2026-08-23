import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const DEFAULT_DURATION_MS = 15000;

/**
 * App-wide toast notifications. Success/error/warning feedback (upload
 * results, API errors) is routed through here instead of inline banners.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly toastsSignal = signal<Toast[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();

  success(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(message, 'error', durationMs);
  }

  warning(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(message, 'warning', durationMs);
  }

  dismiss(id: number): void {
    this.toastsSignal.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  private show(message: string, type: ToastType, durationMs: number): void {
    const id = ++this.nextId;
    this.toastsSignal.update((toasts) => [...toasts, { id, type, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
