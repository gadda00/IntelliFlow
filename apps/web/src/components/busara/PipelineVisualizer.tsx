'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge,
  NodeChange, applyNodeChanges, MarkerType,
} from 'reactflow';
import { motion } from 'framer-motion';
import 'reactflow/dist/style.css';

// ─── Types ─────────────────────────────────────────────────────────────

export type AgentNodeStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';

export interface AgentNodeData {
  label: string;
  status: AgentNodeStatus;
  stage: string;
  tier: string;
  metrics?: Record<string, number>;
  executionTimeMs?: number;
  error?: string;
  color: string;
  icon?: string;
}

export interface PipelineAgent {
  id: string;
  name: string;
  stage: string;
  stageNumber: number;
  dependencies: string[];
  tier: string;
  color: string;
  icon: string;
}

// ─── Stage Layout Configuration ────────────────────────────────────────

const STAGE_POSITIONS: Record<string, { x: number; y: number }> = {
  ingest: { x: 0, y: 0 },
  engineer: { x: 350, y: 0 },
  detect: { x: 700, y: 0 },
  forecast: { x: 1050, y: 0 },
  infer: { x: 1400, y: 0 },
  report: { x: 1750, y: 0 },
  final: { x: 2100, y: 0 },
};

const STAGE_LABELS: Record<string, string> = {
  ingest: 'Stage 0: Ingest',
  engineer: 'Stage 1: Engineer',
  detect: 'Stage 2: Detect',
  forecast: 'Stage 3: Forecast',
  infer: 'Stage 4: Infer',
  report: 'Stage 5: Report',
  final: 'Stage 6: Final',
};

// ─── Custom Node Component ─────────────────────────────────────────────

