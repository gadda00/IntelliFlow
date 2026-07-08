'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cloud,
  Code,
  Cog,
  AlertCircle,
  Database,
  DollarSign,
  Eye,
  Timer,
  Zap,
} from 'lucide-react';
import type { Trajectory, TrajectoryStep, StepType, TrajectoryLLMCall, TrajectoryToolCall } from '@busara/agents';
import { cn } from '@/lib/utils';

const STEP_TYPE_META: Record<StepType, { icon: React.ElementType; color: string; label: string }> = {
  observation: { icon: Eye, color: 'text-sky-400', label: 'Observation' },
  reasoning: { icon: Brain, color: 'text-violet-400', label: 'Reasoning' },
  llm_call: { icon: Cloud, color: 'text-emerald-400', label: 'LLM Call' },
  tool_call: { icon: Zap, color: 'text-amber-400', label: 'Tool Call' },
  computation: { icon: Cog, color: 'text-slate-300', label: 'Computation' },
  output: { icon: CircleDot, color: 'text-emerald-400', label: 'Output' },
  error: { icon: AlertCircle, color: 'text-rose-400', label: 'Error' },
};

function formatMs(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function truncate(s: unknown, max = 300): string {
  if (s === undefined || s === null) return '—';
  const str = typeof s === 'string' ? s : JSON.stringify(s, null, 2);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function JSONBlock({ data, maxHeight = 240 }: { data: unknown; maxHeight?: number }) {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <pre
      className="rounded-md bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300 overflow-auto scrollbar-thin font-mono"
      style={{ maxHeight }}
    >
      {str}
    </pre>
  );
}

function StepLLMCallDetails({ call }: { call: TrajectoryLLMCall }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-slate-500">Provider:</span>{' '}
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
            {call.provider}
          </Badge>
        </div>
        <div>
          <span className="text-slate-500">Model:</span>{' '}
          <code className="text-slate-300">{call.model}</code>
        </div>
        <div>
          <span className="text-slate-500">Tokens:</span>{' '}
          <span className="text-slate-300 tabular-nums">
            {(call.tokensIn ?? 0).toLocaleString()} in / {(call.tokensOut ?? 0).toLocaleString()} out
          </span>
        </div>
        <div>
          <span className="text-slate-500">Cost:</span>{' '}
          <span className="text-emerald-400 tabular-nums">${(call.cost ?? 0).toFixed(4)}</span>
        </div>
        <div>
          <span className="text-slate-500">Latency:</span>{' '}
          <span className="text-slate-300 tabular-nums">{formatMs(call.latencyMs)}</span>
        </div>
        {call.temperature !== undefined && (
          <div>
            <span className="text-slate-500">Temp:</span>{' '}
            <span className="text-slate-300 tabular-nums">{call.temperature}</span>
          </div>
        )}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 select-none">
          <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
          System Prompt
        </summary>
        <div className="mt-2">
          <JSONBlock data={call.systemPrompt} maxHeight={200} />
        </div>
      </details>

      <details className="group">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 select-none">
          <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
          User Prompt
        </summary>
        <div className="mt-2">
          <JSONBlock data={call.userPrompt} maxHeight={200} />
        </div>
      </details>

      <details open className="group">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 select-none">
          <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
          Response
        </summary>
        <div className="mt-2">
          <JSONBlock data={call.response} maxHeight={320} />
        </div>
      </details>
    </div>
  );
}

