/**
 * Busara Core Constants
 * =====================
 * 
 * This file contains all the constant values used across the Busara platform.
 */

// ============================================================================
// Application Constants
// ============================================================================

export const APP_NAME = 'Busara';
export const APP_DESCRIPTION = 'Multi-Agent Data Intelligence Platform';
export const APP_VERSION = '8.0.0-alpha.1';
export const APP_AUTHOR = 'Victor Ndunda';
export const APP_HOMEPAGE = 'https://busara.ai';
export const APP_REPOSITORY = 'https://github.com/gadda00/IntelliFlow';

// ============================================================================
// Environment Constants
// ============================================================================

export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  TEST: 'test',
  PRODUCTION: 'production',
} as const;

export type Environment = keyof typeof ENVIRONMENTS;

// ============================================================================
// API Constants
// ============================================================================

export const API = {
  // Version
  VERSION: 'v1',
  
  // Endpoints
  BASE_PATH: '/api',
  HEALTH: '/health',
  AGENTS: '/agents',
  ANALYZE: '/analyze',
  ANALYSES: '/analyses',
  ANALYZE_STREAM: '/analyze-stream',
  AUTH: {
    BASE: '/auth',
    REGISTER: '/register',
    LOGIN: '/login',
    LOGOUT: '/logout',
    ME: '/me',
    REFRESH: '/refresh',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    VERIFY_EMAIL: '/verify-email',
    API_KEYS: '/api-keys',
    SSO: '/sso',
  },
  PAYMENTS: {
    BASE: '/payments',
    INITIALIZE: '/initialize',
    VERIFY: '/verify',
    WEBHOOK: '/webhook',
    PLANS: '/plans',
    SUBSCRIPTIONS: '/subscriptions',
  },
  USAGE: '/usage',
  STATS: '/stats',
  WORKFLOWS: '/workflows',
  CONNECTORS: '/connectors',
  CHAT: '/chat',
  
  // Timeouts
  REQUEST_TIMEOUT_MS: 30000,
  UPLOAD_TIMEOUT_MS: 60000,
  
  // Rate limits
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 100,
    REQUESTS_PER_HOUR: 1000,
    BURST_LIMIT: 10,
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
} as const;

// ============================================================================
// Agent Constants
// ============================================================================

export const AGENTS = {
  // Stages
  STAGES: ['ingest', 'engineer', 'detect', 'forecast', 'infer', 'cluster', 'report'] as const,
  
  // Tiers
  TIERS: ['core', 'advanced', 'specialized', 'ml', 'stats', 'experimental'] as const,
  
  // Stability levels
  STABILITY: ['experimental', 'beta', 'stable', 'deprecated'] as const,
  
  // Statuses
  STATUSES: ['idle', 'pending', 'running', 'success', 'failed', 'skipped', 'timeout', 'cancelled'] as const,
  
  // Default timeout
  DEFAULT_TIMEOUT_MS: 30000,
  
  // Maximum concurrent agents
  MAX_CONCURRENT_AGENTS: 10,
  
  // Circuit breaker defaults
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 3,
    RESET_TIMEOUT_MS: 60000,
  },
  
  // Retry policy defaults
  RETRY_POLICY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    BACKOFF_MULTIPLIER: 2,
  },
} as const;

// ============================================================================
// Analysis Constants
// ============================================================================

export const ANALYSIS = {
  // Statuses
  STATUSES: ['pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timeout'] as const,
  
  // Priorities
  PRIORITIES: [0, 1, 2, 3, 4, 5] as const,
  
  // Default priority
  DEFAULT_PRIORITY: 3,
  
  // Maximum data rows
  MAX_DATA_ROWS: 50000,
  
  // Maximum file size (in bytes)
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  
  // Supported file types
  SUPPORTED_FILE_TYPES: [
    'text/csv',
    'application/json',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/xlsx',
    'application/xls',
  ],
  
  // Supported file extensions
  SUPPORTED_FILE_EXTENSIONS: ['.csv', '.json', '.txt', '.xlsx', '.xls'],
  
  // Sample data
  SAMPLE_DATA: {
    CSV: `id,name,age,email,score,date
1,John Doe,25,john@example.com,85.5,2024-01-15
2,Jane Smith,30,jane@example.com,92.3,2024-01-16
3,Bob Johnson,35,bob@example.com,78.9,2024-01-17
4,Alice Brown,28,alice@example.com,95.1,2024-01-18
5,Charlie Wilson,42,charlie@example.com,88.7,2024-01-19`,
    JSON: JSON.stringify([
      { id: 1, name: 'John Doe', age: 25, email: 'john@example.com', score: 85.5, date: '2024-01-15' },
      { id: 2, name: 'Jane Smith', age: 30, email: 'jane@example.com', score: 92.3, date: '2024-01-16' },
      { id: 3, name: 'Bob Johnson', age: 35, email: 'bob@example.com', score: 78.9, date: '2024-01-17' },
      { id: 4, name: 'Alice Brown', age: 28, email: 'alice@example.com', score: 95.1, date: '2024-01-18' },
      { id: 5, name: 'Charlie Wilson', age: 42, email: 'charlie@example.com', score: 88.7, date: '2024-01-19' },
    ], null, 2),
  },
} as const;

