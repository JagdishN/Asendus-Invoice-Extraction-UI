import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthApiError } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

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

  // Prefilled from environment.devCredentials for local dev convenience only —
  // this only saves typing; the credentials are still validated for real
  // against the backend on submit.
  protected readonly form = this.fb.nonNullable.group({
    username: [environment.devCredentials.username, [Validators.required]],
    password: [environment.devCredentials.password, [Validators.required, Validators.minLength(6)]]
  });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const { username, password } = this.form.getRawValue();

    this.auth.login(username, password).subscribe({
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
