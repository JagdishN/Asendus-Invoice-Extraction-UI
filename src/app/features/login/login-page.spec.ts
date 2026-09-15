import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { AuthApiService } from '../../core/services/auth-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<LoginPage>>;
  let component: LoginPage;
  let router: Router;
  let auth: AuthService;
  let toastService: ToastService;
  let httpMock: HttpTestingController;
  let loginUrl: string;

  beforeEach(async () => {
    // AuthService now persists the token to localStorage (so a page refresh doesn't log the
    // user out) — clear it so a login in one test doesn't leak into the next test's fresh instance.
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    toastService = TestBed.inject(ToastService);
    httpMock = TestBed.inject(HttpTestingController);
    loginUrl = TestBed.inject(AuthApiService).loginUrl;
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('does not show a "Login with OTP" link, only "Forgot Password"', () => {
    const links = (Array.from(fixture.nativeElement.querySelectorAll('.link')) as HTMLElement[]).map((a) =>
      a.textContent?.trim()
    );

    expect(links).toEqual(['Forgot Password']);
  });

  it('disables the submit button until the form is valid', () => {
    component['form'].setValue({ username: '', password: '' });
    fixture.detectChanges();
    const submitBtn = () => fixture.nativeElement.querySelector('.submit-btn') as HTMLButtonElement;

    expect(submitBtn().disabled).toBe(true);

    const [usernameInput, passwordInput] = Array.from(
      fixture.nativeElement.querySelectorAll('input')
    ) as HTMLInputElement[];

    usernameInput.value = 'alice';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'secret123';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(submitBtn().disabled).toBe(false);
  });

  it('does not call the backend while the form is invalid', () => {
    component['form'].setValue({ username: '', password: '' });

    component['submit']();

    httpMock.expectNone(loginUrl);
  });

  it('submit calls POST /api/auth/login with the entered credentials', () => {
    component['form'].setValue({ username: 'Admin', password: 'Admin@123' });

    component['submit']();

    const req = httpMock.expectOne(loginUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'Admin', password: 'Admin@123' });
    req.flush({ access_token: 'jwt-123', token_type: 'bearer' });
  });

  it('disables the submit button while the request is in flight', () => {
    component['form'].setValue({ username: 'Admin', password: 'Admin@123' });
    const submitBtn = () => fixture.nativeElement.querySelector('.submit-btn') as HTMLButtonElement;

    component['submit']();
    fixture.detectChanges();

    expect(component['submitting']()).toBe(true);
    expect(submitBtn().disabled).toBe(true);

    const req = httpMock.expectOne(loginUrl);
    req.flush({ access_token: 'jwt-123', token_type: 'bearer' });
    fixture.detectChanges();

    expect(component['submitting']()).toBe(false);
  });

  it('on success, logs the user in and redirects to /upload', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    component['form'].setValue({ username: 'Admin', password: 'Admin@123' });

    component['submit']();
    const req = httpMock.expectOne(loginUrl);
    req.flush({ access_token: 'jwt-123', token_type: 'bearer' });

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('/upload');
  });

  it('on a 401, shows the exact backend error message and does not log in or navigate', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    const toastSpy = vi.spyOn(toastService, 'error');
    component['form'].setValue({ username: 'Admin', password: 'wrong-password' });

    component['submit']();
    const req = httpMock.expectOne(loginUrl);
    req.flush({ detail: 'Invalid username or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Invalid username or password');
    expect(component['submitting']()).toBe(false);
  });
});