// ============================================================================
// Payment Constants
// ============================================================================

export const PAYMENTS = {
  // Providers
  PROVIDERS: ['flutterwave', 'stripe', 'paypal', 'google_pay', 'apple_pay', 'mobile_money'] as const,
  
  // Statuses
  STATUSES: ['initialized', 'pending', 'success', 'failed', 'refunded', 'cancelled', 'disputed'] as const,
  
  // Supported currencies
  CURRENCIES: ['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'ZAR', 'KES', 'UGX', 'TZS', 'RWF'] as const,
  
  // Default currency
  DEFAULT_CURRENCY: 'USD',
  
  // Payment intervals
  INTERVALS: ['month', 'year', 'once'] as const,
  
  // Flutterwave specific
  FLUTTERWAVE: {
    BASE_URL: 'https://api.flutterwave.com',
    VERSION: 'v3',
  },
  
  // Stripe specific
  STRIPE: {
    BASE_URL: 'https://api.stripe.com',
    VERSION: '2024-01-30',
  },
} as const;

// ============================================================================
// Pricing Constants
// ============================================================================

export const PRICING = {
  // Plan IDs
  PLAN_IDS: {
    FREE: 'free',
    PROFESSIONAL: 'professional',
    TEAM: 'team',
    ENTERPRISE: 'enterprise',
  },
  
  // Plan names
  PLAN_NAMES: {
    FREE: 'Free',
    PROFESSIONAL: 'Professional',
    TEAM: 'Team',
    ENTERPRISE: 'Enterprise',
  },
  
  // Default plans
  DEFAULT_PLAN: 'free',
  
  // Feature flags
  FEATURES: {
    ANALYSES_PER_MONTH: 'analyses_per_month',
    AGENTS_PER_ANALYSIS: 'agents_per_analysis',
    DATA_ROWS_PER_ANALYSIS: 'data_rows_per_analysis',
    TEAM_MEMBERS: 'team_members',
    API_REQUESTS_PER_MINUTE: 'api_requests_per_minute',
    PRIORITY_SUPPORT: 'priority_support',
    SYNTHETIC_DATA: 'synthetic_data',
    BRANDING: 'branding',
    SSO: 'sso',
    CUSTOM_AGENTS: 'custom_agents',
    ON_PREM: 'on_prem',
    DEDICATED_SUPPORT: 'dedicated_support',
  },
} as const;

// ============================================================================
// User Constants
// ============================================================================

export const USERS = {
  // Statuses
  STATUSES: ['active', 'inactive', 'suspended', 'deleted'] as const,
  
  // Roles
  ROLES: ['user', 'pro', 'team', 'enterprise', 'admin'] as const,
  
  // Permissions
  PERMISSIONS: [
    'read:own',
    'write:own',
    'delete:own',
    'read:shared',
    'write:shared',
    'delete:shared',
    'read:all',
    'write:all',
    'delete:all',
    'manage:users',
    'manage:billing',
    'manage:system',
  ] as const,
  
  // Default role
  DEFAULT_ROLE: 'user',
  
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
  },
  
  // Session
  SESSION: {
    EXPIRES_IN: '7d',
    REFRESH_EXPIRES_IN: '30d',
  },
} as const;

// ============================================================================
// Storage Constants
// ============================================================================

