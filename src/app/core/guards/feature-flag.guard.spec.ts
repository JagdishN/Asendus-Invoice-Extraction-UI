import { provideRouter, Router, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { featureFlagGuard } from './feature-flag.guard';

describe('featureFlagGuard', () => {
  const originalEnableHistory = environment.features.enableHistory;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    environment.features.enableHistory = originalEnableHistory;
  });

  it('allows activation when the flag is on', () => {
    environment.features.enableHistory = true;

    const result = TestBed.runInInjectionContext(() =>
      featureFlagGuard('enableHistory')({} as never, {} as never)
    );

    expect(result).toBe(true);
  });

  it('redirects to /upload when the flag is off', () => {
    environment.features.enableHistory = false;
    const router = TestBed.inject(Router);
    const createUrlTreeSpy = vi.spyOn(router, 'createUrlTree');

    const result = TestBed.runInInjectionContext(() =>
      featureFlagGuard('enableHistory')({} as never, {} as never)
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/upload']);
  });
});
