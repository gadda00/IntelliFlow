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

  const attributes = buildSpanAttributes(step, trajectory);
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

function spanName(step: TrajectoryStep, trajectory: Trajectory): string {
  switch (step.type) {
    case 'observation':
      return `${trajectory.agentId}.observe`;
    case 'reasoning':
      return `${trajectory.agentId}.reason`;
    case 'llm_call':
      return `${trajectory.agentId}.llm.${step.llmCall?.provider ?? 'unknown'}`;
    case 'tool_call':
      return `${trajectory.agentId}.tool.${step.toolCall?.tool ?? 'unknown'}`;
    case 'computation':
      return `${trajectory.agentId}.compute`;
    case 'output':
      return `${trajectory.agentId}.output`;
    case 'error':
      return `${trajectory.agentId}.error`;
    default:
      return `${trajectory.agentId}.step`;
  }
}

function buildSpanAttributes(
  step: TrajectoryStep,
  trajectory: Trajectory,
): Record<string, string | number | boolean | string[]> {
  const attrs: Record<string, string | number | boolean | string[]> = {
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

  if (step.llmCall) {
    attrs['gen_ai.system'] = step.llmCall.provider;
    attrs['gen_ai.request.model'] = step.llmCall.model;
    attrs['gen_ai.usage.prompt_tokens'] = step.llmCall.tokensIn;
    attrs['gen_ai.usage.completion_tokens'] = step.llmCall.tokensOut;
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
