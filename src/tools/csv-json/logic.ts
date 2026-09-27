// RFC 4180-style CSV: quoted fields may contain the delimiter, newlines and escaped ("") quotes.
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const push = () => { row.push(field); field = ''; };
  const endRow = () => { push(); rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { inQuotes = true; i++; continue; }
    if (c === delimiter) { push(); i++; continue; }
    if (c === '\r' && text[i + 1] === '\n') { endRow(); i += 2; continue; }
    if (c === '\n' || c === '\r') { endRow(); i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) endRow();
  // Drop a single trailing blank row from a final newline.
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

function needsQuoting(field: string, delimiter: string): boolean {
  return field.includes(delimiter) || field.includes('"') || field.includes('\n') || field.includes('\r');
}

export function toCsvField(value: unknown, delimiter: string): string {
  const s = value === null || value === undefined ? '' : String(value);
  return needsQuoting(s, delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function stringifyCsv(rows: string[][], delimiter = ','): string {
  return rows.map((r) => r.map((f) => toCsvField(f, delimiter)).join(delimiter)).join('\r\n');
}

export function csvToJson(text: string, delimiter = ','): Record<string, string>[] {
  const rows = parseCsv(text, delimiter);
  if (!rows.length) return [];
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export function jsonToCsv(data: Record<string, unknown>[], delimiter = ','): string {
  if (!data.length) return '';
  const headers = [...new Set(data.flatMap((row) => Object.keys(row)))];
  return stringifyCsv([headers, ...data.map((row) => headers.map((h) => (row[h] === undefined ? '' : String(row[h]))))], delimiter);
}
