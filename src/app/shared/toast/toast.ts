import { Component, inject } from '@angular/core';

import { ToastService, ToastType } from '../../core/services/toast.service';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠'
};

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.html',
  styleUrl: './toast.scss'
})
export class ToastHost {
  protected readonly toastService = inject(ToastService);

  protected iconFor(type: ToastType): string {
    return ICONS[type];
  }
}
