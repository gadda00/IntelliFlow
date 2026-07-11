// Client-side CSV/JSON parser — improved with BOM handling, duplicate headers,
// scientific notation, TSV support, and better edge cases.

export function parseCSVText(text: string): any[] {
  // Strip BOM (Byte Order Mark) — common in Excel-exported CSVs
  let clean = text.replace(/^\uFEFF/, '');
  // Normalize line endings
  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Detect delimiter: if first line has tabs but no commas, use tab (TSV)
  const firstLine = clean.split('\n')[0] || '';
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === delimiter) { current.push(field); field = ''; i++; continue; }
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

  // Handle headers — strip BOM from first header, handle duplicates
  const rawHeaders = rows[0].map(h => h.trim());
  const headers: string[] = [];
  const seen: Record<string, number> = {};
  for (const h of rawHeaders) {
    const cleanHeader = h || `column_${headers.length}`;
    if (seen[cleanHeader] !== undefined) {
      seen[cleanHeader]++;
      headers.push(`${cleanHeader}_${seen[cleanHeader]}`);
    } else {
      seen[cleanHeader] = 0;
      headers.push(cleanHeader);
    }
  }

  const dataRows = rows.slice(1).filter(r => r.length > 0 && r.some(c => c.trim() !== ''));
  return dataRows.map(row => {
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = tryCoerce(row[i] ?? '');
    });
    return obj;
  });
}

function tryCoerce(v: string): any {
  const trimmed = v.trim();
  if (trimmed === '') return null;
  if (trimmed === 'null' || trimmed === 'NULL' || trimmed === 'NaN' || trimmed === 'NA') return null;
  if (trimmed === 'true' || trimmed === 'True' || trimmed === 'TRUE') return true;
  if (trimmed === 'false' || trimmed === 'False' || trimmed === 'FALSE') return false;

  // Integer
  if (/^-?\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (!isNaN(n) && Number.isSafeInteger(n)) return n;
  }

  // Float (including scientific notation: 1.5e3, -2.3E-4)
  if (/^-?\d+\.\d+([eE][+-]?\d+)?$/.test(trimmed) || /^-?\d+([eE][+-]?\d+)$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (!isNaN(n) && isFinite(n)) return n;
  }

  // ISO date detection
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed; // keep as string, agents handle parsing
  }

  return trimmed;
}
