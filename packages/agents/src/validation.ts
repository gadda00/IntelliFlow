/**
 * Busara Agent Validation (Zod v4 compatible)
 * ===========================================
 * Provides schemas and helpers for validating agent inputs, outputs, and configs.
 *
 * Key Zod v4 changes:
 *  - `z.record(valueSchema)` is deprecated; use `z.record(z.string(), valueSchema)`.
 *  - `ZodError.errors` is removed; use `ZodError.issues`.
 *  - `z.enum` requires `readonly string[]`; for mixed-type enums use `z.union` with literals.
 */

import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
import type { AgentMetadata, AgentContext, AgentResult, AnalysisConfig, ID } from '@busara/core';
import { ValidationError } from './errors';

// ============================================================================
// Common Schemas
// ============================================================================

export const idSchema = z.string().min(1).max(255);
export const isoDateStringSchema = z.string().datetime();
export const timestampSchema = z.number().int().positive();
export const nonEmptyStringSchema = z.string().min(1);
export const optionalStringSchema = z.string().min(1).optional();
export const positiveNumberSchema = z.number().positive();
export const nonNegativeNumberSchema = z.number().nonnegative();
export const integerSchema = z.number().int();
export const booleanSchema = z.boolean();

/** Array schema with min length */
export function arraySchema<T extends ZodTypeAny>(schema: T, minLength = 1) {
  return z.array(schema).min(minLength);
}

/** Object schema with unknown keys (Zod v4: explicit key schema) */
export const unknownObjectSchema = z.record(z.string(), z.unknown());

export const anySchema = z.any();

// ============================================================================
// Agent Schemas
// ============================================================================

export const agentIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
export const agentNameSchema = z.string().min(1).max(100);
export const agentDescriptionSchema = z.string().min(1).max(500);
export const agentVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/);

export const agentStageSchema = z.enum([
  'ingest',
  'engineer',
  'detect',
  'forecast',
  'infer',
  'cluster',
  'report',
]);

export const agentTierSchema = z.enum([
  'core',
  'advanced',
  'specialized',
  'ml',
  'stats',
  'experimental',
]);

export const agentStabilitySchema = z.enum([
  'experimental',
  'beta',
  'stable',
  'deprecated',
]);

export const agentCapabilitySchema = z.string().min(1).max(50);
export const agentTagSchema = z.string().min(1).max(30);

/**
 * Agent metadata schema. Loosened to validate a subset of fields; full
 * AgentMetadata typing is enforced via the function return type.
 */
export const agentMetadataSchema = z.object({
  id: agentIdSchema,
  name: agentNameSchema,
  role: z.string().min(1).max(100).optional(),
  tier: agentTierSchema,
  stage: agentStageSchema,
  stageNumber: integerSchema.nonnegative(),
  description: agentDescriptionSchema,
  capabilities: arraySchema(agentCapabilitySchema),
  dependencies: arraySchema(agentIdSchema, 0),
  icon: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/),
  timeoutMs: positiveNumberSchema,
  version: agentVersionSchema.optional(),
  stability: agentStabilitySchema.optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  category: z.string().optional(),
  tags: arraySchema(agentTagSchema, 0).optional(),
  inputDescription: z.string().optional(),
  outputDescription: z.string().optional(),
}) as unknown as z.ZodType<AgentMetadata>;

// ============================================================================
// Analysis Config Schema
// ============================================================================

export const analysisConfigSchema = z.object({
  targetColumn: z.string().min(1).max(100).optional(),
  timeColumn: z.string().min(1).max(100).optional(),
  seasonLength: positiveNumberSchema.optional(),
  forecastHorizon: positiveNumberSchema.optional(),
  anomalyThreshold: z.number().min(0).max(1).optional(),
  clusterCount: positiveNumberSchema.optional(),
  nlqQuery: z.string().min(1).max(1000).optional(),
  objectives: arraySchema(z.string().min(1).max(100), 0).optional(),
  fileName: z.string().min(1).max(255).optional(),
  fileType: z.string().min(1).max(50).optional(),
  sensitivity: z.enum(['low', 'medium', 'high']).optional(),
  enabledAgents: arraySchema(z.string().min(1), 0).optional(),
  disabledAgents: arraySchema(z.string().min(1), 0).optional(),
  maxConcurrentAgents: positiveNumberSchema.optional(),
  useCache: z.boolean().optional(),
}) as unknown as z.ZodType<AnalysisConfig>;

// ============================================================================
// Agent Context Schema
// ============================================================================

export const agentContextSchema = z.object({
  analysisId: idSchema,
  analysisName: optionalStringSchema,
  dataframe: z.array(unknownObjectSchema),
  metadata: unknownObjectSchema,
  previousResults: z.any(),
  config: analysisConfigSchema,
  userId: optionalStringSchema,
  orgId: optionalStringSchema,
  startedAt: isoDateStringSchema,
}) as unknown as z.ZodType<AgentContext>;

// ============================================================================
// Agent Result Schema
// ============================================================================

export const agentResultSchema = z.object({
  agentId: agentIdSchema,
  agentName: agentNameSchema,
  status: z.enum([
    'idle',
    'pending',
    'running',
    'success',
    'failed',
    'skipped',
    'timeout',
    'cancelled',
  ]),
  output: anySchema,
  metrics: z.record(z.string(), z.number()),
  executionTimeMs: nonNegativeNumberSchema,
  error: optionalStringSchema,
  errorStack: optionalStringSchema,
  timestamp: isoDateStringSchema,
  startedAt: isoDateStringSchema.optional(),
  completedAt: isoDateStringSchema.optional(),
  attempt: positiveNumberSchema.optional(),
  cached: z.boolean().optional(),
  cacheKey: optionalStringSchema,
}) as unknown as z.ZodType<AgentResult>;

