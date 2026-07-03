// Client-side CSV parser (mirrors server parser)
export function parseCSVText(text: string): any[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < normalized.length) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { current.push(field); field = ''; i++; continue; }
      if (c === '\n') {
        current.push(field);
        rows.push(current);
        current = [];
        field = '';
        i++;
        continue;
      }
      field += c; i++;
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1).filter(r => r.length > 0 && r.some(c => c !== ''));
  return dataRows.map(row => {
    const obj: any = {};
    headers.forEach((h, i) => {
      const v = row[i] ?? '';
      obj[h] = tryCoerce(v);
    });
    return obj;
  });
}

function tryCoerce(v: string): any {
  if (v === '') return null;
  if (v === 'null' || v === 'NULL' || v === 'NaN') return null;
  if (v === 'true' || v === 'True' || v === 'TRUE') return true;
  if (v === 'false' || v === 'False' || v === 'FALSE') return false;
  if (/^-?\d+$/.test(v)) {
    const n = parseInt(v, 10);
    if (!isNaN(n) && Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(v)) {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return v;
}
