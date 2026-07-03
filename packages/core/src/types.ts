/**
 * Busara Core Types
 * =================
 * 
 * This file contains all the fundamental type definitions used across the Busara platform.
 * These types provide a consistent interface between different parts of the system.
 */

// ============================================================================
// Core Domain Types
// ============================================================================

/** Unique identifier type - uses CUID by default */
export type ID = string;

/** ISO 8601 date string */
export type ISODateString = string;

/** Timestamp in milliseconds since epoch */
export type Timestamp = number;

// ============================================================================
// User & Authentication Types
// ============================================================================

/** User status enum */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted';

/** User role enum */
export type UserRole = 'user' | 'pro' | 'team' | 'enterprise' | 'admin';

/** User permission enum */
export type UserPermission = 
  | 'read:own'
  | 'write:own'
  | 'delete:own'
  | 'read:shared'
  | 'write:shared'
  | 'delete:shared'
  | 'read:all'
  | 'write:all'
  | 'delete:all'
  | 'manage:users'
  | 'manage:billing'
  | 'manage:system';

/** User profile */
export interface User {
  id: ID;
  email: string;
  name: string | null;
  image: string | null;
  status: UserStatus;
  role: UserRole;
  permissions: UserPermission[];
  
  // Profile
  bio?: string;
  website?: string;
  location?: string;
  timezone: string;
  
  // Preferences
  theme: 'light' | 'dark' | 'system';
  language: string;
  
  // Timestamps
  emailVerified?: ISODateString;
  lastLoginAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Authentication user (minimal user data for auth) */
export interface AuthUser {
  id: ID;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  permissions: UserPermission[];
}

/** Session data */
export interface Session {
  user: AuthUser;
  expires: ISODateString;
  token: string;
}

// ============================================================================
// Organization Types
// ============================================================================

/** Organization status enum */
export type OrganizationStatus = 'active' | 'inactive' | 'suspended';

/** Organization member role */
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'guest';

/** Organization */
export interface Organization {
  id: ID;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  
  // Settings
  domain: string | null;
  themeColor: string;
  
  // Status
  status: OrganizationStatus;
  
  // Timestamps
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Organization member */
export interface OrganizationMember {
  id: ID;
  userId: ID;
  organizationId: ID;
  role: OrganizationRole;
  
  // Timestamps
  joinedAt: ISODateString;
  updatedAt: ISODateString;
  
  // Relationships
  user?: User;
  organization?: Organization;
}

// ============================================================================
// Agent Types
// ============================================================================

/** Agent stage in the pipeline */
export type AgentStage = 
  | 'ingest'      // Stage 0: Data ingestion and profiling
  | 'engineer'    // Stage 1: Cleaning and feature engineering
  | 'detect'      // Stage 2: Anomaly detection and pattern recognition
  | 'forecast'    // Stage 3: Time series forecasting
  | 'infer'       // Stage 4: Causal inference and explainability
  | 'cluster'     // Stage 5: Clustering and segmentation
  | 'report';     // Stage 6: Narrative and reporting

/** Agent tier (complexity/importance) */
export type AgentTier = 'core' | 'advanced' | 'specialized' | 'ml' | 'stats' | 'experimental';

/** Agent stability level */
export type AgentStability = 'experimental' | 'beta' | 'stable' | 'deprecated';

/** Agent execution status */
export type AgentStatus = 
  | 'idle'
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'timeout'
  | 'cancelled';

/** Agent metadata defines the agent's identity and capabilities */
export interface AgentMetadata {
  // Identity
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Classification
  stage: AgentStage;
  stageNumber: number;
  tier: AgentTier;
  stability: AgentStability;
  
  // Author
  author: string;
  license: string;
  repository?: string;
  
  // Dependencies
  dependencies: string[];
  
  // Execution
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  
  // Capabilities
  capabilities: string[];
  category: string;
  tags: string[];
  
  // Input/Output
  inputDescription: string;
  outputDescription: string;
  
  // Documentation
  documentationUrl?: string;
  
  // Marketplace (optional)
  price?: number;
  rating?: number;
  downloadCount?: number;
  
  // Technical requirements
  memoryLimit?: string;
  cpuLimit?: string;
  gpuRequired?: boolean;
  
  // UI
  icon: string;
  color: string;
}

/** Retry policy for agent execution */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/** Default retry policy */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['timeout', 'rate_limit', 'temporary_failure'],
};

/** Agent execution context */
export interface AgentContext {
  // Analysis
  analysisId: ID;
  analysisName?: string;
  
  // Data
  dataframe: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  
  // Previous results
  previousResults: Map<string, AgentResult>;
  
