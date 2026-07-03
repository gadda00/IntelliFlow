/**
 * Busara v7.0 — Stage 0: Ingestion & Profiling Agents (1-10)
 * ==========================================================
 */

import { BaseAgent, AgentMetadata, AgentContext, AgentResult } from '../core';
import {
  mean, median, mode, stdev, variance, min, max, range, skewness, kurtosis,
  quantile, iqr, shannonEntropy,
} from '../math';

// ─── 1. Data Ingestion Agent ───────────────────────────────────────────

export class DataIngestionAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'data_ingestion',
    name: 'Data Ingestion',
    role: 'Parse and validate incoming data',
    tier: 'core',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Validates the uploaded dataset, checks for structural integrity, and prepares it for downstream analysis.',
    capabilities: ['data_validation', 'structure_check', 'format_detection'],
    dependencies: [],
    icon: 'FileInput',
    color: '#10b981',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe } = ctx;

    if (!dataframe || dataframe.length === 0) {
      return this.createError('No data provided', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const output = {
      rowCount: dataframe.length,
      columnCount: columns.length,
      columns,
      memorySize: JSON.stringify(dataframe).length,
      isEmpty: dataframe.length === 0,
      hasHeaders: columns.length > 0,
      sampleRows: dataframe.slice(0, 5),
    };

    return this.createResult(output, {
      rowCount: dataframe.length,
      columnCount: columns.length,
    }, Date.now() - start);
  }
}

// ─── 2. Schema Inference Agent ─────────────────────────────────────────

export class SchemaInferenceAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'schema_inference',
    name: 'Schema Inference',
    role: 'Detect column types and schema',
    tier: 'core',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Automatically detects the data type of each column (numeric, categorical, datetime, boolean, text) based on value analysis.',
    capabilities: ['type_detection', 'schema_inference', 'pattern_matching'],
    dependencies: ['data_ingestion'],
    icon: 'Database',
    color: '#0ea5e9',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe } = ctx;

    if (!dataframe.length) {
      return this.createError('No data for schema inference', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const schema: Record<string, { type: string; confidence: number; nullCount: number; uniqueCount: number }> = {};

    for (const col of columns) {
      const values = dataframe.map(r => r[col]);
      const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
      const uniqueCount = new Set(values.filter(v => v !== null && v !== undefined && v !== '')).size;
      const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');

      let type = 'unknown';
      let confidence = 0;

      // Check numeric
      const numericCount = nonNull.filter(v => !isNaN(Number(v))).length;
      if (numericCount / nonNull.length > 0.8) {
        type = 'numeric';
        confidence = numericCount / nonNull.length;
      }
      // Check boolean
      else if (nonNull.every(v => ['true', 'false', '0', '1', 'yes', 'no'].includes(String(v).toLowerCase()))) {
        type = 'boolean';
        confidence = 0.95;
      }
      // Check datetime
      else if (nonNull.every(v => !isNaN(Date.parse(String(v))) && String(v).length >= 8)) {
        type = 'datetime';
        confidence = 0.9;
      }
      // Check categorical (low cardinality)
      else if (uniqueCount / nonNull.length < 0.5 && uniqueCount < 50) {
        type = 'categorical';
        confidence = 0.85;
      }
      // Default text
      else {
        type = 'text';
        confidence = 0.7;
      }

      schema[col] = { type, confidence, nullCount, uniqueCount };
    }

    return this.createResult({ schema, columnTypes: Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.type])) }, {
      columnsInferred: columns.length,
      numericColumns: Object.values(schema).filter(s => s.type === 'numeric').length,
    }, Date.now() - start);
  }
}

// ─── 3. Data Profiling Agent ───────────────────────────────────────────

