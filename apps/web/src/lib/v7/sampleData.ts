/**
 * Sample datasets for the v7 analysis wizard.
 * Each dataset is designed to showcase different agent capabilities.
 *
 * Data is generated deterministically using a seeded PRNG (mulberry32)
 * so that every page load produces the same dataset — critical for
 * reproducible demos, screenshots, and E2E tests.
 */

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  icon: string;
  highlights: string[];
  data: Record<string, any>[];
}

// ─── Seeded PRNG (mulberry32) — deterministic across page loads ──────
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Replace Math.random with seeded version for reproducible data
const seededRandom = mulberry32(42);
const random = () => seededRandom();

// ─── E-commerce Sales (default — shows forecasting, anomalies, correlations) ──

const ecommerceData: Record<string, any>[] = [];
const products = ['Widget A', 'Widget B', 'Widget C', 'Gadget X', 'Gadget Y', 'Gadget Z'];
const regions = ['North', 'South', 'East', 'West'];
const categories = ['Electronics', 'Tools'];
const baseSales = 1500;
for (let i = 0; i < 60; i++) {
  const date = new Date(2024, 0, 1);
  date.setDate(date.getDate() + i * 3);
  const trend = i * 25;
  const seasonal = Math.sin(i * 0.3) * 400;
  const noise = (random() - 0.5) * 300;
  const sales = Math.round(baseSales + trend + seasonal + noise);
  const qty = Math.round(sales / 40 + (random() - 0.5) * 5);

  ecommerceData.push({
    date: date.toISOString().split('T')[0],
    product: products[i % products.length],
    category: categories[i % 2],
    region: regions[i % 4],
    sales,
    quantity: qty,
    unit_price: Math.round((sales / qty) * 100) / 100,
    discount: Math.round(random() * 20 * 100) / 100,
    customer_rating: Math.round((3 + random() * 2) * 10) / 10,
  });
}

// ─── M-Pesa Transactions (African market — shows fraud, PII, Africa intel) ────

const mpesaData: Record<string, any>[] = [];
const phoneNumbers = ['+254712345678', '+254723456789', '+254734567890', '+254745678901', '+254756789012'];
const transactionTypes = ['send', 'receive', 'paybill', 'buygoods', 'withdraw', 'deposit'];
const merchants = ['Safaricom', 'KPLC', 'Nairobi Water', 'Jumia', 'Naivas', 'Tuskys', 'Equity Bank'];
for (let i = 0; i < 80; i++) {
  const date = new Date(2024, 0, 1);
  date.setHours(date.getHours() + i * 6);
  const amount = Math.round(random() * 5000 + 50);
  const isAnomaly = i % 15 === 0;
  const finalAmount = isAnomaly ? amount * 10 : amount;

  mpesaData.push({
    transaction_id: `MP${String(i + 1000).padStart(6, '0')}`,
    timestamp: date.toISOString(),
    phone_number: phoneNumbers[i % phoneNumbers.length],
    email: `user${i % 5}@gmail.com`,
    type: transactionTypes[i % transactionTypes.length],
    amount: finalAmount,
    merchant: merchants[i % merchants.length],
    status: random() > 0.05 ? 'success' : 'failed',
    balance: Math.round(random() * 10000),
  });
}

// ─── Healthcare Metrics (shows clustering, benchmarks, quality) ───────────────

const healthData: Record<string, any>[] = [];
const departments = ['Emergency', 'ICU', 'General Ward', 'Pediatrics', 'Surgery', 'Maternity'];
const diagnoses = ['Malaria', 'Hypertension', 'Diabetes', 'Respiratory Infection', 'Injury', 'Maternal Care'];
for (let i = 0; i < 50; i++) {
  const admitDate = new Date(2024, Math.floor(random() * 12), Math.floor(random() * 28) + 1);
  const stayDays = Math.floor(random() * 10) + 1;
  const dischargeDate = new Date(admitDate);
  dischargeDate.setDate(dischargeDate.getDate() + stayDays);

  healthData.push({
    patient_id: `P${String(i + 100).padStart(5, '0')}`,
    admit_date: admitDate.toISOString().split('T')[0],
    discharge_date: dischargeDate.toISOString().split('T')[0],
    department: departments[i % departments.length],
    diagnosis: diagnoses[i % diagnoses.length],
    age: Math.floor(random() * 70) + 10,
    length_of_stay: stayDays,
    cost: Math.round(stayDays * (500 + random() * 1500)),
    satisfaction: Math.round((3 + random() * 2) * 10) / 10,
    readmitted: random() > 0.85 ? 1 : 0,
  });
}

// ─── Export ────────────────────────────────────────────────────────────

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'ecommerce',
    name: 'E-Commerce Sales',
    description: '60 days of product sales across 4 regions with trends, seasonality, and anomalies',
    icon: 'ShoppingCart',
    highlights: ['Time series forecasting', 'Anomaly detection', 'Correlation analysis', 'Causal inference'],
    data: ecommerceData,
  },
  {
    id: 'mpesa',
    name: 'M-Pesa Transactions',
    description: '80 mobile money transactions with amounts, merchants, and timestamps — includes PII and fraud patterns',
    icon: 'Smartphone',
    highlights: ['Africa Market Intelligence', 'Fraud detection', 'PII detection', 'Anomaly ensemble'],
    data: mpesaData,
  },
  {
    id: 'healthcare',
    name: 'Healthcare Admissions',
    description: '50 patient admissions with departments, diagnoses, costs, and readmission flags',
    icon: 'HeartPulse',
    highlights: ['Clustering (K-Means)', 'Benchmark comparison', 'Readmission prediction', 'Cost analysis'],
    data: healthData,
  },
];

export function getSampleDataset(id: string): SampleDataset | undefined {
  return SAMPLE_DATASETS.find(d => d.id === id);
}
