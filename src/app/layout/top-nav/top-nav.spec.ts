import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthApiService } from '../../core/services/auth-api.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { TopNav } from './top-nav';

describe('TopNav', () => {
  const originalFeatures = { ...environment.features };

  beforeEach(() => {
    // AuthService now persists the token to localStorage — clear it so a login in one test
    // doesn't leak into the next test's fresh instance.
    localStorage.clear();
  });

  afterEach(() => {
    environment.features.enableLogin = originalFeatures.enableLogin;
    environment.features.enableHistory = originalFeatures.enableHistory;
    localStorage.clear();
  });

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [TopNav],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { login: () => of({ access_token: 'jwt-123', token_type: 'bearer' }) } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();
    return fixture;
  }

  function linkTexts(fixture: { nativeElement: HTMLElement }): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '');
  }

  function logoutButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.top-nav__logout');
  }

  describe('logged out', () => {
    it('hides Upload and History', async () => {
      environment.features.enableHistory = true;
      const fixture = await createComponent();

      expect(linkTexts(fixture)).not.toContain('Upload');
      expect(linkTexts(fixture)).not.toContain('History');
    });

    it('shows Login when enableLogin is on', async () => {
      environment.features.enableLogin = true;
      const fixture = await createComponent();
      expect(linkTexts(fixture)).toContain('Login');
    });

    it('hides Login when enableLogin is off', async () => {
      environment.features.enableLogin = false;
      const fixture = await createComponent();
      expect(linkTexts(fixture)).not.toContain('Login');
    });

    it('does not show the logout button', async () => {
      const fixture = await createComponent();
      expect(logoutButton(fixture)).toBeFalsy();
    });
  });

  describe('logged in', () => {
    async function createLoggedInComponent() {
      const fixture = await createComponent();
      const auth = TestBed.inject(AuthService);
      auth.login('Admin', 'Admin@123').subscribe();
      fixture.detectChanges();
      return fixture;
    }

    it('shows Upload', async () => {
      const fixture = await createLoggedInComponent();
      expect(linkTexts(fixture)).toContain('Upload');
    });

    it('shows History when enableHistory is on', async () => {
      environment.features.enableHistory = true;
      const fixture = await createLoggedInComponent();
      expect(linkTexts(fixture)).toContain('History');
    });

    it('hides History when enableHistory is off', async () => {
      environment.features.enableHistory = false;
      const fixture = await createLoggedInComponent();
      expect(linkTexts(fixture)).not.toContain('History');
    });

    it('shows the logout button instead of the Login link', async () => {
      environment.features.enableLogin = true;
      const fixture = await createLoggedInComponent();

      expect(logoutButton(fixture)).toBeTruthy();
      expect(linkTexts(fixture)).not.toContain('Login');
    });

    it('clicking the logout button logs the user out', async () => {
      const fixture = await createLoggedInComponent();
      const auth = TestBed.inject(AuthService);
      const logoutSpy = vi.spyOn(auth, 'logout').mockImplementation(() => {});

      logoutButton(fixture)?.click();

      expect(logoutSpy).toHaveBeenCalled();
    });
  });
});
