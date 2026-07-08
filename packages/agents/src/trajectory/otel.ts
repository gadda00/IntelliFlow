/**
 * OpenTelemetry GenAI Export Adapter
 * ==================================
 *
 * Converts Busara Trajectories to OpenTelemetry GenAI semantic convention
 * spans. This allows trajectory data to be consumed by any OTel-compatible
 * observability tool (Langfuse, Arize, Phoenix, MLflow, Datadog, etc.).
 *
 * The GenAI semantic conventions are an emerging standard (2025-2026) for
 * tracing LLM calls, tool calls, and agent reasoning. By exporting in this
 * format, we ensure trajectory data is portable and not locked into Busara's
 * internal format.
 *
 * v1.37+ compliance (https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai):
 *   - `gen_ai.system` was renamed to `gen_ai.provider.name` in v1.37.
 *   - `gen_ai.usage.prompt_tokens` was renamed to `gen_ai.usage.input_tokens`.
 *   - `gen_ai.usage.completion_tokens` was renamed to `gen_ai.usage.output_tokens`.
 *   - `gen_ai.operation.name` is now required on every GenAI span.
 *   - `gen_ai.agent.*` attributes (id, name, version, ...) are required for agent spans.
 *   - Span name format is `gen_ai.{operation.name} {agent.name}`.
 * Pre-v1.37 attribute names are silently dropped by most backends.
 *
 * Reference: https://github.com/open-telemetry/semantic-conventions/tree/main/docs/gen-ai
 */

import type {
  Trajectory,
  TrajectoryStep,
  OTelGenAITrace,
  OTelGenAISpan,
} from './types';

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert a Busara Trajectory to an OpenTelemetry GenAI trace.
 *
 * The trajectory becomes a trace; each step becomes a span.
 * Causal links (causalParentSteps) become parent-child span relationships.
 */
export function trajectoryToOTel(trajectory: Trajectory): OTelGenAITrace {
  const traceId = trajectory.id.replace(/[^a-f0-9]/gi, '').padEnd(32, '0').slice(0, 32);
  const spans = trajectory.steps.map(step => stepToSpan(step, traceId, trajectory));

  return { traceId, spans };
}

function stepToSpan(
  step: TrajectoryStep,
  traceId: string,
  trajectory: Trajectory,
): OTelGenAISpan {
  const spanId = step.id.replace(/[^a-f0-9]/gi, '').padEnd(16, '0').slice(0, 16);
  const parentSpanId =
    step.causalParentSteps.length > 0
      ? step.causalParentSteps[0].replace(/[^a-f0-9]/gi, '').padEnd(16, '0').slice(0, 16)
      : undefined;

  const startTimeUnixNano = `${new Date(step.timestamp).getTime() * 1_000_000}`;
  const endTimeUnixNano = step.durationMs
    ? `${(new Date(step.timestamp).getTime() + step.durationMs) * 1_000_000}`
    : startTimeUnixNano;

  // The root span is the one without a causal parent (first step of the
  // trajectory). Per OTel GenAI v1.37+, the root/agent span carries the
  // end-to-end duration attribute.
  const isRoot = step.causalParentSteps.length === 0;

  const attributes = buildSpanAttributes(step, trajectory, isRoot);
  const events = buildSpanEvents(step);

  return {
    traceId,
    spanId,
    parentSpanId,
    name: spanName(step, trajectory),
    kind: step.type === 'llm_call' || step.type === 'tool_call' ? 'CLIENT' : 'INTERNAL',
    startTimeUnixNano,
    endTimeUnixNano,
    attributes,
    status: step.error
      ? { code: 'ERROR', message: step.error }
      : { code: 'OK' },
    events,
  };
}

/**
 * Build the span name per OTel GenAI v1.37+ convention: `gen_ai.{operation} {agent.name}`.
 * The agent name falls back to the agent ID when a human-readable name is not
 * recorded on the trajectory (Trajectory currently only tracks agentId).
 */
function spanName(step: TrajectoryStep, trajectory: Trajectory): string {
  const agentName = trajectory.agentId;
  switch (step.type) {
    case 'observation':
      return `gen_ai.observe ${agentName}`;
    case 'reasoning':
      return `gen_ai.reason ${agentName}`;
    case 'llm_call':
      // v1.37 spec: agent execution spans use `gen_ai.execute {agent.name}`.
      return `gen_ai.execute ${agentName}`;
    case 'tool_call':
      return `gen_ai.tool ${agentName}`;
    case 'computation':
      return `gen_ai.compute ${agentName}`;
    case 'output':
      return `gen_ai.output ${agentName}`;
    case 'error':
      return `gen_ai.error ${agentName}`;
    default:
      return `gen_ai.step ${agentName}`;
  }
}

