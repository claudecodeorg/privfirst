import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { SaveFile } from './nativePlugins';

export function downloadBlob(blob: Blob, name: string) {
  if (Capacitor.isNativePlatform()) {
    void saveNative(blob, name);
    return;
  }
  // The <a download> blob trick doesn't exist inside a native WebView, hence the native branch above.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadBytes(data: Uint8Array, name: string, type: string) {
  downloadBlob(new Blob([data as BlobPart], { type }), name);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

// Raw bytes per step, base64-encoded before each Filesystem call. Keeps peak memory bounded for
// large PDFs/images instead of base64-encoding the whole file (which is ~33% bigger) in one go.
const CHUNK_BYTES = 1024 * 1024;

async function saveNative(blob: Blob, name: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Keeps the real filename's extension on the cache file itself: the SAF save dialog below uses
  // `name` directly and doesn't care, but the share-sheet fallback (rare — only when no document
  // picker is available at all) exposes this cache file's actual on-disk name to the receiving
  // app, so an extension-less name there would show up as an unrecognized file type.
  const safeName = name.replace(/[^A-Za-z0-9._-]/g, '_');
  const cachePath = `save-${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
  await Filesystem.writeFile({ path: cachePath, data: '', directory: Directory.Cache, recursive: true });
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    const slice = bytes.subarray(offset, offset + CHUNK_BYTES);
    await Filesystem.appendFile({ path: cachePath, data: bytesToBase64(slice), directory: Directory.Cache });
  }
  const { uri } = await Filesystem.getUri({ path: cachePath, directory: Directory.Cache });
  await SaveFile.save({ sourcePath: uri, name, mimeType: blob.type || 'application/octet-stream' });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