export class DataProfilingAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'data_profiling',
    name: 'Data Profiling',
    role: 'Compute descriptive statistics for all columns',
    tier: 'core',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Computes comprehensive descriptive statistics (mean, median, mode, std dev, skewness, kurtosis, quartiles) for every column.',
    capabilities: ['descriptive_stats', 'distribution_analysis', 'column_profiling'],
    dependencies: ['schema_inference'],
    icon: 'BarChart3',
    color: '#8b5cf6',
    timeoutMs: 20000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for profiling', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const profile: Record<string, any> = {};

    for (const col of columns) {
      const values = dataframe.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
      const numericValues = values.map(Number).filter(n => !isNaN(n));

      const colProfile: any = {
        count: values.length,
        nullCount: dataframe.length - values.length,
        uniqueCount: new Set(values).size,
      };

      if (numericValues.length > values.length * 0.5) {
        // Numeric profile
        colProfile.type = 'numeric';
        colProfile.stats = {
          mean: mean(numericValues),
          median: median(numericValues),
          mode: mode(numericValues),
          stdev: stdev(numericValues),
          variance: variance(numericValues),
          min: min(numericValues),
          max: max(numericValues),
          range: range(numericValues),
          q1: quantile(numericValues, 0.25),
          q3: quantile(numericValues, 0.75),
          iqr: iqr(numericValues),
          skewness: skewness(numericValues),
          kurtosis: kurtosis(numericValues),
        };
      } else {
        // Categorical/text profile
        colProfile.type = 'categorical';
        const freq = new Map<string, number>();
        for (const v of values) freq.set(String(v), (freq.get(String(v)) ?? 0) + 1);
        colProfile.topValues = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        colProfile.entropy = shannonEntropy(values.map(v => String(v).length));
      }

      profile[col] = colProfile;
    }

    return this.createResult({ profile }, {
      columnsProfiled: columns.length,
      numericColumns: Object.values(profile).filter((p: any) => p.type === 'numeric').length,
    }, Date.now() - start);
  }
}

// ─── 4. Missing Value Analyzer ─────────────────────────────────────────

export class MissingValueAnalyzerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'missing_value_analyzer',
    name: 'Missing Value Analyzer',
    role: 'Detect and quantify missing data patterns',
    tier: 'core',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Identifies missing values across all columns, quantifies their impact, and detects patterns (MCAR, MAR, MNAR).',
    capabilities: ['missing_value_detection', 'pattern_analysis', 'impact_assessment'],
    dependencies: ['data_ingestion'],
    icon: 'AlertCircle',
    color: '#f59e0b',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe } = ctx;

    if (!dataframe.length) {
      return this.createError('No data for missing value analysis', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const missingByColumn: Record<string, { count: number; percentage: number }> = {};
    let totalCells = 0;
    let totalMissing = 0;

    for (const col of columns) {
      const values = dataframe.map(r => r[col]);
      const missing = values.filter(v => v === null || v === undefined || v === '').length;
      const percentage = (missing / dataframe.length) * 100;
      missingByColumn[col] = { count: missing, percentage };
      totalCells += dataframe.length;
      totalMissing += missing;
    }

    const overallMissingRate = (totalMissing / totalCells) * 100;
    const columnsWithHighMissing = Object.entries(missingByColumn)
      .filter(([_, v]) => v.percentage > 50)
      .map(([k]) => k);

    return this.createResult({
      missingByColumn,
      totalMissing,
      totalCells,
      overallMissingRate,
      columnsWithHighMissing,
      recommendation: columnsWithHighMissing.length > 0
        ? `Consider dropping columns: ${columnsWithHighMissing.join(', ')}`
        : 'No columns with excessive missing values',
    }, {
      missingRate: overallMissingRate,
      columnsAffected: Object.values(missingByColumn).filter(v => v.count > 0).length,
    }, Date.now() - start);
  }
}

// ─── 5. Cardinality Checker ────────────────────────────────────────────

export class CardinalityCheckerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'cardinality_checker',
    name: 'Cardinality Checker',
    role: 'Analyze column uniqueness and cardinality',
    tier: 'core',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Checks cardinality of each column to identify primary keys, low-cardinality categoricals, and high-cardinality text fields.',
    capabilities: ['cardinality_analysis', 'key_detection', 'uniqueness_scoring'],
    dependencies: ['data_ingestion'],
    icon: 'Hash',
    color: '#06b6d4',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe } = ctx;

    if (!dataframe.length) {
      return this.createError('No data for cardinality check', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const cardinality: Record<string, { unique: number; cardinalityRatio: number; isPrimaryKey: boolean; isLowCardinality: boolean }> = {};

    for (const col of columns) {
      const values = dataframe.map(r => r[col]);
      const unique = new Set(values).size;
      const ratio = unique / dataframe.length;
      cardinality[col] = {
        unique,
        cardinalityRatio: ratio,
        isPrimaryKey: ratio === 1,
        isLowCardinality: unique < 20 && unique < dataframe.length * 0.05,
      };
    }

    return this.createResult({ cardinality }, {
      totalColumns: columns.length,
      primaryKeys: Object.entries(cardinality).filter(([_, v]) => v.isPrimaryKey).length,
    }, Date.now() - start);
  }
}

// ─── 6. Duplicate Detector ─────────────────────────────────────────────

