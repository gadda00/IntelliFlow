/**
 * Busara Agent Errors
 * ===================
 * 
 * Custom error classes for the Busara agent framework.
 * These provide structured error handling and better debugging.
 */

import { AgentMetadata, ID } from '@busara/core';

// ============================================================================
// Base Error Classes
// ============================================================================

/**
 * Base error class for all Busara errors
 */
export class BusaraError extends Error {
  code: string;
  details?: Record<string, unknown>;
  cause?: Error;

  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.cause = cause;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert to JSON for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack?.split('\n'),
      cause: this.cause?.message,
    };
  }
  
  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return false;
  }
  
  /**
   * Check if this error is a timeout
   */
  isTimeout(): boolean {
    return false;
  }
}

/**
 * Validation error for invalid input or configuration
 */
export class ValidationError extends BusaraError {
  field?: string;
  value?: unknown;
  expectedType?: string;
  context?: Record<string, unknown>;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    expectedType?: string,
    context?: Record<string, unknown>,
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      {
        field,
        value,
        expectedType,
        context,
      }
    );
    this.field = field;
    this.value = value;
    this.expectedType = expectedType;
    this.context = context;
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends BusaraError {
  constructor(
    resourceType: string,
    public readonly resourceId: ID | string
  ) {
    super(
      `${resourceType} not found: ${resourceId}`,
      'NOT_FOUND',
      { resourceType, resourceId }
    );
  }
}

/**
 * Conflict error for duplicate resources
 */
export class ConflictError extends BusaraError {
  constructor(
    resourceType: string,
    public readonly resourceId: ID | string,
    public readonly conflictingId?: ID | string
  ) {
    super(
      `${resourceType} already exists: ${resourceId}`,
      'CONFLICT',
      { resourceType, resourceId, conflictingId }
    );
  }
}

// ============================================================================
// Agent-Specific Errors
// ============================================================================

/**
 * Error thrown when an agent is not found
 */
export class AgentNotFoundError extends NotFoundError {
  constructor(public readonly agentId: string) {
    super('Agent', agentId);
    this.code = 'AGENT_NOT_FOUND';
  }
}

/**
 * Error thrown when an agent is not registered
 */
export class AgentNotRegisteredError extends BusaraError {
  constructor(public readonly agentId: string) {
    super(
      `Agent not registered: ${agentId}`,
      'AGENT_NOT_REGISTERED',
      { agentId }
    );
  }
}

/**
 * Error thrown when an agent is disabled
 */
export class AgentDisabledError extends BusaraError {
  constructor(public readonly agentId: string) {
    super(
      `Agent is disabled: ${agentId}`,
      'AGENT_DISABLED',
      { agentId }
    );
  }
}

/**
 * Error thrown when agent execution times out
 */
