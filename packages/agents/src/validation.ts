/**
 * Busara Agent Validation
 * =======================
 * 
 * Validation utilities for agent inputs, outputs, and configurations.
 * Uses Zod for schema validation with custom validators.
 */

import { z, ZodSchema, ZodError, ZodIssue } from 'zod';
import {
  AgentMetadata,
  AgentContext,
  AgentResult,
  AnalysisConfig,
  ID,
} from '@busara/core';
import { ValidationError } from './errors';

// ============================================================================
// Common Schemas
// ============================================================================

/** ID schema */
export const idSchema = z.string().min(1).max(255);

/** ISO date string schema */
export const isoDateStringSchema = z.string().datetime();

/** Timestamp schema */
export const timestampSchema = z.number().int().positive();

/** Non-empty string schema */
export const nonEmptyStringSchema = z.string().min(1);

/** Optional string schema */
export const optionalStringSchema = z.string().min(1).optional();

/** Positive number schema */
export const positiveNumberSchema = z.number().positive();

/** Non-negative number schema */
export const nonNegativeNumberSchema = z.number().nonnegative();

/** Integer schema */
export const integerSchema = z.number().int();

/** Boolean schema */
export const booleanSchema = z.boolean();

/** Array schema with min length */
export function arraySchema<T>(schema: ZodSchema<T>, minLength: number = 1) {
  return z.array(schema).min(minLength);
}

/** Object schema with unknown keys */
export const unknownObjectSchema = z.record(z.unknown());

/** Any schema */
export const anySchema = z.any();

// ============================================================================
// Agent Schemas
// ============================================================================

/** Agent ID schema */
export const agentIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/);

/** Agent name schema */
export const agentNameSchema = z.string().min(1).max(100);

/** Agent description schema */
export const agentDescriptionSchema = z.string().min(1).max(500);

/** Agent version schema */
export const agentVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/);

/** Agent stage schema */
export const agentStageSchema = z.enum([
  'ingest',
  'engineer',
  'detect',
  'forecast',
  'infer',
  'cluster',
  'report',
]);

/** Agent tier schema */
export const agentTierSchema = z.enum([
  'core',
  'advanced',
  'specialized',
  'ml',
  'stats',
  'experimental',
]);

/** Agent stability schema */
export const agentStabilitySchema = z.enum([
  'experimental',
  'beta',
  'stable',
  'deprecated',
]);

/** Agent capability schema */
export const agentCapabilitySchema = z.string().min(1).max(50);

/** Agent tag schema */
export const agentTagSchema = z.string().min(1).max(30);

/** Agent metadata schema */
export const agentMetadataSchema: ZodSchema<AgentMetadata> = z.object({
  id: agentIdSchema,
  name: agentNameSchema,
  role: z.string().min(1).max(100),
  tier: agentTierSchema,
  stage: agentStageSchema,
  stageNumber: integerSchema.nonnegative(),
  description: agentDescriptionSchema,
  capabilities: arraySchema(agentCapabilitySchema),
  dependencies: arraySchema(agentIdSchema, 0),
  icon: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/),
  timeoutMs: positiveNumberSchema,
});

// ============================================================================
// Analysis Config Schema
// ============================================================================

/** Analysis config schema */
export const analysisConfigSchema: ZodSchema<AnalysisConfig> = z.object({
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
});

// ============================================================================
// Agent Context Schema
// ============================================================================

/** Agent context schema */
export const agentContextSchema: ZodSchema<AgentContext> = z.object({
  analysisId: idSchema,
  analysisName: optionalStringSchema,
  dataframe: z.array(unknownObjectSchema),
  metadata: unknownObjectSchema,
  previousResults: z.instanceof(Map),
  config: analysisConfigSchema,
  userId: optionalStringSchema,
  orgId: optionalStringSchema,
  startedAt: isoDateStringSchema,
});

// ============================================================================
// Agent Result Schema
// ============================================================================

/** Agent result schema */
export const agentResultSchema: ZodSchema<AgentResult> = z.object({
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
  metrics: unknownObjectSchema,
  executionTimeMs: nonNegativeNumberSchema,
  error: optionalStringSchema,
  errorStack: optionalStringSchema,
  timestamp: isoDateStringSchema,
  startedAt: isoDateStringSchema.optional(),
  completedAt: isoDateStringSchema.optional(),
  attempt: positiveNumberSchema.optional(),
  cached: z.boolean().optional(),
  cacheKey: optionalStringSchema,
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate data against a schema
 */
export function validate<T>(
  data: unknown,
  schema: ZodSchema<T>
): { valid: boolean; data?: T; errors: ZodIssue[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data, errors: [] };
  }
  
  return { valid: false, errors: result.error.errors };
}

/**
 * Validate and throw on error
 */
export function validateOrThrow<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context?: Record<string, unknown>
): T {
  const result = validate(data, schema);
  
  if (!result.valid) {
    const errorMessages = result.errors.map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    });
    
    throw new ValidationError(
      `Validation failed: ${errorMessages.join(', ')}`,
      undefined,
      data,
      undefined,
      context
    );
  }
  
  return result.data!;
}

/**
 * Validate agent metadata
 */