export const STORAGE = {
  // Local storage keys
  LOCAL_STORAGE: {
    THEME: 'busara_theme',
    LANGUAGE: 'busara_language',
    ONBOARDING_COMPLETE: 'busara_onboarding_complete',
    AUTH_TOKEN: 'busara_auth_token',
    REFRESH_TOKEN: 'busara_refresh_token',
    USER: 'busara_user',
  },
  
  // Session storage keys
  SESSION_STORAGE: {
    CSRF_TOKEN: 'busara_csrf_token',
  },
  
  // Cookie names
  COOKIES: {
    SESSION: 'busara_session',
    REFRESH: 'busara_refresh',
    CSRF: 'busara_csrf',
  },
  
  // Cookie options
  COOKIE_OPTIONS: {
    HTTP_ONLY: true,
    SECURE: true,
    SAME_SITE: 'strict' as const,
    PATH: '/',
  },
} as const;

// ============================================================================
// Logging Constants
// ============================================================================

export const LOGGING = {
  // Log levels
  LEVELS: ['debug', 'info', 'warn', 'error', 'silent'] as const,
  
  // Default log level
  DEFAULT_LEVEL: 'info',
  
  // Log formats
  FORMATS: ['json', 'pretty'] as const,
  
  // Default format
  DEFAULT_FORMAT: 'json',
  
  // Log retention
  RETENTION: {
    DAYS: 30,
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_FILES: 10,
  },
} as const;

// ============================================================================
// Cache Constants
// ============================================================================

export const CACHE = {
  // Cache keys
  KEYS: {
    AGENT_RESULTS: (analysisId: string, agentId: string) => `agent:${analysisId}:${agentId}`,
    ANALYSIS: (analysisId: string) => `analysis:${analysisId}`,
    USER_SESSION: (userId: string) => `session:${userId}`,
    RATE_LIMIT: (identifier: string) => `rate_limit:${identifier}`,
  },
  
  // Default TTLs (in milliseconds)
  TTLS: {
    AGENT_RESULT: 60 * 60 * 1000, // 1 hour
    ANALYSIS: 24 * 60 * 60 * 1000, // 24 hours
    SESSION: 7 * 24 * 60 * 60 * 1000, // 7 days
    RATE_LIMIT: 60 * 1000, // 1 minute
  },
  
  // Cache sizes
  SIZES: {
    MAX_ENTRIES: 10000,
    MAX_MEMORY: 100 * 1024 * 1024, // 100MB
  },
} as const;

// ============================================================================
// WebSocket Constants
// ============================================================================

export const WEBSOCKET = {
  // Connection
  PORT: 3003,
  PATH: '/ws',
  PING_INTERVAL_MS: 30000,
  PONG_TIMEOUT_MS: 10000,
  
  // Message types
  MESSAGE_TYPES: ['subscribe', 'unsubscribe', 'event', 'error', 'ping', 'pong'] as const,
  
  // Event buffer
  MAX_BUFFER_SIZE: 200,
} as const;

// ============================================================================
// Health Check Constants
// ============================================================================

export const HEALTH = {
  // Endpoint
  PATH: '/health',
  
  // Statuses
  STATUSES: ['healthy', 'degraded', 'unhealthy'] as const,
  
  // Check intervals
  CHECK_INTERVAL_MS: 60000,
  
  // Timeouts
  CHECK_TIMEOUT_MS: 5000,
  
  // Components to check
  COMPONENTS: [
    'database',
    'cache',
    'queue',
    'storage',
    'external_apis',
  ] as const,
} as const;

// ============================================================================
// Metrics Constants
// ============================================================================

export const METRICS = {
  // Prefix
  PREFIX: 'busara_',
  
  // Metric names
  NAMES: {
    AGENT_EXECUTION_COUNT: 'agent_execution_count',
    AGENT_EXECUTION_DURATION: 'agent_execution_duration_seconds',
    AGENT_EXECUTION_ERRORS: 'agent_execution_errors',
    ANALYSIS_COUNT: 'analysis_count',
    ANALYSIS_DURATION: 'analysis_duration_seconds',
    API_REQUEST_COUNT: 'api_request_count',
    API_REQUEST_DURATION: 'api_request_duration_seconds',
    API_REQUEST_ERRORS: 'api_request_errors',
    USER_COUNT: 'user_count',
    ACTIVE_USER_COUNT: 'active_user_count',
    PAYMENT_COUNT: 'payment_count',
    PAYMENT_AMOUNT: 'payment_amount',
  },
  
  // Labels
  LABELS: {
    AGENT_ID: 'agent_id',
    AGENT_NAME: 'agent_name',
    AGENT_STATUS: 'agent_status',
    AGENT_STAGE: 'agent_stage',
    ANALYSIS_STATUS: 'analysis_status',
    HTTP_METHOD: 'http_method',
    HTTP_PATH: 'http_path',
    HTTP_STATUS: 'http_status',
    USER_ID: 'user_id',
    ORG_ID: 'org_id',
    PLAN: 'plan',
    PROVIDER: 'provider',
    CURRENCY: 'currency',
  },
} as const;