export class AgentTimeoutError extends BusaraError {
  constructor(
    public readonly agentId: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Agent execution timeout: ${agentId} (${timeoutMs}ms)`,
      'AGENT_TIMEOUT',
      { agentId, timeoutMs }
    );
  }
  
  isTimeout(): boolean {
    return true;
  }
  
  isRetryable(): boolean {
    return true;
  }
}

/**
 * Error thrown when agent execution fails
 */
export class AgentExecutionError extends BusaraError {
  constructor(
    public readonly agentId: string,
    public readonly agentName: string,
    message: string,
    public readonly originalError?: Error,
    public readonly attempt?: number,
    public readonly maxAttempts?: number
  ) {
    super(
      `Agent execution failed: ${agentName} (${agentId}): ${message}`,
      'AGENT_EXECUTION_ERROR',
      { agentId, agentName, attempt, maxAttempts },
      originalError
    );
  }
  
  isRetryable(): boolean {
    // Check if the original error is retryable
    if (this.originalError instanceof BusaraError) {
      return this.originalError.isRetryable();
    }
    return true; // Assume retryable by default
  }
}

/**
 * Error thrown when agent dependencies are not met
 */
export class AgentDependencyError extends BusaraError {
  constructor(
    public readonly agentId: string,
    public readonly missingDependencies: string[]
  ) {
    super(
      `Agent dependencies not met: ${agentId} requires ${missingDependencies.join(', ')}`,
      'AGENT_DEPENDENCY_ERROR',
      { agentId, missingDependencies }
    );
  }
}

/**
 * Error thrown when agent circuit breaker is open
 */
export class CircuitBreakerOpenError extends BusaraError {
  constructor(
    public readonly agentId: string,
    public readonly failureCount: number,
    public readonly resetTimeoutMs: number
  ) {
    super(
      `Circuit breaker is open for agent: ${agentId} (${failureCount} failures, reset in ${resetTimeoutMs}ms)`,
      'CIRCUIT_BREAKER_OPEN',
      { agentId, failureCount, resetTimeoutMs }
    );
  }
  
  isRetryable(): boolean {
    return false; // Circuit breaker open means don't retry immediately
  }
}

/**
 * Error thrown when agent input validation fails
 */
export class AgentInputValidationError extends ValidationError {
  constructor(
    public readonly agentId: string,
    message: string,
    field?: string,
    value?: unknown,
    expectedType?: string
  ) {
    super(message, field, value, expectedType);
    this.code = 'AGENT_INPUT_VALIDATION_ERROR';
    this.details = { ...this.details, agentId };
  }
}

/**
 * Error thrown when agent output validation fails
 */
export class AgentOutputValidationError extends ValidationError {
  constructor(
    public readonly agentId: string,
    message: string,
    field?: string,
    value?: unknown,
    expectedType?: string
  ) {
    super(message, field, value, expectedType);
    this.code = 'AGENT_OUTPUT_VALIDATION_ERROR';
    this.details = { ...this.details, agentId };
  }
}

/**
 * Error thrown when agent configuration validation fails
 */
export class AgentConfigValidationError extends ValidationError {
  constructor(
    public readonly agentId: string,
    message: string,
    field?: string,
    value?: unknown,
    expectedType?: string
  ) {
    super(message, field, value, expectedType);
    this.code = 'AGENT_CONFIG_VALIDATION_ERROR';
    this.details = { ...this.details, agentId };
  }
}

// ============================================================================
// Orchestrator Errors
// ============================================================================

/**
 * Error thrown when pipeline execution fails
 */
export class PipelineExecutionError extends BusaraError {
  constructor(
    public readonly analysisId: ID,
    message: string,
    public readonly failedAgents: string[] = [],
    public readonly cause?: Error
  ) {
    super(
      `Pipeline execution failed: ${message}`,
      'PIPELINE_EXECUTION_ERROR',
      { analysisId, failedAgents },
      cause
    );
  }
}

/**
 * Error thrown when pipeline is cancelled
 */
export class PipelineCancelledError extends BusaraError {
  constructor(public readonly analysisId: ID) {
    super(
      `Pipeline execution cancelled: ${analysisId}`,
      'PIPELINE_CANCELLED',
      { analysisId }
    );
  }
}

/**
 * Error thrown when no agents are available for execution
 */
export class NoAgentsAvailableError extends BusaraError {
  constructor(
    public readonly stage?: string,
    public readonly filter?: Record<string, unknown>
  ) {
    super(
      `No agents available${stage ? ` for stage: ${stage}` : ''}`,
      'NO_AGENTS_AVAILABLE',
      { stage, filter }
    );
  }
}

// ============================================================================
// Data Errors
// ============================================================================

/**
 * Error thrown when data is invalid
 */
export class InvalidDataError extends BusaraError {
  constructor(
    message: string,
    public readonly issues: string[] = []
  ) {
    super(message, 'INVALID_DATA', { issues });
  }
}

/**
 * Error thrown when data is too large
 */
export class DataTooLargeError extends BusaraError {
  constructor(
    public readonly size: number,
    public readonly maxSize: number
  ) {
    super(
      `Data is too large: ${size} bytes (max: ${maxSize} bytes)`,
      'DATA_TOO_LARGE',
      { size, maxSize }
    );
  }
}

/**
 * Error thrown when data format is unsupported
 */
export class UnsupportedFormatError extends BusaraError {
  constructor(
    public readonly format: string,
    public readonly supportedFormats: string[]
  ) {
    super(
      `Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`,
      'UNSUPPORTED_FORMAT',
      { format, supportedFormats }
    );
  }
}

/**
 * Error thrown when data parsing fails
 */
export class DataParseError extends BusaraError {
  constructor(
    message: string,
    public readonly rawData?: string,
    public readonly cause?: Error
  ) {
    super(message, 'DATA_PARSE_ERROR', { rawData }, cause);
  }
}

// ============================================================================
// System Errors
// ============================================================================

/**
 * Error thrown when a system resource is unavailable
 */
export class ResourceUnavailableError extends BusaraError {
  constructor(
    public readonly resource: string,
    public readonly reason?: string
  ) {
    super(
      `Resource unavailable: ${resource}${reason ? ` (${reason})` : ''}`,
      'RESOURCE_UNAVAILABLE',
      { resource, reason }
    );
  }
  
  isRetryable(): boolean {
    return true; // Resource might become available
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends BusaraError {
  constructor(
    public readonly limit: number,
    public readonly windowMs: number,
    public readonly retryAfterMs?: number
  ) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      'RATE_LIMIT_EXCEEDED',
      { limit, windowMs, retryAfterMs }
    );
  }
  
  isRetryable(): boolean {
    return true;
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends BusaraError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends BusaraError {
  constructor(
    message: string = 'Authorization failed',
    public readonly requiredPermission?: string
  ) {
    super(message, 'AUTHORIZATION_ERROR', { requiredPermission });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an error from an unknown error
 */
export function createErrorFromUnknown(
  error: unknown,
  context?: Record<string, unknown>
): BusaraError {
  if (error instanceof BusaraError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new BusaraError(
      error.message,
      'INTERNAL_ERROR',
      context,
      error
    );
  }
  
  return new BusaraError(
    String(error),
    'INTERNAL_ERROR',
    context
  );
}

/**
 * Check if an error is a Busara error
 */
export function isBusaraError(error: unknown): error is BusaraError {
  return error instanceof BusaraError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isBusaraError(error)) {
    return error.isRetryable();
  }
  return false;
}

/**
 * Check if an error is a timeout
 */
export function isTimeoutError(error: unknown): boolean {
  if (isBusaraError(error)) {
    return error.isTimeout();
  }
  return false;
}

/**
 * Get error code from an error
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isBusaraError(error)) {
    return error.code;
  }
  return undefined;
}

// ============================================================================
// Exports
// ============================================================================

export type { AgentMetadata, ID };