export function validateAgentMetadata(
  metadata: unknown
): { valid: boolean; metadata?: AgentMetadata; errors: string[] } {
  const result = agentMetadataSchema.safeParse(metadata);
  
  if (result.success) {
    return { valid: true, metadata: result.data, errors: [] };
  }
  
  return {
    valid: false,
    errors: result.error.errors.map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    }),
  };
}

/**
 * Validate analysis config
 */
export function validateAnalysisConfig(
  config: unknown
): { valid: boolean; config?: AnalysisConfig; errors: string[] } {
  const result = analysisConfigSchema.safeParse(config);
  
  if (result.success) {
    return { valid: true, config: result.data, errors: [] };
  }
  
  return {
    valid: false,
    errors: result.error.errors.map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    }),
  };
}

/**
 * Validate agent context
 */
export function validateAgentContext(
  context: unknown
): { valid: boolean; context?: AgentContext; errors: string[] } {
  const result = agentContextSchema.safeParse(context);
  
  if (result.success) {
    return { valid: true, context: result.data, errors: [] };
  }
  
  return {
    valid: false,
    errors: result.error.errors.map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    }),
  };
}

/**
 * Validate agent result
 */
export function validateAgentResult(
  result: unknown
): { valid: boolean; result?: AgentResult; errors: string[] } {
  const resultSchema = agentResultSchema.safeParse(result);
  
  if (resultSchema.success) {
    return { valid: true, result: resultSchema.data, errors: [] };
  }
  
  return {
    valid: false,
    errors: resultSchema.error.errors.map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    }),
  };
}

// ============================================================================
// Custom Validators
// ============================================================================

/**
 * Create a schema that validates an array is not empty
 */
export function nonEmptyArray<T>(schema: ZodSchema<T>) {
  return z.array(schema).min(1);
}

/**
 * Create a schema that validates a string is a valid URL
 */
export const urlSchema = z.string().url();

/**
 * Create a schema that validates a string is a valid email
 */
export const emailSchema = z.string().email();

/**
 * Create a schema that validates a string is a valid UUID
 */
export const uuidSchema = z.string().uuid();

/**
 * Create a schema that validates a string is a valid CUID
 */
export const cuidSchema = z.string().regex(/^c[^\s-]{8,}$/i);

/**
 * Create a schema that validates a number is within a range
 */
export function rangeSchema(min: number, max: number) {
  return z.number().min(min).max(max);
}

/**
 * Create a schema that validates a string has a minimum and maximum length
 */
export function stringLengthSchema(min: number, max: number) {
  return z.string().min(min).max(max);
}

/**
 * Create a schema that validates a string matches a regex pattern
 */
export function patternSchema(pattern: RegExp) {
  return z.string().regex(pattern);
}

/**
 * Create a schema that validates a value is one of the allowed values
 */
export function enumSchema<T extends string | number>(values: T[]) {
  return z.enum(values as [T, ...T[]]);
}

// ============================================================================
// Schema Builders
// ============================================================================

/**
 * Create a schema for a paginated response
 */
export function paginatedSchema<T>(itemSchema: ZodSchema<T>) {
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

/**
 * Create a schema for an API response
 */
export function apiResponseSchema<T>(dataSchema: ZodSchema<T>) {
  return z.object({
    status: z.enum(['success', 'error', 'validation_error']),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: unknownObjectSchema.optional(),
      stack: optionalStringSchema,
    }).optional(),
    meta: z.object({
      requestId: z.string(),
      timestamp: isoDateStringSchema,
      durationMs: nonNegativeNumberSchema,
      version: z.string(),
    }).optional(),
  });
}

/**
 * Create a schema for a data frame (array of objects)
 */
export function dataframeSchema(rowSchema?: ZodSchema) {
  const schema = rowSchema ?? unknownObjectSchema;
  return z.array(schema);
}

/**
 * Create a schema for a numeric column
 */
export const numericColumnSchema = z.array(z.number());

/**
 * Create a schema for a categorical column
 */
export const categoricalColumnSchema = z.array(z.string());

/**
 * Create a schema for a datetime column
 */
export const datetimeColumnSchema = z.array(isoDateStringSchema);

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a value is a valid ID
 */
export function isValidId(value: unknown): value is ID {
  return idSchema.safeParse(value).success;
}

/**
 * Check if a value is a valid ISO date string
 */
export function isValidISODateString(value: unknown): value is string {
  return isoDateStringSchema.safeParse(value).success;
}

/**
 * Check if a value is a valid timestamp
 */
export function isValidTimestamp(value: unknown): value is number {
  return timestampSchema.safeParse(value).success;
}

/**
 * Check if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return positiveNumberSchema.safeParse(value).success;
}

/**
 * Check if a value is a non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return nonNegativeNumberSchema.safeParse(value).success;
}

/**
 * Check if a value is an integer
 */
export function isInteger(value: unknown): value is number {
  return integerSchema.safeParse(value).success;
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return booleanSchema.safeParse(value).success;
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return nonEmptyStringSchema.safeParse(value).success;
}

/**
 * Check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return z.array(z.unknown()).safeParse(value).success;
}

/**
 * Check if a value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return unknownObjectSchema.safeParse(value).success;
}

// ============================================================================
// Exports
// ============================================================================

export {
  z,
  ZodSchema,
  ZodError,
  ZodIssue,
};

export type { AgentMetadata, AgentContext, AgentResult, AnalysisConfig, ID };