// ============================================================================
// Error Constants
// ============================================================================

export const ERRORS = {
  // Error codes
  CODES: {
    // Authentication
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_TOKEN: 'INVALID_TOKEN',
    EXPIRED_TOKEN: 'EXPIRED_TOKEN',
    
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    INVALID_CONFIG: 'INVALID_CONFIG',
    
    // Not found
    NOT_FOUND: 'NOT_FOUND',
    AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
    ANALYSIS_NOT_FOUND: 'ANALYSIS_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    
    // Conflicts
    CONFLICT: 'CONFLICT',
    DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
    DUPLICATE_KEY: 'DUPLICATE_KEY',
    
    // Rate limiting
    RATE_LIMITED: 'RATE_LIMITED',
    TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
    
    // Data
    INVALID_DATA: 'INVALID_DATA',
    DATA_TOO_LARGE: 'DATA_TOO_LARGE',
    UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
    
    // Execution
    EXECUTION_ERROR: 'EXECUTION_ERROR',
    AGENT_ERROR: 'AGENT_ERROR',
    TIMEOUT: 'TIMEOUT',
    CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
    
    // Payments
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    
    // System
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    BAD_GATEWAY: 'BAD_GATEWAY',
    
    // External
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
  },
  
  // HTTP status codes
  HTTP_STATUS: {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    BAD_GATEWAY: 502,
  },
} as const;

// ============================================================================
// Security Constants
// ============================================================================

export const SECURITY = {
  // Content Security Policy
  CSP: {
    DEFAULT: "default-src 'self'",
    SCRIPT: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://www.google.com https://www.gstatic.com",
    STYLE: "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    IMG: "img-src 'self' data: blob: https://cdn.jsdelivr.net https://*.googleusercontent.com",
    FONT: "font-src 'self' https://cdn.jsdelivr.net",
    CONNECT: "connect-src 'self' wss:// ws:// https://api.flutterwave.com https://api.stripe.com",
    FRAME: "frame-src 'self' https://flutterwave.com https://checkout.stripe.com",
  },
  
  // Security headers
  HEADERS: {
    X_FRAME_OPTIONS: 'DENY',
    X_CONTENT_TYPE_OPTIONS: 'nosniff',
    X_XSS_PROTECTION: '1; mode=block',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    PERMISSIONS_POLICY: 'geolocation=(), microphone=(), camera=()',
  },
  
  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 60000, // 1 minute
    MAX_REQUESTS: 100,
    BURST_LIMIT: 10,
  },
  
  // Input validation
  INPUT: {
    MAX_STRING_LENGTH: 10000,
    MAX_ARRAY_LENGTH: 1000,
    MAX_OBJECT_DEPTH: 10,
  },
} as const;

// ============================================================================
// Testing Constants
// ============================================================================

export const TESTING = {
  // Timeouts
  TIMEOUTS: {
    UNIT_TEST: 5000,
    INTEGRATION_TEST: 10000,
    E2E_TEST: 30000,
  },
  
  // Retries
  RETRIES: {
    UNIT_TEST: 0,
    INTEGRATION_TEST: 1,
    E2E_TEST: 2,
  },
  
  // Coverage
  COVERAGE: {
    TARGET: 80,
    MINIMUM: 70,
  },
  
  // Test files
  PATTERNS: {
    UNIT: '**/*.test.ts',
    INTEGRATION: '**/*.spec.ts',
    E2E: '**/*.e2e.ts',
  },
} as const;

// ============================================================================
// Export all constants
// ============================================================================

export {
  APP_NAME as default,
};