  // Configuration
  config: AnalysisConfig;
  
  // User
  userId?: ID;
  orgId?: ID;
  
  // Timestamps
  startedAt: ISODateString;
  
  // System
  requestId?: string;
  traceId?: string;
}

/** Analysis configuration */
export interface AnalysisConfig {
  // Target
  targetColumn?: string;
  timeColumn?: string;
  
  // Forecasting
  seasonLength?: number;
  forecastHorizon?: number;
  
  // Anomaly detection
  anomalyThreshold?: number;
  
  // Clustering
  clusterCount?: number;
  
  // Natural language
  nlqQuery?: string;
  
  // Objectives
  objectives?: string[];
  
  // File info
  fileName?: string;
  fileType?: string;
  
  // Sensitivity
  sensitivity?: 'low' | 'medium' | 'high';
  
  // Agent selection
  enabledAgents?: string[];
  disabledAgents?: string[];
  
  // Performance
  maxConcurrentAgents?: number;
  
  // Caching
  useCache?: boolean;
}

/** Agent execution result */
export interface AgentResult {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  output: unknown;
  metrics: Record<string, number>;
  executionTimeMs: number;
  error?: string;
  errorStack?: string;
  timestamp: ISODateString;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  
  // Retry info
  attempt?: number;
  
  // Cache info
  cached?: boolean;
  cacheKey?: string;
}

/** Agent metrics */
export interface AgentMetrics {
  [key: string]: number;
}

// ============================================================================
// Analysis Types
// ============================================================================

/** Analysis status */
export type AnalysisStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/** Analysis priority */
export type AnalysisPriority = 0 | 1 | 2 | 3 | 4 | 5; // 0 = lowest, 5 = highest

/** Analysis */
export interface Analysis {
  id: ID;
  
  // Ownership
  userId: ID | null;
  orgId: ID | null;
  
  // Metadata
  name: string;
  description: string | null;
  tags: string[];
  
  // Data
  dataSource: string;
  dataHash: string;
  rowCount: number;
  columnCount: number;
  
  // Configuration
  config: AnalysisConfig;
  
  // Workflow
  workflowId: ID | null;
  
  // Execution
  status: AnalysisStatus;
  priority: AnalysisPriority;
  
  // Results
  result: unknown | null;
  summary: unknown | null;
  
  // Error
  errorMessage: string | null;
  errorStack: string | null;
  
  // Timestamps
  scheduledAt: ISODateString | null;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  
  // System
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Analysis summary for listings */
export interface AnalysisSummary {
  id: ID;
  name: string;
  status: AnalysisStatus;
  priority: AnalysisPriority;
  dataSource: string;
  rowCount: number;
  columnCount: number;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  createdAt: ISODateString;
}

// ============================================================================
// Workflow Types
// ============================================================================

/** Workflow status */
export type WorkflowStatus = 'draft' | 'published' | 'deprecated' | 'archived';

/** Workflow definition (DAG) */
export interface WorkflowDefinition {
  version: string;
  name: string;
  description: string;
  agents: WorkflowAgent[];
  connections: WorkflowConnection[];
}

/** Agent in a workflow */
export interface WorkflowAgent {
  id: string;
  agentId: string; // Reference to registered agent
  name?: string; // Override name
  config?: Record<string, unknown>;
  position: { x: number; y: number };
}

/** Connection between agents in a workflow */
export interface WorkflowConnection {
  id: string;
  from: string; // source agent ID
  to: string; // target agent ID
  condition?: string; // Optional condition for conditional execution
}

/** Workflow */
export interface Workflow {
  id: ID;
  
  // Ownership
  userId: ID | null;
  orgId: ID | null;
  
  // Metadata
  name: string;
  description: string | null;
  version: string;
  
  // Definition
  definition: WorkflowDefinition;
  
  // Status
  status: WorkflowStatus;
  
