import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib';

export type FieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionList';
export interface FieldInfo { name: string; kind: FieldKind; options?: string[]; multiSelect?: boolean }
export type FieldValues = Record<string, string | boolean | string[]>;

export async function listFields(bytes: Uint8Array): Promise<FieldInfo[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getForm().getFields().map((f) => {
    if (f instanceof PDFCheckBox) return { name: f.getName(), kind: 'checkbox' as const };
    if (f instanceof PDFRadioGroup) return { name: f.getName(), kind: 'radio' as const, options: f.getOptions() };
    if (f instanceof PDFDropdown) return { name: f.getName(), kind: 'dropdown' as const, options: f.getOptions() };
    if (f instanceof PDFOptionList) return { name: f.getName(), kind: 'optionList' as const, options: f.getOptions(), multiSelect: true };
    return { name: f.getName(), kind: 'text' as const };
  });
}

export async function fillForm(bytes: Uint8Array, values: FieldValues, flatten: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  for (const field of form.getFields()) {
    const name = field.getName();
    if (!(name in values)) continue;
    const v = values[name];
    if (field instanceof PDFCheckBox) { if (v) field.check(); else field.uncheck(); }
    else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup) { if (typeof v === 'string' && v) field.select(v); }
    else if (field instanceof PDFOptionList) { if (Array.isArray(v) && v.length) field.select(v); }
    else if (field instanceof PDFTextField) field.setText(typeof v === 'string' ? v : '');
  }
  if (flatten) form.flatten();
  return doc.save();
}