function AgentNode({ data }: { data: AgentNodeData }) {
  const statusColors: Record<AgentNodeStatus, string> = {
    idle: '#94a3b8',
    pending: '#f59e0b',
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    skipped: '#6b7280',
    timeout: '#f97316',
  };

  const statusIcons: Record<AgentNodeStatus, string> = {
    idle: '○',
    pending: '◔',
    running: '◑',
    success: '✓',
    failed: '✗',
    skipped: '−',
    timeout: '⏱',
  };

  const color = statusColors[data.status] ?? data.color;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: data.status === 'running' ? 1.05 : 1,
      }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      <div
        className="px-3 py-2 rounded-lg border-2 shadow-lg backdrop-blur-sm min-w-[140px]"
        style={{
          borderColor: color,
          backgroundColor: `${color}15`,
          boxShadow: data.status === 'running'
            ? `0 0 20px ${color}80`
            : `0 2px 8px rgba(0,0,0,0.1)`,
        }}
      >
        {/* Status icon + name */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm font-bold"
            style={{ color }}
          >
            {data.status === 'running' ? '⟳' : statusIcons[data.status]}
          </span>
          <span className="text-xs font-semibold text-foreground truncate">
            {data.label}
          </span>
        </div>

        {/* Stage + tier badge */}
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {data.tier}
          </span>
        </div>

        {/* Execution time */}
        {data.executionTimeMs && data.executionTimeMs > 0 && (
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {data.executionTimeMs < 1000
              ? `${data.executionTimeMs}ms`
              : `${(data.executionTimeMs / 1000).toFixed(1)}s`}
          </div>
        )}

        {/* Error message */}
        {data.error && (
          <div className="text-[9px] text-destructive mt-0.5 truncate" title={data.error}>
            {data.error}
          </div>
        )}

        {/* Metrics */}
        {data.metrics && Object.keys(data.metrics).length > 0 && (
          <div className="mt-1 pt-1 border-t border-border/30">
            {Object.entries(data.metrics).slice(0, 2).map(([key, val]) => (
              <div key={key} className="text-[8px] text-muted-foreground">
                {key}: {typeof val === 'number' ? val.toFixed(2) : val}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pulsing ring for running agents */}
      {data.status === 'running' && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2"
          style={{ borderColor: color }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

const nodeTypes = { agentNode: AgentNode };

// ─── Main Pipeline Visualizer ──────────────────────────────────────────

interface PipelineVisualizerProps {
  agents: PipelineAgent[];
  agentStatuses: Record<string, AgentNodeStatus>;
  agentResults?: Record<string, any>;
  height?: number;
}

export function PipelineVisualizer({
  agents,
  agentStatuses,
  agentResults = {},
  height = 600,
}: PipelineVisualizerProps) {
  const [nodes, setNodes] = useState<Node<AgentNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Build nodes from agents
  const { computedNodes, computedEdges } = useMemo(() => {
    const computedNodes: Node<AgentNodeData>[] = [];
    const computedEdges: Edge[] = [];

    // Group agents by stage for layout
    const byStage: Record<string, PipelineAgent[]> = {};
    for (const agent of agents) {
      if (!byStage[agent.stage]) byStage[agent.stage] = [];
      byStage[agent.stage].push(agent);
    }

    // Position nodes in a grid within each stage
    for (const [stage, stageAgents] of Object.entries(byStage)) {
      const basePos = STAGE_POSITIONS[stage] ?? { x: 0, y: 0 };
      const colCount = Math.ceil(Math.sqrt(stageAgents.length));

      stageAgents.forEach((agent, idx) => {
        const col = idx % colCount;
        const row = Math.floor(idx / colCount);
        const status = agentStatuses[agent.id] ?? 'idle';
        const result = agentResults[agent.id];

        computedNodes.push({
          id: agent.id,
          type: 'agentNode',
          position: {
            x: basePos.x + col * 170,
            y: basePos.y + row * 130,
          },
          data: {
            label: agent.name,
            status,
            stage,
            tier: agent.tier,
            color: agent.color,
            metrics: result?.metrics,
            executionTimeMs: result?.executionTimeMs,
            error: result?.error,
          },
        });

        // Create edges from dependencies
        for (const dep of agent.dependencies) {
          computedEdges.push({
            id: `${dep}->${agent.id}`,
            source: dep,
            target: agent.id,
            animated: status === 'running' || agentStatuses[dep] === 'running',
            style: {
              stroke: status === 'success' ? '#10b981' : status === 'failed' ? '#ef4444' : '#94a3b8',
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: status === 'success' ? '#10b981' : status === 'failed' ? '#ef4444' : '#94a3b8',
            },
          });
        }
      });
    }

    return { computedNodes, computedEdges };
  }, [agents, agentStatuses, agentResults]);

  // Update nodes when computed nodes change
  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(nds => applyNodeChanges(changes, nds)),
    []
  );

  return (
    <div
      className="w-full rounded-2xl border border-border/30 overflow-hidden bg-background/50 backdrop-blur-sm"
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#94a3b8" gap={20} size={1} />
        <Controls className="bg-background/80 border-border/30" />
        <MiniMap
          className="bg-background/80 border-border/30"
          nodeColor={(node) => {
            const status = (node.data as AgentNodeData)?.status;
            const colors: Record<string, string> = {
              running: '#3b82f6',
              success: '#10b981',
              failed: '#ef4444',
              pending: '#f59e0b',
              skipped: '#6b7280',
              idle: '#94a3b8',
              timeout: '#f97316',
            };
            return colors[status ?? 'idle'] ?? '#94a3b8';
          }}
        />
      </ReactFlow>
    </div>
  );
}

// ─── Stage Legend ──────────────────────────────────────────────────────

export function PipelineLegend() {
  const statuses: { status: AgentNodeStatus; label: string; color: string }[] = [
    { status: 'idle', label: 'Idle', color: '#94a3b8' },
    { status: 'pending', label: 'Pending', color: '#f59e0b' },
    { status: 'running', label: 'Running', color: '#3b82f6' },
    { status: 'success', label: 'Success', color: '#10b981' },
    { status: 'failed', label: 'Failed', color: '#ef4444' },
    { status: 'skipped', label: 'Skipped', color: '#6b7280' },
    { status: 'timeout', label: 'Timeout', color: '#f97316' },
  ];

  return (
    <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg border border-border/30">
      {statuses.map(s => (
        <div key={s.status} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-full border-2"
            style={{ borderColor: s.color, backgroundColor: `${s.color}20` }}
          />
          <span className="text-xs text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stage Summary Bar ─────────────────────────────────────────────────

export function StageSummaryBar({
  agents,
  agentStatuses,
}: {
  agents: PipelineAgent[];
  agentStatuses: Record<string, AgentNodeStatus>;
}) {
  const stageCounts = useMemo(() => {
    const counts: Record<string, { total: number; byStatus: Record<string, number> }> = {};
    for (const agent of agents) {
      if (!counts[agent.stage]) {
        counts[agent.stage] = { total: 0, byStatus: {} };
      }
      counts[agent.stage].total++;
      const status = agentStatuses[agent.id] ?? 'idle';
      counts[agent.stage].byStatus[status] = (counts[agent.stage].byStatus[status] ?? 0) + 1;
    }
    return counts;
  }, [agents, agentStatuses]);

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border/30">
      {Object.entries(stageCounts).map(([stage, counts]) => {
        const success = counts.byStatus.success ?? 0;
        const running = counts.byStatus.running ?? 0;
        const failed = counts.byStatus.failed ?? 0;
        const progress = counts.total > 0 ? (success / counts.total) * 100 : 0;

        return (
          <div key={stage} className="flex-1 min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {STAGE_LABELS[stage] ?? stage}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {success}/{counts.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: failed > 0 ? '#ef4444' : running > 0 ? '#3b82f6' : '#10b981',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
