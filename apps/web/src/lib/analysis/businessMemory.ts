/**
 * Business Memory — persistent metric definitions, filters, and corrections
 * that survive across sessions. This is the #1 driver of daily use vs.
 * one-time trial in the AI data analysis category.
 *
 * Based on the Brutally Honest Review recommendation:
 * "If Busara doesn't already persist approved metric definitions, filters,
 * and corrections across sessions, this is priority one"
 */

export interface MetricDefinition {
  id: string;
  name: string;
  column: string;
  definition: string;
  filters?: { column: string; operator: string; value: any }[];
  approvedAt: string;
  approvedBy: string;
}

export interface UserCorrection {
  id: string;
  agentId: string;
  originalOutput: string;
  correctedOutput: string;
  reason: string;
  createdAt: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  rule: string;
  appliesTo: string; // agent ID or 'global'
  createdAt: string;
}

export class BusinessMemory {
  private static METRICS_KEY = 'busara_metric_definitions';
  private static CORRECTIONS_KEY = 'busara_user_corrections';
  private static RULES_KEY = 'busara_business_rules';

  // ─── Metric Definitions ──────────────────────────────────────────
  static getMetrics(): MetricDefinition[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.METRICS_KEY) || '[]');
    } catch { return []; }
  }

  static saveMetric(metric: Omit<MetricDefinition, 'id' | 'approvedAt'>): MetricDefinition {
    const metrics = this.getMetrics();
    const newMetric: MetricDefinition = {
      ...metric,
      id: `metric-${Date.now()}`,
      approvedAt: new Date().toISOString(),
    };
    metrics.push(newMetric);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.METRICS_KEY, JSON.stringify(metrics));
    }
    return newMetric;
  }

  static deleteMetric(id: string): void {
    const metrics = this.getMetrics().filter(m => m.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.METRICS_KEY, JSON.stringify(metrics));
    }
  }

  static getMetricForColumn(column: string): MetricDefinition | null {
    return this.getMetrics().find(m => m.column === column) || null;
  }

  // ─── User Corrections ────────────────────────────────────────────
  static getCorrections(): UserCorrection[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.CORRECTIONS_KEY) || '[]');
    } catch { return []; }
  }

  static saveCorrection(correction: Omit<UserCorrection, 'id' | 'createdAt'>): UserCorrection {
    const corrections = this.getCorrections();
    const newCorrection: UserCorrection = {
      ...correction,
      id: `correction-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    corrections.unshift(newCorrection);
    if (corrections.length > 100) corrections.length = 100;
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.CORRECTIONS_KEY, JSON.stringify(corrections));
    }
    return newCorrection;
  }

  static getCorrectionsForAgent(agentId: string): UserCorrection[] {
    return this.getCorrections().filter(c => c.agentId === agentId);
  }

  // ─── Business Rules ──────────────────────────────────────────────
  static getRules(): BusinessRule[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.RULES_KEY) || '[]');
    } catch { return []; }
  }

  static saveRule(rule: Omit<BusinessRule, 'id' | 'createdAt'>): BusinessRule {
    const rules = this.getRules();
    const newRule: BusinessRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    rules.push(newRule);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.RULES_KEY, JSON.stringify(rules));
    }
    return newRule;
  }

  static deleteRule(id: string): void {
    const rules = this.getRules().filter(r => r.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.RULES_KEY, JSON.stringify(rules));
    }
  }

  static getRulesForAgent(agentId: string): BusinessRule[] {
    return this.getRules().filter(r => r.appliesTo === agentId || r.appliesTo === 'global');
  }

  // ─── Export/Import (for backup) ──────────────────────────────────
  static exportAll(): string {
    return JSON.stringify({
      metrics: this.getMetrics(),
      corrections: this.getCorrections(),
      rules: this.getRules(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  static importAll(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.metrics) localStorage.setItem(this.METRICS_KEY, JSON.stringify(data.metrics));
      if (data.corrections) localStorage.setItem(this.CORRECTIONS_KEY, JSON.stringify(data.corrections));
      if (data.rules) localStorage.setItem(this.RULES_KEY, JSON.stringify(data.rules));
      return true;
    } catch { return false; }
  }
}
