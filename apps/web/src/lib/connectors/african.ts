/**
 * African SME Finance Connectors — the vertical wedge that differentiates
 * Busara from all generalist competitors.
 *
 * Per the Brutally Honest Review:
 * "The obvious wedge: African and emerging-market businesses whose real
 * data — M-Pesa and mobile-money ledgers, local telco/utility data,
 * SACCO and micro-lending records, Flutterwave/Paystack transaction
 * exports — is not modeled well by any of the platforms above."
 *
 * "The AI data analyst that actually understands mobile-money and African
 * SME finance is a defensible, differentiated claim."
 */

export interface ConnectorConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'mobile-money' | 'payments' | 'banking' | 'government' | 'generic';
  acceptedFormats: string[];
  parser: (data: string | File) => Promise<Record<string, any>[]>;
  columnMapping?: Record<string, string>;
}

// ─── M-Pesa Statement Parser ───────────────────────────────────────
// Parses M-Pesa statement PDF/CSV exports into standard transaction format
function parseMPesaCSV(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(l => l.trim());
  const rows: Record<string, any>[] = [];

  // M-Pesa CSV format: Date,Details,Transaction Type,Account,Withdrawn,Paid,Balance
  // Skip header rows (sometimes there's a logo/title row)
  const dataStart = lines.findIndex(l => l.toLowerCase().includes('date') || l.includes(','));
  
  for (let i = Math.max(1, dataStart + 1); i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
    if (parts.length >= 4) {
      rows.push({
        date: parts[0],
        details: parts[1],
        transactionType: parts[2],
        account: parts[3],
        withdrawn: parseFloat(parts[4]?.replace(/[^\d.-]/g, '')) || 0,
        paid: parseFloat(parts[5]?.replace(/[^\d.-]/g, '')) || 0,
        balance: parseFloat(parts[6]?.replace(/[^\d.-]/g, '')) || 0,
      });
    }
  }
  return rows;
}

// ─── Flutterwave Export Parser ─────────────────────────────────────
function parseFlutterwaveCSV(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(l => l.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
    if (parts.length >= 5) {
      rows.push({
        transactionId: parts[0],
        date: parts[1],
        amount: parseFloat(parts[2]?.replace(/[^\d.-]/g, '')) || 0,
        currency: parts[3],
        status: parts[4],
        customer: parts[5] || '',
        paymentMethod: parts[6] || '',
      });
    }
  }
  return rows;
}

// ─── Paystack Export Parser ────────────────────────────────────────
function parsePaystackCSV(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(l => l.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
    if (parts.length >= 5) {
      rows.push({
        reference: parts[0],
        date: parts[1],
        amount: parseFloat(parts[2]?.replace(/[^\d.-]/g, '')) || 0,
        currency: parts[3],
        status: parts[4],
        customer: parts[5] || '',
        channel: parts[6] || '',
      });
    }
  }
  return rows;
}

// ─── KRA (Kenya Revenue Authority) Parser ──────────────────────────
function parseKRAFile(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(l => l.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
    if (parts.length >= 4) {
      rows.push({
        pin: parts[0],
        taxType: parts[1],
        period: parts[2],
        amount: parseFloat(parts[3]?.replace(/[^\d.-]/g, '')) || 0,
        status: parts[4] || '',
        dueDate: parts[5] || '',
      });
    }
  }
  return rows;
}

// ─── Generic CSV/JSON Parser (fallback) ────────────────────────────
async function parseGeneric(file: string | File): Promise<Record<string, any>[]> {
  let text: string;
  if (typeof file === 'string') {
    text = file;
  } else {
    text = await file.text();
  }

  // Try JSON first
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) return json;
    if (json.data && Array.isArray(json.data)) return json.data;
    if (json.rows && Array.isArray(json.rows)) return json.rows;
    return [json];
  } catch {
    // Fall through to CSV
  }

  // CSV
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
    const row: Record<string, any> = {};
    headers.forEach((h, j) => {
      const v = parts[j] || '';
      const n = parseFloat(v.replace(/[^\d.-]/g, ''));
      row[h] = !isNaN(n) && v.match(/^-?[\d.,]+$/) ? n : v;
    });
    rows.push(row);
  }
  return rows;
}

// ─── Available Connectors ──────────────────────────────────────────
export const CONNECTORS: ConnectorConfig[] = [
  {
    id: 'mpesa',
    name: 'M-Pesa Statement',
    description: 'Safaricom M-Pesa transaction statement (CSV export)',
    icon: '📱',
    category: 'mobile-money',
    acceptedFormats: ['.csv', '.txt'],
    parser: async (data) => {
      const text = typeof data === 'string' ? data : await data.text();
      return parseMPesaCSV(text);
    },
    columnMapping: {
      'Withdrawn': 'debit',
      'Paid': 'credit',
      'Balance': 'running_balance',
      'Transaction Type': 'category',
    },
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave Export',
    description: 'Flutterwave transaction export (CSV)',
    icon: '💸',
    category: 'payments',
    acceptedFormats: ['.csv'],
    parser: async (data) => {
      const text = typeof data === 'string' ? data : await data.text();
      return parseFlutterwaveCSV(text);
    },
  },
  {
    id: 'paystack',
    name: 'Paystack Export',
    description: 'Paystack transaction export (CSV)',
    icon: '💳',
    category: 'payments',
    acceptedFormats: ['.csv'],
    parser: async (data) => {
      const text = typeof data === 'string' ? data : await data.text();
      return parsePaystackCSV(text);
    },
  },
  {
    id: 'kra',
    name: 'KRA Tax Data',
    description: 'Kenya Revenue Authority tax records (CSV)',
    icon: '🏛️',
    category: 'government',
    acceptedFormats: ['.csv', '.txt'],
    parser: async (data) => {
      const text = typeof data === 'string' ? data : await data.text();
      return parseKRAFile(text);
    },
  },
  {
    id: 'sacco',
    name: 'SACCO Statement',
    description: 'SACCO/micro-lending statement (CSV)',
    icon: '🏦',
    category: 'banking',
    acceptedFormats: ['.csv'],
    parser: async (data) => {
      const text = typeof data === 'string' ? data : await data.text();
      // SACCO statements vary — use generic parser with column auto-detection
      return parseGeneric(text);
    },
  },
  {
    id: 'csv',
    name: 'CSV / JSON File',
    description: 'Any CSV or JSON file',
    icon: '📄',
    category: 'generic',
    acceptedFormats: ['.csv', '.json', '.txt'],
    parser: parseGeneric,
  },
];

export function getConnectorById(id: string): ConnectorConfig | undefined {
  return CONNECTORS.find(c => c.id === id);
}

export function getConnectorsByCategory(category: string): ConnectorConfig[] {
  return CONNECTORS.filter(c => c.category === category);
}
