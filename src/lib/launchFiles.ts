// Bridges the File Handling API (window.launchQueue, installed desktop Chrome/Edge only) to whichever
// tool should open the file. A tool calls consumeLaunchFiles(id, cb) once on mount; if the app was just
// launched to open a file for that tool, cb fires with the File objects (and the entry is cleared).
type Waiter = (files: File[]) => void;
const pending = new Map<string, File[]>();
const waiters = new Map<string, Waiter>();

function routeFor(mimeType: string): string | null {
  if (mimeType === 'application/pdf') return 'pdf-toolkit';
  if (mimeType.startsWith('image/')) return 'image-compressor';
  return null;
}

function deliver(tool: string, files: File[]) {
  const waiter = waiters.get(tool);
  if (waiter) waiter(files); else pending.set(tool, files);
}

export function initLaunchQueue(): void {
  const lq = (window as unknown as { launchQueue?: { setConsumer(cb: (p: { files: FileSystemFileHandle[] }) => void): void } }).launchQueue;
  if (!lq) return; // most browsers: this feature is a no-op
  lq.setConsumer((params) => {
    void (async () => {
      const byTool = new Map<string, File[]>();
      for (const handle of params.files) {
        const file = await handle.getFile();
        const tool = routeFor(file.type);
        if (tool) byTool.set(tool, [...(byTool.get(tool) ?? []), file]);
      }
      for (const [tool, files] of byTool) { deliver(tool, files); location.hash = `#/${tool}`; }
    })();
  });
}

/** Returns an unsubscribe function. Call from a tool's mount effect. */
export function consumeLaunchFiles(toolId: string, onFiles: (files: File[]) => void): () => void {
  const ready = pending.get(toolId);
  if (ready) { pending.delete(toolId); onFiles(ready); return () => {}; }
  waiters.set(toolId, onFiles);
  return () => { if (waiters.get(toolId) === onFiles) waiters.delete(toolId); };
}
