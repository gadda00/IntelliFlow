// Data parsers — convert uploaded files to row objects
// Supports CSV, JSON, TSV. Excel parsing is done client-side (xlsx library).

export interface ParsedFile {
  rows: any[];
  columns: string[];
  format: string;
  rowCount: number;
  fileName: string;
  fileSize: number;
}

export function parseCSV(text: string, fileName = 'data.csv'): ParsedFile {
  const rows = parseCSVText(text);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    rows,
    columns,
    format: 'csv',
    rowCount: rows.length,
    fileName,
    fileSize: text.length,
  };
}

export function parseJSON(text: string, fileName = 'data.json'): ParsedFile {
  const data = JSON.parse(text);
  let rows: any[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (Array.isArray(data.data)) {
    rows = data.data;
  } else if (Array.isArray(data.rows)) {
    rows = data.rows;
  } else if (Array.isArray(data.records)) {
    rows = data.records;
  } else if (Array.isArray(data.results)) {
    rows = data.results;
  } else if (typeof data === 'object') {
    // Single object — wrap as one row
    rows = [data];
  } else {
    throw new Error('Unrecognized JSON structure. Expected array of objects.');
  }
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    rows,
    columns,
    format: 'json',
    rowCount: rows.length,
    fileName,
    fileSize: text.length,
  };
}

// Robust CSV parser handling quoted fields, escaped quotes, and mixed line endings
export function parseCSVText(text: string): any[] {
  // Normalize line endings
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
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += c;
        i++;
        continue;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (c === ',') {
        current.push(field);
        field = '';
        i++;
        continue;
      } else if (c === '\n') {
        current.push(field);
        rows.push(current);
        current = [];
        field = '';
        i++;
        continue;
      } else {
        field += c;
        i++;
        continue;
      }
    }
  }
  // Push last field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  if (rows.length === 0) return [];

  // First row is header
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
  // Number
  if (/^-?\d+$/.test(v)) {
    const n = parseInt(v, 10);
    if (!isNaN(n) && Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(v)) {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  // ISO date
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+\-]\d{2}:?\d{2})?)?$/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return v; // keep as string — type detection later
  }
  return v;
}

export function parseFile(content: string, fileName: string, mimeType?: string): ParsedFile {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'json' || mimeType === 'application/json') {
    return parseJSON(content, fileName);
  }
  if (ext === 'tsv' || mimeType === 'text/tab-separated-values') {
    return parseCSV(content.replace(/\t/g, ','), fileName);
  }
  // Default: CSV
  return parseCSV(content, fileName);
}