  // Timestamps
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ============================================================================
// Progress & Events Types
// ============================================================================

/** Progress update for real-time tracking */
export interface ProgressUpdate {
  analysisId: ID;
  agentId: string;
  agentName: string;
  stage: AgentStage;
  stageNumber: number;
  status: AgentStatus;
  progress: number; // 0-100
  result?: AgentResult;
  error?: string;
  timestamp: ISODateString;
  durationMs?: number;
}

/** Event types for real-time updates */
export type EventType = 
  | 'analysis:started'
  | 'analysis:progress'
  | 'analysis:completed'
  | 'analysis:failed'
  | 'analysis:cancelled'
  | 'agent:started'
  | 'agent:progress'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:skipped';

/** Base event */
export interface BaseEvent {
  type: EventType;
  timestamp: ISODateString;
  analysisId: ID;
  requestId?: string;
  traceId?: string;
}

/** Analysis started event */
export interface AnalysisStartedEvent extends BaseEvent {
  type: 'analysis:started';
  analysis: {
    id: ID;
    name: string;
    config: AnalysisConfig;
  };
  totalAgents: number;
}

/** Analysis progress event */
export interface AnalysisProgressEvent extends BaseEvent {
  type: 'analysis:progress';
  completedAgents: number;
  totalAgents: number;
  progress: number;
  currentStage: AgentStage;
}

/** Analysis completed event */
export interface AnalysisCompletedEvent extends BaseEvent {
  type: 'analysis:completed';
  durationMs: number;
  agentsSucceeded: number;
  agentsFailed: number;
  agentsSkipped: number;
  result: unknown;
}

/** Analysis failed event */
export interface AnalysisFailedEvent extends BaseEvent {
  type: 'analysis:failed';
  error: string;
  errorStack?: string;
  failedAgentId?: string;
  durationMs: number;
}

/** Agent started event */
export interface AgentStartedEvent extends BaseEvent {
  type: 'agent:started';
  agentId: string;
  agentName: string;
  stage: AgentStage;
  stageNumber: number;
}

/** Agent progress event */
export interface AgentProgressEvent extends BaseEvent {
  type: 'agent:progress';
  agentId: string;
  agentName: string;
  progress: number;
  message?: string;
}

/** Agent completed event */
export interface AgentCompletedEvent extends BaseEvent {
  type: 'agent:completed';
  agentId: string;
  agentName: string;
  durationMs: number;
  result: AgentResult;
}

/** Agent failed event */
export interface AgentFailedEvent extends BaseEvent {
  type: 'agent:failed';
  agentId: string;
  agentName: string;
  error: string;
  errorStack?: string;
  durationMs: number;
}

/** Agent skipped event */
export interface AgentSkippedEvent extends BaseEvent {
  type: 'agent:skipped';
  agentId: string;
  agentName: string;
  reason: string;
}

/** Union type for all events */
export type AnalysisEvent = 
  | AnalysisStartedEvent
  | AnalysisProgressEvent
  | AnalysisCompletedEvent
  | AnalysisFailedEvent
  | AgentStartedEvent
  | AgentProgressEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | AgentSkippedEvent;

// ============================================================================
// API Types
// ============================================================================

/** API response wrapper */
export interface ApiResponse<T> {
  status: 'success' | 'error' | 'validation_error';
  data?: T;
  error?: ApiError;
  meta?: {
    requestId: string;
    timestamp: ISODateString;
    durationMs: number;
    version: string;
  };
}

/** API error */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/** Pagination parameters */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/** Filter parameters */
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | number[] | null;
}

/** Query parameters */
export interface QueryParams extends PaginationParams, FilterParams {}

// ============================================================================
// Payment & Billing Types
// ============================================================================

/** Payment provider */
export type PaymentProvider = 'flutterwave' | 'stripe' | 'paypal' | 'google_pay' | 'apple_pay' | 'mobile_money';

/** Payment status */
export type PaymentStatus = 
  | 'initialized'
  | 'pending'
  | 'success'
  | 'failed'
  | 'refunded'
  | 'cancelled'
  | 'disputed';

/** Currency codes */
export type Currency = 
  | 'NGN' | 'USD' | 'EUR' | 'GBP' | 'GHS' | 'ZAR' | 'KES' | 'UGX' | 'TZS' | 'RWF';

/** Pricing plan */
export interface PricingPlan {
  id: ID;
  name: string;
  description: string;
  price: {
    amount: number;
    currency: Currency;
    interval: 'month' | 'year' | 'once';
  };
  features: string[];
  limits: {
    analysesPerMonth?: number;
    agentsPerAnalysis?: number;
    dataRowsPerAnalysis?: number;
    teamMembers?: number;
    apiRequestsPerMinute?: number;
  };
  isActive: boolean;
  isPopular: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Subscription */
export interface Subscription {
  id: ID;
  userId: ID;
  planId: ID;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: ISODateString;
  currentPeriodEnd: ISODateString;
  cancelAtPeriodEnd: boolean;
  trialStart?: ISODateString;
  trialEnd?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Payment */
export interface Payment {
  id: ID;
  userId: ID;
  subscriptionId?: ID;
  reference: string;
  amount: number;
  currency: Currency;
  planId?: ID;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerData: Record<string, unknown>;
  analysisId?: ID;
  verifiedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Usage record */
export interface UsageRecord {
  id: ID;
  userId: ID;
  month: string; // YYYY-MM
  analysesUsed: number;
  tokensUsed: number;
  agentsInvoked: number;
  dataRowsProcessed: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ============================================================================
// API Key Types
// ============================================================================

/** API key */
export interface ApiKey {
  id: ID;
  userId: ID;
  name: string;
  prefix: string; // First 8 characters of the key
  keyHash: string; // Hashed key for verification
  lastUsedAt?: ISODateString;
  expiresAt?: ISODateString;
  permissions: UserPermission[];
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ============================================================================
// WebSocket Types
// ============================================================================

/** WebSocket message types */
export type WebSocketMessageType = 
  | 'subscribe'
  | 'unsubscribe'
  | 'event'
  | 'error'
  | 'ping'
  | 'pong';

/** WebSocket message */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: unknown;
  error?: string;
  timestamp: Timestamp;
}

/** WebSocket subscription message */
export interface WebSocketSubscribeMessage extends WebSocketMessage {
  type: 'subscribe';
  data: {
    analysisId: ID;
    requestId?: string;
  };
}

/** WebSocket unsubscribe message */
export interface WebSocketUnsubscribeMessage extends WebSocketMessage {
  type: 'unsubscribe';
  data: {
    analysisId: ID;
    requestId?: string;
  };
}

/** WebSocket event message */
export interface WebSocketEventMessage extends WebSocketMessage {
  type: 'event';
  data: AnalysisEvent;
}

/** WebSocket error message */
export interface WebSocketErrorMessage extends WebSocketMessage {
  type: 'error';
  error: string;
}

// ============================================================================
// Metrics Types
// ============================================================================

/** Metric types */
export type MetricType = 
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'summary';

/** Metric definition */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  labels?: string[];
}

/** Metric value */
export interface MetricValue {
  metric: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Timestamp;
}

/** Agent metrics */
export interface AgentExecutionMetrics {
  agentId: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  lastExecutionAt?: ISODateString;
  lastSuccessAt?: ISODateString;
  lastFailureAt?: ISODateString;
}

// ============================================================================
// Cache Types
// ============================================================================

/** Cache entry */
export interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: Timestamp; // Time to live in milliseconds
  createdAt: Timestamp;
  accessedAt: Timestamp;
}

/** Cache statistics */
export interface CacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  expirationCount: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

/** Health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Component health */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/** System health */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: ISODateString;
  version: string;
  components: ComponentHealth[];
  uptime: number; // in seconds
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/** Environment configuration */
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  HOST: string;
  
