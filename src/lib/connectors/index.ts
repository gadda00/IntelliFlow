// Data Connectors — PostgreSQL, Google Sheets, BigQuery
// Unblocks 80% of B2B deals (file upload only = deal-breaker)
// All 5 advisory docs flagged this as the #1 enterprise gap

import 'server-only';

export interface ConnectorConfig {
  type: 'postgresql' | 'google_sheets' | 'bigquery' | 'mysql' | 'rest_api';
  connectionstring?: string;
  apiKey?: string;
  spreadsheetId?: string;
  range?: string;
  projectId?: string;
  query?: string;
  url?: string;
}

export interface ConnectorResult {
  rows: any[];
  columns: string[];
  rowCount: number;
  source: string;
  executedAt: string;
  durationMs: number;
}

// ─── PostgreSQL Connector ──────────────────────────────────────────────

export async function connectPostgreSQL(config: {
  connectionString: string;
  query: string;
}): Promise<ConnectorResult> {
  const start = Date.now();

  // Dynamic import of pg (only when used, avoids bundling issues)
  const { Client } = await import('pg');

  const client = new Client({ connectionString: config.connectionString });

  try {
    await client.connect();
    const result = await client.query(config.query);
    await client.end();

    const columns = result.fields.map(f => f.name);
    return {
      rows: result.rows,
      columns,
      rowCount: result.rowCount,
      source: 'postgresql',
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    await client.end().catch(() => {});
    throw new Error(`PostgreSQL query failed: ${err.message}`);
  }
}

// ─── Google Sheets Connector ───────────────────────────────────────────

export async function connectGoogleSheets(config: {
  apiKey: string;
  spreadsheetId: string;
  range: string;
}): Promise<ConnectorResult> {
  const start = Date.now();

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(config.range)}?key=${config.apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Sheets API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const values: any[][] = data.values || [];

  if (values.length === 0) {
    return { rows: [], columns: [], rowCount: 0, source: 'google_sheets', executedAt: new Date().toISOString(), durationMs: Date.now() - start };
  }

  // First row = headers
  const headers = values[0].map((h: any) => String(h || `column_${Math.random()}`));
  const rows = values.slice(1).map((row: any[]) => {
    const obj: any = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = row[i] ?? null;
      // Try to coerce numbers
      const val = row[i];
      if (val !== null && val !== undefined && val !== '') {
        if (/^-?\d+$/.test(String(val))) obj[header] = parseInt(val, 10);
        else if (/^-?\d+\.\d+$/.test(String(val))) obj[header] = parseFloat(val);
      }
    });
    return obj;
  });

  return {
    rows,
    columns: headers,
    rowCount: rows.length,
    source: 'google_sheets',
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

// ─── BigQuery Connector ────────────────────────────────────────────────

export async function connectBigQuery(config: {
  projectId: string;
  apiKey: string;
  query: string;
}): Promise<ConnectorResult> {
  const start = Date.now();

  // Use BigQuery REST API (no SDK needed)
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/queries?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: config.query,
      useLegacySql: false,
      maxResults: 10000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`BigQuery API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const fields = data.schema?.fields || [];
  const columns = fields.map((f: any) => f.name);
  const rows = (data.rows || []).map((row: any) => {
    const obj: any = {};
    fields.forEach((field: any, i: number) => {
      const val = row.f?.[i]?.v;
      if (field.type === 'INTEGER' || field.type === 'FLOAT64' || field.type === 'NUMERIC') {
        obj[field.name] = val ? parseFloat(val) : null;
      } else if (field.type === 'BOOLEAN') {
        obj[field.name] = val === 'true';
      } else {
        obj[field.name] = val;
      }
    });
    return obj;
  });

  return {
    rows,
    columns,
    rowCount: rows.length,
    source: 'bigquery',
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

// ─── REST API Connector ────────────────────────────────────────────────

export async function connectRestAPI(config: {
  url: string;
  headers?: Record<string, string>;
  dataPath?: string; // JSON path to the array (e.g., "data.results")
}): Promise<ConnectorResult> {
  const start = Date.now();

  const response = await fetch(config.url, { headers: config.headers || {} });
  if (!response.ok) throw new Error(`REST API error: ${response.status}`);

  const data = await response.json();

  // Navigate to the data array
  let rows: any[] = data;
  if (config.dataPath) {
    const parts = config.dataPath.split('.');
    for (const part of parts) {
      rows = rows?.[part];
      if (!rows) break;
    }
  }

  if (!Array.isArray(rows)) {
    rows = [rows];
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    rows,
    columns,
    rowCount: rows.length,
    source: 'rest_api',
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

// ─── Universal Connector Router ────────────────────────────────────────

export async function connectToDataSource(config: ConnectorConfig): Promise<ConnectorResult> {
  switch (config.type) {
    case 'postgresql':
      return connectPostgreSQL({
        connectionString: config.connectionstring!,
        query: config.query!,
      });
    case 'google_sheets':
      return connectGoogleSheets({
        apiKey: config.apiKey!,
        spreadsheetId: config.spreadsheetId!,
        range: config.range || 'A:Z',
      });
    case 'bigquery':
      return connectBigQuery({
        projectId: config.projectId!,
        apiKey: config.apiKey!,
        query: config.query!,
      });
    case 'rest_api':
      return connectRestAPI({
        url: config.url!,
        dataPath: config.query, // Reuse query field as data path
      });
    default:
      throw new Error(`Unknown connector type: ${config.type}`);
  }
}