function buildSpanAttributes(
  step: TrajectoryStep,
  trajectory: Trajectory,
  isRoot: boolean,
): Record<string, string | number | boolean | string[]> {
  const attrs: Record<string, string | number | boolean | string[]> = {
    // ─── OTel GenAI v1.37+ required attributes ─────────────────────────
    // Every GenAI span MUST carry `gen_ai.operation.name`. For Busara agents
    // every step is part of an agent execution, so the operation is 'execute'.
    'gen_ai.operation.name': 'execute',
    // Agent identification (v1.37+). `gen_ai.agent.name` falls back to agentId
    // — Trajectory doesn't yet track a human-readable agent name.
    'gen_ai.agent.id': trajectory.agentId,
    'gen_ai.agent.name': trajectory.agentId,
    'gen_ai.agent.version': trajectory.agentVersion,
    'gen_ai.agent.stability': trajectory.agentStability,

    // ─── Busara-specific attributes (non-gen_ai namespace) ─────────────
    'agent.id': trajectory.agentId,
    'agent.version': trajectory.agentVersion,
    'agent.stability': trajectory.agentStability,
    'analysis.id': trajectory.analysisId,
    'user.id': trajectory.userId,
    'step.index': step.stepIndex,
    'step.type': step.type,
  };

  if (trajectory.workspaceId) attrs['workspace.id'] = trajectory.workspaceId;
  if (trajectory.organizationId) attrs['organization.id'] = trajectory.organizationId;

  // End-to-end duration goes on the root span (the agent-level span).
  if (isRoot) {
    attrs['gen_ai.e2e.duration_ms'] = trajectory.metrics.totalDurationMs;
  }

  if (step.llmCall) {
    // v1.37+ renames:
    //   gen_ai.system           → gen_ai.provider.name
    //   gen_ai.usage.prompt_tokens     → gen_ai.usage.input_tokens
    //   gen_ai.usage.completion_tokens → gen_ai.usage.output_tokens
    attrs['gen_ai.provider.name'] = step.llmCall.provider;
    attrs['gen_ai.request.model'] = step.llmCall.model;
    attrs['gen_ai.usage.input_tokens'] = step.llmCall.tokensIn;
    attrs['gen_ai.usage.output_tokens'] = step.llmCall.tokensOut;
    attrs['gen_ai.usage.total_tokens'] = step.llmCall.tokensIn + step.llmCall.tokensOut;
    if (step.llmCall.cost) attrs['gen_ai.cost'] = step.llmCall.cost;
    if (step.llmCall.temperature !== undefined)
      attrs['gen_ai.request.temperature'] = step.llmCall.temperature;
  }

  if (step.toolCall) {
    attrs['tool.name'] = step.toolCall.tool;
    attrs['tool.duration_ms'] = step.toolCall.latencyMs;
    if (step.toolCall.error) attrs['tool.error'] = step.toolCall.error;
  }

  if (step.reward !== undefined) attrs['reward.value'] = step.reward;

  // Dataframe metadata
  attrs['dataframe.hash'] = trajectory.metadata.dataframeHash;
  attrs['dataframe.rows'] = trajectory.metadata.rowCount;
  attrs['dataframe.columns'] = trajectory.metadata.columnCount;

  // Config hash for dedup
  attrs['config.hash'] = trajectory.contextSnapshot.configHash;

  return attrs;
}

function buildSpanEvents(
  step: TrajectoryStep,
): Array<{ name: string; timeUnixNano: string; attributes?: Record<string, unknown> }> {
  const events: Array<{ name: string; timeUnixNano: string; attributes?: Record<string, unknown> }> = [];
  const timeUnixNano = `${new Date(step.timestamp).getTime() * 1_000_000}`;

  if (step.error) {
    events.push({
      name: 'exception',
      timeUnixNano,
      attributes: {
        'exception.message': step.error,
        'exception.type': 'Error',
      },
    });
  }

  if (step.toolCall?.error) {
    events.push({
      name: 'tool.error',
      timeUnixNano,
      attributes: { 'tool.error': step.toolCall.error },
    });
  }

  return events;
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Convert multiple trajectories to OTel traces (for batch export).
 */
export function trajectoriesToOTel(trajectories: Trajectory[]): OTelGenAITrace[] {
  return trajectories.map(trajectoryToOTel);
}

// ============================================================================
// JSON Serialization (for HTTP export to OTel collectors)
// ============================================================================

/**
 * Serialize traces to the OTLP JSON format.
 * This can be POSTed to any OTel collector that accepts OTLP/HTTP.
 */
export function toOTLPJSON(traces: OTelGenAITrace[]): string {
  return JSON.stringify({
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'busara-agents' } },
            { key: 'service.version', value: { stringValue: '1.0.0' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'busara.trajectory' },
            spans: traces.flatMap(trace =>
              trace.spans.map(span => ({
                traceId: span.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                name: span.name,
                kind: span.kind === 'CLIENT' ? 3 : 1, // SPAN_KIND_CLIENT=3, INTERNAL=1
                startTimeUnixNano: span.startTimeUnixNano,
                endTimeUnixNano: span.endTimeUnixNano,
                attributes: Object.entries(span.attributes).map(([key, value]) => {
                  if (typeof value === 'string')
                    return { key, value: { stringValue: value } };
                  if (typeof value === 'number')
                    return { key, value: { doubleValue: value } };
                  if (typeof value === 'boolean')
                    return { key, value: { boolValue: value } };
                  if (Array.isArray(value))
                    return { key, value: { arrayValue: { values: value.map(v => ({ stringValue: v })) } } };
                  return { key, value: { stringValue: String(value) } };
                }),
                status: {
                  code: span.status.code === 'OK' ? 1 : 2,
                  message: span.status.message,
                },
                events: span.events.map(e => ({
                  name: e.name,
                  timeUnixNano: e.timeUnixNano,
                  attributes: e.attributes
                    ? Object.entries(e.attributes).map(([key, value]) => ({
                        key,
                        value: { stringValue: String(value) },
                      }))
                    : [],
                })),
              })),
            ),
          },
        ],
      },
    ],
  });
}
