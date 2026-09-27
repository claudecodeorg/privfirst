import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { fillForm, listFields } from './logic';

async function formPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const form = doc.getForm();
  form.createTextField('name').addToPage(page, { x: 10, y: 250, width: 200, height: 20 });
  form.createCheckBox('agree').addToPage(page, { x: 10, y: 200, width: 20, height: 20 });
  const dd = form.createDropdown('color');
  dd.addOptions(['Red', 'Green', 'Blue']);
  dd.addToPage(page, { x: 10, y: 150, width: 100, height: 20 });
  return doc.save();
}

describe('listFields', () => {
  it('lists each field with its kind', async () => {
    const fields = await listFields(await formPdf());
    expect(fields).toEqual(expect.arrayContaining([
      { name: 'name', kind: 'text' },
      { name: 'agree', kind: 'checkbox' },
      { name: 'color', kind: 'dropdown', options: ['Red', 'Green', 'Blue'] },
    ]));
  });
  it('returns an empty list for a PDF with no form', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    expect(await listFields(await doc.save())).toEqual([]);
  });
});

describe('fillForm', () => {
  it('fills text, checkbox and dropdown fields, leaving the form editable', async () => {
    const filled = await fillForm(await formPdf(), { name: 'Ada Lovelace', agree: true, color: 'Green' }, false);
    const doc = await PDFDocument.load(filled);
    const form = doc.getForm();
    expect(form.getTextField('name').getText()).toBe('Ada Lovelace');
    expect(form.getCheckBox('agree').isChecked()).toBe(true);
    expect(form.getDropdown('color').getSelected()).toEqual(['Green']);
  });
  it('leaves fields not mentioned in values untouched', async () => {
    const filled = await fillForm(await formPdf(), { name: 'Only Name' }, false);
    const form = (await PDFDocument.load(filled)).getForm();
    expect(form.getCheckBox('agree').isChecked()).toBe(false);
  });
  it('flattening makes the fields permanent (no longer a form)', async () => {
    const filled = await fillForm(await formPdf(), { name: 'Ada' }, true);
    const fields = await listFields(filled);
    expect(fields).toEqual([]);
  });
});
