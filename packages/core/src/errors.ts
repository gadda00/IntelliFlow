/**
 * Busara Core - Error Classes
 * ===========================
 * Standardized error hierarchy used across the Busara platform.
 */

import type { ApiError } from './types';

/** Base Busara error class */
export class BusaraError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  isOperational: boolean;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      stack: process.env.NODE_ENV === 'production' ? undefined : this.stack,
    };
  }
}

/** Validation error (400) */
export class ValidationError extends BusaraError {
  fields: Array<{ field: string; message: string; code?: string }>;

  constructor(
    message: string,
    fields: Array<{ field: string; message: string; code?: string }> = [],
    details?: Record<string, unknown>,
  ) {
    super(message, 'VALIDATION_ERROR', 400, details, true);
    this.fields = fields;
  }
}

/** Not found error (404) */
export class NotFoundError extends BusaraError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      'NOT_FOUND',
      404,
    );
  }
}

/** Unauthorized error (401) */
export class UnauthorizedError extends BusaraError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/** Forbidden error (403) */
export class ForbiddenError extends BusaraError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

/** Conflict error (409) */
export class ConflictError extends BusaraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
  }
}

/** Rate limit error (429) */
export class RateLimitError extends BusaraError {
  retryAfterMs: number;

  constructor(message = 'Too many requests', retryAfterMs = 60000) {
    super(message, 'RATE_LIMITED', 429, { retryAfterMs });
    this.retryAfterMs = retryAfterMs;
  }
}

/** Timeout error (408) */
export class TimeoutError extends BusaraError {
  timeoutMs: number;

  constructor(message = 'Request timed out', timeoutMs = 30000) {
    super(message, 'TIMEOUT', 408, { timeoutMs });
    this.timeoutMs = timeoutMs;
  }
}

/** Agent execution error (500) */
export class AgentError extends BusaraError {
  agentId: string;

  constructor(agentId: string, message: string, details?: Record<string, unknown>) {
    super(message, 'AGENT_ERROR', 500, { agentId, ...details });
    this.agentId = agentId;
  }
}

/** External API error (502) */
export class ExternalApiError extends BusaraError {
  service: string;

  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(message, 'EXTERNAL_API_ERROR', 502, { service, ...details });
    this.service = service;
  }
}

/** Configuration error (500) */
export class ConfigurationError extends BusaraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_CONFIG', 500, details);
  }
}

/** Type guard for BusaraError */
export function isBusaraError(err: unknown): err is BusaraError {
  return err instanceof BusaraError;
}

/** Convert any error to a BusaraError */
export function toBusaraError(err: unknown): BusaraError {
  if (err instanceof BusaraError) return err;
  if (err instanceof Error) {
    return new BusaraError(err.message, 'INTERNAL_ERROR', 500, { originalName: err.name });
  }
  return new BusaraError('An unknown error occurred', 'INTERNAL_ERROR', 500);
}
