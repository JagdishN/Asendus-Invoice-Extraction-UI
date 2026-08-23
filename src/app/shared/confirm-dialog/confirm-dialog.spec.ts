import { TestBed } from '@angular/core/testing';

import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ConfirmDialog>>;
  let component: ConfirmDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmDialog] }).compileComponents();
    fixture = TestBed.createComponent(ConfirmDialog);
    component = fixture.componentInstance;
  });

  it('renders the title, message, and button labels from inputs', () => {
    component.title = 'No split value';
    component.message = 'Proceed anyway?';
    component.confirmLabel = 'Proceed';
    component.cancelLabel = 'Go back';
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.dialog__title')?.textContent).toBe('No split value');
    expect(el.querySelector('.dialog__message')?.textContent).toBe('Proceed anyway?');
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Go back', 'Proceed']);
  });

  it('emits confirmed when the primary button is clicked', () => {
    fixture.detectChanges();
    const confirmed = vi.fn();
    component.confirmed.subscribe(confirmed);

    (fixture.nativeElement.querySelector('.dialog__btn--primary') as HTMLButtonElement).click();

    expect(confirmed).toHaveBeenCalled();
  });

  it('emits cancelled when the secondary button is clicked', () => {
    fixture.detectChanges();
    const cancelled = vi.fn();
    component.cancelled.subscribe(cancelled);

    (fixture.nativeElement.querySelector('.dialog__btn--secondary') as HTMLButtonElement).click();

    expect(cancelled).toHaveBeenCalled();
  });

  it('emits cancelled when the backdrop is clicked, but not when the dialog body is clicked', () => {
    fixture.detectChanges();
    const cancelled = vi.fn();
    component.cancelled.subscribe(cancelled);

    (fixture.nativeElement.querySelector('.dialog') as HTMLElement).click();
    expect(cancelled).not.toHaveBeenCalled();

    (fixture.nativeElement.querySelector('.dialog-backdrop') as HTMLElement).click();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
