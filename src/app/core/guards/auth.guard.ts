import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Blocks direct navigation to a route unless the user is logged in, redirecting to Login instead. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return true;
  }
  const router = inject(Router);
  return router.createUrlTree(['/login']);
};