function StepToolCallDetails({ call }: { call: TrajectoryToolCall }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs">
        <span className="text-slate-500">Tool:</span>{' '}
        <code className="text-amber-300">{call.tool}</code>
        <span className="text-slate-500 ml-3">Latency:</span>{' '}
        <span className="text-slate-300 tabular-nums">{formatMs(call.latencyMs)}</span>
        {call.error && (
          <span className="text-rose-400 ml-3">Error: {call.error}</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Input</p>
          <JSONBlock data={call.input} maxHeight={180} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Output</p>
          <JSONBlock data={call.output} maxHeight={180} />
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, isLast }: { step: TrajectoryStep; isLast: boolean }) {
  const [open, setOpen] = useState(step.type === 'error' || step.type === 'llm_call');
  const meta = STEP_TYPE_META[step.type] ?? STEP_TYPE_META.computation;
  const Icon = meta.icon;
  const hasDetails =
    step.llmCall !== undefined ||
    step.toolCall !== undefined ||
    step.observation !== undefined ||
    step.action !== undefined ||
    step.result !== undefined ||
    step.error !== undefined;

  return (
    <div className="relative pl-10">
      {/* Timeline dot + connector */}
      <div className="absolute left-0 top-1 flex flex-col items-center">
        <div
          className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center border-2 bg-slate-950',
            step.type === 'error'
              ? 'border-rose-500/50 text-rose-400'
              : step.type === 'llm_call'
                ? 'border-emerald-500/50 text-emerald-400'
                : 'border-slate-700 text-slate-400',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-800 mt-1" style={{ minHeight: 24 }} />}
      </div>

      <div
        className={cn(
          'rounded-lg border p-3 mb-3 bg-slate-900/40',
          step.type === 'error' ? 'border-rose-500/30' : 'border-slate-800',
        )}
      >
        <button
          onClick={() => hasDetails && setOpen(v => !v)}
          className={cn('w-full text-left', hasDetails && 'cursor-pointer')}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-[10px] font-semibold', meta.color, 'border-current/30')}>
              {meta.label}
            </Badge>
            <span className="text-xs text-slate-500 font-mono">
              #{step.stepIndex}
            </span>
            <span className="text-xs text-slate-500">
              {new Date(step.timestamp).toLocaleTimeString()}
            </span>
            {step.durationMs !== undefined && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Timer className="h-3 w-3" />
                {formatMs(step.durationMs)}
              </span>
            )}
            {step.causalParentSteps.length > 0 && (
              <span className="text-xs text-slate-600">
                ← {step.causalParentSteps.length} parent{step.causalParentSteps.length > 1 ? 's' : ''}
              </span>
            )}
            {hasDetails && (
              <span className="ml-auto text-slate-500">
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
            )}
          </div>

          {/* Quick preview */}
          {!open && (
            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 font-mono">
              {step.error
                ? step.error
                : step.llmCall
                  ? `${step.llmCall.provider}/${step.llmCall.model} · ${step.llmCall.tokensIn + step.llmCall.tokensOut} tokens`
                  : truncate(step.action ?? step.observation ?? step.result, 140)}
            </p>
          )}
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            {step.error && (
              <div className="rounded-md bg-rose-500/5 border border-rose-500/30 p-2 text-xs text-rose-300 font-mono">
                {step.error}
              </div>
            )}

            {step.observation !== undefined && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Observation</p>
                <JSONBlock data={step.observation} />
              </div>
            )}

            {step.action !== undefined && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Action</p>
                <JSONBlock data={step.action} />
              </div>
            )}

            {step.llmCall && <StepLLMCallDetails call={step.llmCall} />}
            {step.toolCall && <StepToolCallDetails call={step.toolCall} />}

            {step.result !== undefined && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Result</p>
                <JSONBlock data={step.result} />
              </div>
            )}

            {step.reward !== undefined && (
              <div className="text-xs">
                <span className="text-slate-500">Step reward:</span>{' '}
                <span className={step.reward >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {step.reward.toFixed(3)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface TrajectoryTimelineProps {
  trajectory: Trajectory;
  className?: string;
}

/**
 * Vertical timeline of all steps in a trajectory.
 * Each step expands on click to show observation/action/result, and for
 * llm_call steps: provider, model, tokens, cost, prompt, response.
 */
export function TrajectoryTimeline({ trajectory, className }: TrajectoryTimelineProps) {
  const steps = trajectory.steps ?? [];
  const metrics = trajectory.metrics;

  return (
    <div className={cn('space-y-1', className)}>
      {/* Summary header */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <Badge variant="outline" className="border-slate-700 text-slate-300">
          <Database className="h-3 w-3 mr-1" />
          {metrics.stepCount} steps
        </Badge>
        <Badge variant="outline" className="border-slate-700 text-slate-300">
          <Cloud className="h-3 w-3 mr-1" />
          {metrics.llmCallCount} LLM calls
        </Badge>
        <Badge variant="outline" className="border-slate-700 text-slate-300">
          <Zap className="h-3 w-3 mr-1" />
          {metrics.toolCallCount} tool calls
        </Badge>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
          <Code className="h-3 w-3 mr-1" />
          {metrics.totalTokens.toLocaleString()} tokens
        </Badge>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
          <DollarSign className="h-3 w-3 mr-1" />
          ${metrics.estimatedCost.toFixed(4)}
        </Badge>
        {metrics.errorCount > 0 && (
          <Badge variant="outline" className="border-rose-500/30 text-rose-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            {metrics.errorCount} errors
          </Badge>
        )}
        <Badge variant="outline" className="border-slate-700 text-slate-300">
          <Timer className="h-3 w-3 mr-1" />
          {formatMs(metrics.totalDurationMs)}
        </Badge>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No steps recorded for this trajectory.</p>
      ) : (
        steps.map((step, i) => (
          <StepCard key={step.id ?? i} step={step} isLast={i === steps.length - 1} />
        ))
      )}
    </div>
  );
}
