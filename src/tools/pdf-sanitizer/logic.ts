import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFStream } from 'pdf-lib';

/** pdf-lib serializes every object still registered in the context, reachable or not — deleting a
 *  dictionary *entry* alone leaves the object's bytes in the saved file. This walks the subtree
 *  being removed and deletes each object from the context too, so it's actually gone from the output. */
function purge(doc: PDFDocument, value: unknown, seen = new Set<PDFRef>()): void {
  if (!(value instanceof PDFRef) || seen.has(value)) return;
  seen.add(value);
  const obj = doc.context.lookup(value);
  doc.context.delete(value);
  if (obj instanceof PDFDict) for (const [, v] of obj.entries()) purge(doc, v, seen);
  else if (obj instanceof PDFArray) for (let i = 0; i < obj.size(); i++) purge(doc, obj.get(i), seen);
  else if (obj instanceof PDFStream) for (const [, v] of obj.dict.entries()) purge(doc, v, seen);
}

const INFO_KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'] as const;

export interface Analysis {
  infoFields: string[]; // Info dictionary keys present (Title, Author, ...)
  hasXmp: boolean;
  hasEmbeddedFiles: boolean;
  hasJavaScript: boolean;
  pageCount: number;
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
}

function namesTreeHas(doc: PDFDocument, treeName: string): boolean {
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  return !!names?.lookupMaybe(PDFName.of(treeName), PDFDict);
}

export async function analyze(bytes: Uint8Array): Promise<Analysis> {
  const doc = await load(bytes);
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  const infoFields = info instanceof PDFDict ? INFO_KEYS.filter((k) => info.get(PDFName.of(k)) !== undefined) : [];
  return {
    infoFields,
    hasXmp: doc.catalog.get(PDFName.of('Metadata')) !== undefined,
    hasEmbeddedFiles: namesTreeHas(doc, 'EmbeddedFiles'),
    hasJavaScript: namesTreeHas(doc, 'JavaScript') || doc.catalog.get(PDFName.of('OpenAction')) !== undefined,
    pageCount: doc.getPageCount(),
  };
}

export async function sanitize(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await load(bytes);
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  if (info instanceof PDFDict) for (const k of INFO_KEYS) info.delete(PDFName.of(k));
  for (const key of ['Metadata', 'Names', 'OpenAction']) {
    const ref = doc.catalog.get(PDFName.of(key));
    doc.catalog.delete(PDFName.of(key));
    purge(doc, ref);
  }
  for (const page of doc.getPages()) {
    const ref = page.node.get(PDFName.of('Metadata'));
    page.node.delete(PDFName.of('Metadata'));
    purge(doc, ref);
  }
  return doc.save();
}
