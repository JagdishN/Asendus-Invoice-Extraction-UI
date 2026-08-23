import { Component, EventEmitter, Output, signal } from '@angular/core';

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

@Component({
  selector: 'app-dropzone',
  standalone: true,
  templateUrl: './dropzone.html',
  styleUrl: './dropzone.scss'
})
export class Dropzone {
  @Output() readonly fileSelected = new EventEmitter<File>();
  @Output() readonly fileRejected = new EventEmitter<string>();

  protected readonly isDragOver = signal(false);
  protected readonly acceptAttr = ACCEPTED_MIME_TYPES.concat(ACCEPTED_EXTENSIONS).join(',');

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
    input.value = '';
  }

  private handleFile(file: File): void {
    if (!this.isAcceptedFile(file)) {
      this.fileRejected.emit(
        `"${file.name}" isn't a supported file type. Please choose a PDF, JPEG, PNG, or WEBP file.`
      );
      return;
    }
    this.fileSelected.emit(file);
  }

  private isAcceptedFile(file: File): boolean {
    if (ACCEPTED_MIME_TYPES.includes(file.type)) {
      return true;
    }
    const name = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  }
}
