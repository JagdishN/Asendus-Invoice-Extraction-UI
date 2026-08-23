import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { FeatureFlags } from '../../../environments/environment.model';

/**
 * Blocks direct navigation to a route whose feature flag is off, redirecting
 * to Upload instead. Flip the flag in environment.ts/environment.prod.ts to
 * bring the route back — no route/component deletion needed.
 */
export function featureFlagGuard(flag: keyof FeatureFlags): CanActivateFn {
  return () => {
    if (environment.features[flag]) {
      return true;
    }
    const router = inject(Router);
    return router.createUrlTree(['/upload']);
  };
}
