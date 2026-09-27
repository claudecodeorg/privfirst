import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { analyze, sanitize } from './logic';

async function dirtyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('Secret Plan');
  doc.setAuthor('Jane Doe');
  doc.setProducer('LeakyApp 1.0');
  doc.setSubject('Confidential');
  doc.setKeywords(['secret']);

  // A minimal XMP metadata stream on the catalog.
  const xmp = doc.context.stream('<x:xmpmeta>secret-xmp-data</x:xmpmeta>', { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(xmp));

  // A /Names tree with an embedded JavaScript action.
  const jsAction = doc.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert("hi")') });
  const jsNameTree = doc.context.obj({ Names: [PDFString.of('autorun'), doc.context.register(jsAction)] });
  const names = doc.context.obj({ JavaScript: doc.context.register(jsNameTree) });
  doc.catalog.set(PDFName.of('Names'), doc.context.register(names));

  return doc.save();
}

describe('analyze', () => {
  it('finds Info fields, XMP and embedded JavaScript', async () => {
    const a = await analyze(await dirtyPdf());
    expect(a.infoFields).toEqual(expect.arrayContaining(['Title', 'Author', 'Producer', 'Subject', 'Keywords']));
    expect(a.hasXmp).toBe(true);
    expect(a.hasJavaScript).toBe(true);
    expect(a.pageCount).toBe(1);
  });
  it('finds nothing extra in a clean PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const a = await analyze(await doc.save());
    expect(a.hasXmp).toBe(false);
    expect(a.hasJavaScript).toBe(false);
    expect(a.hasEmbeddedFiles).toBe(false);
  });
});

describe('sanitize', () => {
  it('removes all detected metadata and JavaScript, keeps the page', async () => {
    const clean = await sanitize(await dirtyPdf());
    const a = await analyze(clean);
    expect(a.infoFields).toEqual([]);
    expect(a.hasXmp).toBe(false);
    expect(a.hasJavaScript).toBe(false);
    expect(a.pageCount).toBe(1);
    const reloaded = await PDFDocument.load(clean);
    expect(reloaded.getTitle()).toBeUndefined();
    expect(reloaded.getAuthor()).toBeUndefined();
  });
  it('does not leave the secret strings anywhere in the output bytes', async () => {
    const clean = await sanitize(await dirtyPdf());
    const text = Buffer.from(clean).toString('latin1');
    expect(text).not.toMatch(/Secret Plan|Jane Doe|LeakyApp|secret-xmp-data|app\.alert/);
  });
});