  // Database
  DATABASE_URL: string;
  DIRECT_URL?: string;
  
  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Flutterwave
  FLUTTERWAVE_PUBLIC_KEY: string;
  FLUTTERWAVE_SECRET_KEY: string;
  FLUTTERWAVE_ENCRYPTION_KEY: string;
  
  // Stripe
  STRIPE_PUBLIC_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  
  // Redis
  REDIS_URL?: string;
  
  // Application
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_API_URL: string;
  
  // Features
  NEXT_PUBLIC_ENABLE_ANALYTICS: boolean;
  NEXT_PUBLIC_ENABLE_PAYMENTS: boolean;
  NEXT_PUBLIC_ENABLE_MARKETPLACE: boolean;
  
  // Limits
  MAX_FILE_SIZE: number;
  MAX_DATA_ROWS: number;
  MAX_CONCURRENT_ANALYSES: number;
  
  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  
  // Observability
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: number;
}

/** Application configuration */
export interface AppConfig {
  env: EnvironmentConfig;
  features: {
    analytics: boolean;
    payments: boolean;
    marketplace: boolean;
    collaboration: boolean;
    enterprise: boolean;
  };
  limits: {
    fileSize: number;
    dataRows: number;
    concurrentAnalyses: number;
    rateLimit: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    format: 'json' | 'pretty';
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/** Deep partial type */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Deep required type */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/** Deep readonly type */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** Value of object */
export type ValueOf<T> = T[keyof T];

/** Function type */
export type Fn = () => void;

/** Any function */
export type AnyFn = (...args: any[]) => any;

/** Async function */
export type AsyncFn<T = void> = () => Promise<T>;

/** Awaited type */
export type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

/** Non-nullable type */
export type NonNullable<T> = T extends null | undefined ? never : T;

/** Nullable type */
export type Nullable<T> = T | null;

/** Optional type */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Require at least one property */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/** XOR type (exclusive or) */
export type XOR<T, U> = (T | U) extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/** Cast type */
export type Cast<T, U> = T extends U ? T : U;

/** Merge types */
export type Merge<T, U> = Omit<T, keyof U> & U;

/** Overwrite type */
export type Overwrite<T, U> = Omit<T, keyof U> & U;
