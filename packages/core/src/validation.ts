/**
 * Busara Core - Validation Schemas (Zod v4 compatible)
 * =====================================================
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const idSchema = z.string().min(1);
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const isoDateSchema = z.string().datetime();
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

// ============================================================================
// Agent Schemas
// ============================================================================

export const agentStageSchema = z.enum(['ingest', 'engineer', 'detect', 'forecast', 'infer', 'cluster', 'report']);
export const agentTierSchema = z.enum(['core', 'advanced', 'specialized', 'ml', 'stats', 'experimental']);
export const agentStabilitySchema = z.enum(['experimental', 'beta', 'stable', 'deprecated']);
export const agentStatusSchema = z.enum([
  'idle',
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
  'timeout',
  'cancelled',
]);

export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).default(3),
  baseDelayMs: z.number().int().min(0).default(1000),
  maxDelayMs: z.number().int().min(0).default(30000),
  backoffMultiplier: z.number().positive().default(2),
  retryableErrors: z.array(z.string()).default([]),
});

export const agentMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  version: z.string(),
  stage: agentStageSchema,
  stageNumber: z.number().int().min(0),
  tier: agentTierSchema,
  stability: agentStabilitySchema,
  author: z.string(),
  license: z.string(),
  repository: z.string().url().optional(),
  dependencies: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().default(30000),
  retryPolicy: retryPolicySchema.optional(),
  capabilities: z.array(z.string()).default([]),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  inputDescription: z.string(),
  outputDescription: z.string(),
  documentationUrl: z.string().url().optional(),
  memoryLimit: z.string().optional(),
  cpuLimit: z.string().optional(),
  gpuRequired: z.boolean().default(false),
  icon: z.string(),
  color: z.string(),
});

// ============================================================================
// Analysis Schemas
// ============================================================================

export const analysisConfigSchema = z.object({
  targetColumn: z.string().optional(),
  timeColumn: z.string().optional(),
  seasonLength: z.number().int().positive().optional(),
  forecastHorizon: z.number().int().positive().optional(),
  anomalyThreshold: z.number().min(0).max(1).optional(),
  clusterCount: z.number().int().positive().optional(),
  nlqQuery: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  sensitivity: z.enum(['low', 'medium', 'high']).optional(),
  enabledAgents: z.array(z.string()).optional(),
  disabledAgents: z.array(z.string()).optional(),
  maxConcurrentAgents: z.number().int().positive().optional(),
  useCache: z.boolean().optional(),
});

export const analysisStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'timeout',
]);

// ============================================================================
// Auth Schemas
// ============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});

export const apiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: isoDateSchema.optional(),
  permissions: z.array(z.string()).default([]),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parse with Zod and return a structured result.
 * Works with Zod v4's `{ success, data, error }` shape.
 */
export function safeParse<T>(schema: z.ZodType<T>, value: unknown):
  | { success: true; data: T }
  | { success: false; error: { field: string; message: string }[] } {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Zod v4 uses `issues` (v3 also supports `issues` alongside `errors`)
  const issues = (result.error as z.ZodError).issues ?? (result.error as any).errors ?? [];
  return {
    success: false,
    error: issues.map((issue: any) => ({
      field: issue.path?.join('.') ?? '',
      message: issue.message,
    })),
  };
}

/** Assert that a value matches a schema, throwing ValidationError on failure. */
export function assertSchema<T>(schema: z.ZodType<T>, value: unknown, label = 'input'): T {
  const result = safeParse(schema, value);
  if (!result.success) {
    const errors = (result as { error: Array<{ field: string; message: string }> }).error;
    throw new Error(`Validation failed for ${label}: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`);
  }
  return (result as { data: T }).data;
}

/**
 * Coerce a record's value with explicit key/value schemas (Zod v4 compatible).
 * In Zod v4, `z.record(valueSchema)` is deprecated; use `z.record(keySchema, valueSchema)` instead.
 */
export function recordSchema<V extends z.ZodTypeAny>(value: V) {
  return z.record(z.string(), value);
}

/**
 * Coerce a record's value with explicit key/value schemas (Zod v4 compatible).
 * Accepts a key schema (must be string/number/symbol-typed) and value schema.
 */
export function keyedRecordSchema<K extends z.ZodType<string | number | symbol>, V extends z.ZodTypeAny>(
  key: K,
  value: V,
) {
  return z.record(key, value);
}