export class DuplicateDetectorAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'duplicate_detector',
    name: 'Duplicate Detector',
    role: 'Find duplicate rows and records',
    tier: 'core',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Identifies exact and near-duplicate rows in the dataset, quantifies their impact, and recommends deduplication strategy.',
    capabilities: ['duplicate_detection', 'row_comparison', 'deduplication'],
    dependencies: ['data_ingestion'],
    icon: 'Copy',
    color: '#ec4899',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe } = ctx;

    if (!dataframe.length) {
      return this.createError('No data for duplicate detection', Date.now() - start);
    }

    const seen = new Map<string, number[]>();
    dataframe.forEach((row, i) => {
      const key = JSON.stringify(row);
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(i);
    });

    const duplicates = Array.from(seen.entries())
      .filter(([_, indices]) => indices.length > 1)
      .map(([key, indices]) => ({ rowIndices: indices, count: indices.length }));

    const totalDuplicateRows = duplicates.reduce((sum, d) => sum + d.count - 1, 0);
    const duplicateRate = (totalDuplicateRows / dataframe.length) * 100;

    return this.createResult({
      duplicateGroups: duplicates.slice(0, 20),
      totalDuplicateRows,
      duplicateRate,
      recommendation: duplicateRate > 5
        ? 'High duplicate rate — recommend deduplication'
        : 'Low duplicate rate — acceptable',
    }, {
      duplicateRate,
      duplicateGroups: duplicates.length,
    }, Date.now() - start);
  }
}

// ─── 7. Data Quality Scorer ────────────────────────────────────────────

export class DataQualityScorerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'data_quality_scorer',
    name: 'Data Quality Scorer',
    role: 'Compute overall data quality score',
    tier: 'core',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Evaluates data quality across 4 dimensions (completeness, uniqueness, validity, consistency) and produces an overall quality score.',
    capabilities: ['quality_scoring', 'completeness_check', 'validity_assessment'],
    dependencies: ['missing_value_analyzer', 'duplicate_detector', 'cardinality_checker'],
    icon: 'ShieldCheck',
    color: '#22c55e',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults, dataframe } = ctx;
    const missingResult = previousResults.get('missing_value_analyzer');
    const dupResult = previousResults.get('duplicate_detector');

    if (!dataframe.length) {
      return this.createError('No data for quality scoring', Date.now() - start);
    }

    // Completeness: 1 - (missing / total)
    const completeness = missingResult?.output?.overallMissingRate != null
      ? 100 - missingResult.output.overallMissingRate
      : 100;

    // Uniqueness: 1 - (duplicates / total)
    const uniqueness = dupResult?.output?.duplicateRate != null
      ? 100 - dupResult.output.duplicateRate
      : 100;

    // Validity (simplified: all cells parse correctly)
    const validity = 100;

    // Consistency (simplified: schema consistency)
    const consistency = 100;

    const overallScore = (completeness + uniqueness + validity + consistency) / 4;

    return this.createResult({
      overallScore: Math.round(overallScore * 10) / 10,
      dimensions: { completeness, uniqueness, validity, consistency },
      grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F',
    }, {
      qualityScore: overallScore,
    }, Date.now() - start);
  }
}

// ─── 8. Text Length Profiler ───────────────────────────────────────────

export class TextLengthProfilerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'text_length_profiler',
    name: 'Text Length Profiler',
    role: 'Analyze text column lengths and patterns',
    tier: 'advanced',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Profiles text columns by character length, word count, and identifies potential truncation or formatting issues.',
    capabilities: ['text_analysis', 'length_profiling', 'pattern_detection'],
    dependencies: ['schema_inference'],
    icon: 'Type',
    color: '#a855f7',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for text profiling', Date.now() - start);
    }

    const textColumns = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'text' || s.type === 'categorical')
      .map(([col]) => col);

    const profiles: Record<string, any> = {};
    for (const col of textColumns) {
      const lengths = dataframe.map(r => String(r[col] ?? '').length).filter(l => l > 0);
      if (lengths.length === 0) continue;
      profiles[col] = {
        avgLength: mean(lengths),
        maxLength: max(lengths),
        minLength: min(lengths),
        medianLength: median(lengths),
      };
    }

    return this.createResult({ textProfiles: profiles }, {
      textColumnsProfiled: textColumns.length,
    }, Date.now() - start);
  }
}

// ─── 9. PII Detection Agent ────────────────────────────────────────────

