import { TestBed } from '@angular/core/testing';

import { Dropzone } from './dropzone';

describe('Dropzone', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Dropzone>>;
  let component: Dropzone;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Dropzone] }).compileComponents();
    fixture = TestBed.createComponent(Dropzone);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fakeDragEvent(files: File[]): DragEvent {
    return {
      preventDefault: vi.fn(),
      dataTransfer: { files: files as unknown as FileList }
    } as unknown as DragEvent;
  }

  it('shows the supported formats before a file is picked', () => {
    const hint = fixture.nativeElement.querySelector('.dropzone__hint') as HTMLElement;
    expect(hint.textContent).toContain('PDF');
    expect(hint.textContent).toContain('JPEG');
    expect(hint.textContent).toContain('PNG');
    expect(hint.textContent).toContain('WEBP');
  });

  it('emits fileSelected for an accepted mime type dropped on the zone', () => {
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
    const emitted: File[] = [];
    component.fileSelected.subscribe((f) => emitted.push(f));

    component['onDrop'](fakeDragEvent([file]));

    expect(emitted).toEqual([file]);
  });

  it('emits fileRejected for an unsupported type', () => {
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const rejections: string[] = [];
    component.fileRejected.subscribe((msg) => rejections.push(msg));

    component['onDrop'](fakeDragEvent([file]));

    expect(rejections.length).toBe(1);
    expect(rejections[0]).toContain('notes.txt');
  });

  it('accepts a file by extension when the browser reports no mime type', () => {
    const file = new File(['x'], 'scan.webp', { type: '' });
    const emitted: File[] = [];
    component.fileSelected.subscribe((f) => emitted.push(f));

    component['onDrop'](fakeDragEvent([file]));

    expect(emitted).toEqual([file]);
  });

  it('toggles isDragOver on dragover/dragleave', () => {
    component['onDragOver']({ preventDefault: vi.fn() } as unknown as DragEvent);
    expect(component['isDragOver']()).toBe(true);

    component['onDragLeave']({ preventDefault: vi.fn() } as unknown as DragEvent);
    expect(component['isDragOver']()).toBe(false);
  });

  it('resets isDragOver after a drop', () => {
    component['isDragOver'].set(true);
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });

    component['onDrop'](fakeDragEvent([file]));

    expect(component['isDragOver']()).toBe(false);
  });

  it('handles file input change events the same way as drop', () => {
    const file = new File(['x'], 'invoice.png', { type: 'image/png' });
    const emitted: File[] = [];
    component.fileSelected.subscribe((f) => emitted.push(f));

    const input = { files: [file], value: 'invoice.png' } as unknown as HTMLInputElement;
    component['onFileInputChange']({ target: input } as unknown as Event);

    expect(emitted).toEqual([file]);
    expect(input.value).toBe('');
  });
});
