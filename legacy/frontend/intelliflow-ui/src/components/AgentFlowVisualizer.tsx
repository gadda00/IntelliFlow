import React, { useEffect, useRef, useState } from 'react';

interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
  progress: number;
  duration_ms?: number;
  tier: 'core' | 'advanced';
}

interface Props {
  agentUpdates: Record<string, AgentStatus>;
  isAnalysing: boolean;
}

const AGENTS: AgentStatus[] = [
  // Stage 0
  { id: 'data_quality_guardian', name: 'Data Quality Guardian', status: 'idle', progress: 0, tier: 'advanced' },
  { id: 'data_scout', name: 'Data Scout', status: 'idle', progress: 0, tier: 'core' },
  { id: 'nlq_interpreter', name: 'NLQ Interpreter', status: 'idle', progress: 0, tier: 'advanced' },
  // Stage 1
  { id: 'data_engineer', name: 'Data Engineer', status: 'idle', progress: 0, tier: 'core' },
  // Stage 2
  { id: 'analysis_strategist', name: 'Analysis Strategist', status: 'idle', progress: 0, tier: 'core' },
  { id: 'anomaly_sentinel', name: 'Anomaly Sentinel', status: 'idle', progress: 0, tier: 'advanced' },
  { id: 'forecasting_oracle', name: 'Forecasting Oracle', status: 'idle', progress: 0, tier: 'advanced' },
  { id: 'causal_architect', name: 'Causal Architect', status: 'idle', progress: 0, tier: 'advanced' },
  // Stage 3
  { id: 'insight_generator', name: 'Insight Generator', status: 'idle', progress: 0, tier: 'core' },
  { id: 'visualization_specialist', name: 'Viz Specialist', status: 'idle', progress: 0, tier: 'core' },
  // Stage 4
  { id: 'narrative_composer', name: 'Narrative Composer', status: 'idle', progress: 0, tier: 'core' },
  // Stage 5
  { id: 'orchestrator', name: 'Orchestrator', status: 'idle', progress: 0, tier: 'core' },
];

const statusConfig = {
  idle: { color: '#334155', ring: '#475569', icon: '○', label: 'Idle' },
  running: { color: '#1d4ed8', ring: '#3b82f6', icon: '◉', label: 'Running' },
  completed: { color: '#15803d', ring: '#22c55e', icon: '✓', label: 'Done' },
  error: { color: '#b91c1c', ring: '#ef4444', icon: '✗', label: 'Error' },
  skipped: { color: '#78350f', ring: '#f59e0b', icon: '⊘', label: 'Skipped' },
};

const tierConfig = {
  core: { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', label: 'Core' },
  advanced: { bg: 'rgba(168,85,247,0.08)', border: '#a855f7', label: 'Advanced' },
};

export const AgentFlowVisualizer: React.FC<Props> = ({ agentUpdates, isAnalysing }) => {
  const [agents, setAgents] = useState<AgentStatus[]>(AGENTS);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAnalysing) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 0.1), 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isAnalysing]);

  useEffect(() => {
    if (Object.keys(agentUpdates).length === 0) {
      setAgents(AGENTS.map(a => ({ ...a, status: 'idle', progress: 0 })));
      return;
    }
    setAgents(prev =>
      prev.map(agent => {
        const update = agentUpdates[agent.id];
        if (update) return { ...agent, ...update };
        return agent;
      })
    );
  }, [agentUpdates]);

  const completedCount = agents.filter(a => a.status === 'completed').length;
  const totalCount = agents.length;
  const overallProgress = (completedCount / totalCount) * 100;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      borderRadius: 16,
      padding: 24,
      border: '1px solid #334155',
      fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ color: '#f1f5f9', margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
            🤖 Agent Pipeline
          </h3>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 12 }}>
            12 specialized agents · parallel execution
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          {isAnalysing && (
            <div style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600 }}>
              ⏱ {elapsed.toFixed(1)}s
            </div>
          )}
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {completedCount}/{totalCount} complete
          </div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          height: 4,
          background: '#1e293b',
          borderRadius: 2,
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${overallProgress}%`,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
            borderRadius: 2,
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Agent grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 10
      }}>
        {agents.map(agent => {
          const sc = statusConfig[agent.status];
          const tc = tierConfig[agent.tier];
          const isRunning = agent.status === 'running';

          return (
            <div
              key={agent.id}
              style={{
                background: tc.bg,
                border: `1px solid ${isRunning ? sc.ring : tc.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'border-color 0.3s ease, transform 0.2s ease',
                transform: isRunning ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isRunning ? `0 0 16px ${sc.ring}44` : 'none'
              }}
            >
              {/* Running pulse animation */}
              {isRunning && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(90deg, transparent 0%, ${sc.ring}22 50%, transparent 100%)`,
                  animation: 'shimmer 1.5s infinite',
                  pointerEvents: 'none'
                }} />
              )}

              {/* Status icon */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{
                  fontSize: 16,
                  color: sc.ring,
                  animation: isRunning ? 'spin 2s linear infinite' : 'none'
                }}>
                  {sc.icon}
                </span>
                <span style={{
                  fontSize: 9,
                  color: tc.border,
                  background: `${tc.border}22`,
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {agent.tier}
                </span>
              </div>

              {/* Agent name */}
              <div style={{
                color: '#e2e8f0',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1.3,
                marginBottom: 6
              }}>
                {agent.name}
              </div>

              {/* Status label */}
              <div style={{ color: sc.ring, fontSize: 10, fontWeight: 500 }}>
                {sc.label}
                {agent.duration_ms && agent.status === 'completed' && (
                  <span style={{ color: '#64748b', marginLeft: 4 }}>
                    {agent.duration_ms < 1000
                      ? `${agent.duration_ms.toFixed(0)}ms`
                      : `${(agent.duration_ms / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>

              {/* Progress micro-bar */}
              {(isRunning || agent.progress > 0) && (
                <div style={{
                  marginTop: 8,
                  height: 2,
                  background: '#1e293b',
                  borderRadius: 1,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: isRunning ? '60%' : `${agent.progress}%`,
                    background: sc.ring,
                    borderRadius: 1,
                    animation: isRunning ? 'progress-pulse 1.5s ease infinite' : 'none',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(statusConfig).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: val.ring, fontSize: 12 }}>{val.icon}</span>
            <span style={{ color: '#64748b', fontSize: 11 }}>{val.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes progress-pulse {
          0%, 100% { opacity: 0.6; width: 30%; }
          50% { opacity: 1; width: 70%; }
        }
      `}</style>
    </div>
  );
};

export default AgentFlowVisualizer;