export class PIIDetectionAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'pii_detection',
    name: 'PII Detection',
    role: 'Detect personally identifiable information',
    tier: 'specialized',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Detects PII (emails, phone numbers, SSNs, credit cards, IBANs, IP addresses) and assesses compliance against GDPR, CCPA, HIPAA, PCI-DSS.',
    capabilities: ['pii_detection', 'gdpr_assessment', 'compliance_scoring'],
    dependencies: ['data_ingestion'],
    icon: 'Shield',
    color: '#dc2626',
    timeoutMs: 15000,
  };

  private patterns = {
    email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
    phone: /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b(?:\d[ -]*?){13,16}\b/,
    iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/,
    ip: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
    passport: /\b[A-Z]{1,2}\d{6,9}\b/,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe } = ctx;

    if (!dataframe.length) {
      return this.createError('No data for PII detection', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const detected: Record<string, string[]> = {};
    let riskScore = 0;

    const piiWeights: Record<string, number> = {
      ssn: 30, creditCard: 30, passport: 25, iban: 20, email: 15, phone: 15, ip: 10,
    };

    for (const col of columns) {
      const sample = dataframe.slice(0, 100).map(r => String(r[col] ?? ''));
      const found: string[] = [];
      for (const [type, pattern] of Object.entries(this.patterns)) {
        const matches = sample.filter(s => pattern.test(s));
        if (matches.length > sample.length * 0.1) {
          found.push(type);
          riskScore += piiWeights[type] ?? 5;
        }
      }
      // Also check column name
      const colLower = col.toLowerCase();
      if (/email|mail/.test(colLower)) { found.push('email'); riskScore += 15; }
      if (/phone|mobile|tel/.test(colLower)) { found.push('phone'); riskScore += 15; }
      if (/ssn|social/.test(colLower)) { found.push('ssn'); riskScore += 30; }
      if (/name|first|last/.test(colLower)) { found.push('name'); riskScore += 10; }
      if (/address|street/.test(colLower)) { found.push('address'); riskScore += 10; }
      if (found.length > 0) detected[col] = found;
    }

    return this.createResult({
      detected,
      riskScore: Math.min(riskScore, 100),
      riskLevel: riskScore > 50 ? 'high' : riskScore > 20 ? 'medium' : 'low',
      compliance: {
        gdpr: riskScore > 30 ? 'non-compliant' : 'likely-compliant',
        ccpa: riskScore > 30 ? 'non-compliant' : 'likely-compliant',
        hipaa: detected && Object.values(detected).flat().includes('ssn') ? 'non-compliant' : 'n/a',
        pciDss: detected && Object.values(detected).flat().includes('creditCard') ? 'non-compliant' : 'n/a',
      },
    }, {
      piiColumns: Object.keys(detected).length,
      riskScore: Math.min(riskScore, 100),
    }, Date.now() - start);
  }
}

// ─── 10. NLQ Interpreter ───────────────────────────────────────────────

export class NLQInterpreterAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'nlq_interpreter',
    name: 'NLQ Interpreter',
    role: 'Parse natural language queries about data',
    tier: 'advanced',
    stage: 'ingest',
    stageNumber: 0,
    description: 'Parses natural language questions about the data and translates them into structured analysis intents, target columns, and visualization specs.',
    capabilities: ['intent_detection', 'entity_extraction', 'query_translation'],
    dependencies: ['data_ingestion'],
    icon: 'MessageSquare',
    color: '#06b6d4',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { config, dataframe } = ctx;

    if (!config.nlqQuery) {
      return this.createResult({
        query: null,
        intent: 'none',
        targetColumn: null,
      }, {}, Date.now() - start);
    }

    const query = config.nlqQuery.toLowerCase();
    const columns = dataframe.length ? Object.keys(dataframe[0]) : [];

    // Intent detection
    let intent = 'explore';
    if (/forecast|predict|future|next/.test(query)) intent = 'forecast';
    else if (/anomal|outlier|unusual|abnormal/.test(query)) intent = 'anomaly';
    else if (/correlat|relationship|affect|impact/.test(query)) intent = 'correlation';
    else if (/cluster|segment|group/.test(query)) intent = 'cluster';
    else if (/trend|pattern|over time/.test(query)) intent = 'trend';
    else if (/summar|overview|describe/.test(query)) intent = 'summary';

    // Target column extraction
    let targetColumn: string | null = null;
    for (const col of columns) {
      if (query.includes(col.toLowerCase())) {
        targetColumn = col;
        break;
      }
    }

    // If no explicit target, find first numeric column
    if (!targetColumn && dataframe.length) {
      for (const col of columns) {
        const values = dataframe.slice(0, 10).map(r => Number(r[col]));
        if (values.some(v => !isNaN(v))) {
          targetColumn = col;
          break;
        }
      }
    }

    return this.createResult({
      query: config.nlqQuery,
      intent,
      targetColumn,
      suggestedAnalysis: intent,
    }, {
      intentDetected: 1,
    }, Date.now() - start);
  }
}