// ============================================================================
// Validation Functions
// ============================================================================

/** Extract human-readable error messages from a ZodError (Zod v4 compatible). */
function extractErrorMessages(error: z.ZodError): string[] {
  const issues = (error as unknown as { issues?: Array<{ path?: PropertyKey[]; message?: string }> }).issues ?? [];
  return issues.map((e) => {
    const path = (e.path ?? []).join('.');
    return path ? `${path}: ${e.message ?? 'invalid'}` : (e.message ?? 'invalid');
  });
}

/** Validate data against a schema */
export function validate<T>(
  data: unknown,
  schema: z.ZodType<T>,
): { valid: boolean; data?: T; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data, errors: [] };
  }
  return { valid: false, errors: extractErrorMessages(result.error) };
}

/** Validate and throw on error */
export function validateOrThrow<T>(
  data: unknown,
  schema: z.ZodType<T>,
  context?: Record<string, unknown>,
): T {
  const result = validate(data, schema);
  if (!result.valid) {
    throw new ValidationError(
      `Validation failed: ${result.errors.join(', ')}`,
      undefined,
      data,
      undefined,
      context,
    );
  }
  return result.data as T;
}

/** Validate agent metadata */
export function validateAgentMetadata(
  metadata: unknown,
): { valid: boolean; metadata?: AgentMetadata; errors: string[] } {
  const result = validate(metadata, agentMetadataSchema);
  return result.valid
    ? { valid: true, metadata: result.data, errors: [] }
    : { valid: false, errors: result.errors };
}

/** Validate analysis config */
export function validateAnalysisConfig(
  config: unknown,
): { valid: boolean; config?: AnalysisConfig; errors: string[] } {
  const result = validate(config, analysisConfigSchema);
  return result.valid
    ? { valid: true, config: result.data, errors: [] }
    : { valid: false, errors: result.errors };
}

/** Validate agent context */
export function validateAgentContext(
  ctx: unknown,
): { valid: boolean; context?: AgentContext; errors: string[] } {
  const result = validate(ctx, agentContextSchema);
  return result.valid
    ? { valid: true, context: result.data, errors: [] }
    : { valid: false, errors: result.errors };
}

/** Validate agent result */
export function validateAgentResult(
  value: unknown,
): { valid: boolean; result?: AgentResult; errors: string[] } {
  const result = validate(value, agentResultSchema);
  return result.valid
    ? { valid: true, result: result.data, errors: [] }
    : { valid: false, errors: result.errors };
}

// ============================================================================
// Custom Validators
// ============================================================================

export function nonEmptyArray<T extends ZodTypeAny>(schema: T) {
  return z.array(schema).min(1);
}

export const urlSchema = z.string().url();
export const emailSchema = z.string().email();
export const uuidSchema = z.string().uuid();
export const cuidSchema = z.string().regex(/^c[^\s-]{8,}$/i);

export function rangeSchema(min: number, max: number) {
  return z.number().min(min).max(max);
}

export function stringLengthSchema(min: number, max: number) {
  return z.string().min(min).max(max);
}

export function patternSchema(pattern: RegExp) {
  return z.string().regex(pattern);
}

/** Create an enum schema from a list of string values (Zod v4 compatible). */
export function enumSchema<T extends string>(values: readonly T[]) {
  return z.enum(values as [T, ...T[]]);
}

// ============================================================================
// Schema Builders
// ============================================================================

export function paginatedSchema<T extends ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      page: positiveNumberSchema,
      pageSize: positiveNumberSchema,
      total: nonNegativeNumberSchema,
      totalPages: nonNegativeNumberSchema,
      hasNextPage: booleanSchema,
      hasPrevPage: booleanSchema,
    }),
  });
}

export function apiResponseSchema<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    status: z.enum(['success', 'error', 'validation_error']),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: unknownObjectSchema.optional(),
        stack: optionalStringSchema,
      })
      .optional(),
    meta: z
      .object({
        requestId: z.string(),
        timestamp: isoDateStringSchema,
        durationMs: nonNegativeNumberSchema,
        version: z.string(),
      })
      .optional(),
  });
}

export function dataframeSchema(rowSchema?: ZodTypeAny) {
  const schema = rowSchema ?? unknownObjectSchema;
  return z.array(schema);
}

export const numericColumnSchema = z.array(z.number());
export const categoricalColumnSchema = z.array(z.string());
export const datetimeColumnSchema = z.array(isoDateStringSchema);

// ============================================================================
// Validation Helpers
// ============================================================================

export function isValidId(value: unknown): value is ID {
  return idSchema.safeParse(value).success;
}
export function isValidISODateString(value: unknown): value is string {
  return isoDateStringSchema.safeParse(value).success;
}
export function isValidTimestamp(value: unknown): value is number {
  return timestampSchema.safeParse(value).success;
}
export function isPositiveNumber(value: unknown): value is number {
  return positiveNumberSchema.safeParse(value).success;
}
export function isNonNegativeNumber(value: unknown): value is number {
  return nonNegativeNumberSchema.safeParse(value).success;
}
export function isInteger(value: unknown): value is number {
  return integerSchema.safeParse(value).success;
}
export function isBoolean(value: unknown): value is boolean {
  return booleanSchema.safeParse(value).success;
}
export function isNonEmptyString(value: unknown): value is string {
  return nonEmptyStringSchema.safeParse(value).success;
}
export function isArray(value: unknown): value is unknown[] {
  return z.array(z.unknown()).safeParse(value).success;
}
export function isObject(value: unknown): value is Record<string, unknown> {
  return unknownObjectSchema.safeParse(value).success;
}

// ============================================================================
// Re-exports (type-only for isolatedModules compatibility)
// ============================================================================

export type { z, ZodTypeAny };
