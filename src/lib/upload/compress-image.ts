/**
 * Client-side image compression using Canvas API.
 * Reduces photos from 4-8MB (phone camera) to <300KB before upload.
 */

const MAX_WIDTH = 1200;
const QUALITY = 0.75;

export interface CompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export async function compressImage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<CompressResult> {
  const originalSize = file.size;
  onProgress?.(10);

  if (!isImageFile(file)) {
    onProgress?.(100);
    return { blob: file, originalSize, compressedSize: file.size, ratio: 1 };
  }

  const bitmap = await createImageBitmap(file);
  onProgress?.(30);

  let width = bitmap.width;
  let height = bitmap.height;

  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    onProgress?.(100);
    return { blob: file, originalSize, compressedSize: file.size, ratio: 1 };
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  onProgress?.(60);

  const outputType = file.type === 'image/png' ? 'image/webp' : file.type;
  const blob = await canvas.convertToBlob({ type: outputType, quality: QUALITY });
  onProgress?.(100);

  return {
    blob,
    originalSize,
    compressedSize: blob.size,
    ratio: Math.round((1 - blob.size / originalSize) * 100),
  };
}
