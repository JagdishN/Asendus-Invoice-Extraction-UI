import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthApiError } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

// Only one account exists today, so the sign-in card shows it as a fixed
// identity (Administrator / Admin) instead of a free-text username field.
const ACCOUNT_USERNAME = 'Admin';
const ACCOUNT_DISPLAY_NAME = 'Administrator';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss'
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly submitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly accountUsername = ACCOUNT_USERNAME;
  protected readonly accountDisplayName = ACCOUNT_DISPLAY_NAME;

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const { password } = this.form.getRawValue();

    this.auth.login(ACCOUNT_USERNAME, password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/upload');
      },
      error: (error: AuthApiError) => {
        this.submitting.set(false);
        this.toast.error(error.message);
      }
    });
  }
}
