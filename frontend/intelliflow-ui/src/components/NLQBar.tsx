import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface NLQSuggestion {
  text: string;
  icon: string;
  category: string;
}

interface NLQResult {
  intent: string;
  analysis_type: string;
  explanation: string;
  suggested_visualizations: string[];
  target_metric?: string;
  confidence: string;
}

interface Props {
  onSubmit: (query: string, plan: NLQResult | null) => void;
  isLoading?: boolean;
  columns?: string[];
  placeholder?: string;
}

const SUGGESTIONS: NLQSuggestion[] = [
  { text: "Show me trends over time", icon: "📈", category: "Trend" },
  { text: "What's causing revenue to drop?", icon: "🔍", category: "Causal" },
  { text: "Detect anomalies in my data", icon: "🚨", category: "Anomaly" },
  { text: "Predict the next 12 months", icon: "🔮", category: "Forecast" },
  { text: "How is my data quality?", icon: "✅", category: "Quality" },
  { text: "Find correlations between columns", icon: "🔗", category: "Correlation" },
  { text: "Compare performance by region", icon: "🌍", category: "Compare" },
  { text: "Summarise this dataset", icon: "📊", category: "Summary" },
];

const intentColors: Record<string, string> = {
  forecast: '#8b5cf6',
  anomaly_detection: '#ef4444',
  causal_analysis: '#f59e0b',
  trend_analysis: '#3b82f6',
  correlation_analysis: '#10b981',
  comparative_analysis: '#6366f1',
  distribution_analysis: '#0ea5e9',
  segmentation: '#f97316',
  summary: '#14b8a6',
  data_quality: '#22c55e',
};

export const NLQBar: React.FC<Props> = ({
  onSubmit,
  isLoading = false,
  columns = [],
  placeholder = 'Ask anything about your data… e.g. "What drives sales?"'
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nlqResult, setNlqResult] = useState<NLQResult | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [query]);

  // Debounced NLQ interpretation as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length > 10) {
      debounceRef.current = setTimeout(() => interpretQuery(query), 600);
    } else {
      setNlqResult(null);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const interpretQuery = async (q: string) => {
    setIsInterpreting(true);
    setError(null);
    try {
      const res = await fetch('/api/nlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, context: { columns } })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setNlqResult(data.analysis_plan);
      }
    } catch {
      // Silent — don't block UX if NLQ fails
    } finally {
      setIsInterpreting(false);
    }
  };

  const handleSubmit = () => {
    if (!query.trim() || isLoading) return;
    setShowSuggestions(false);
    onSubmit(query.trim(), nlqResult);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestion = (s: NLQSuggestion) => {
    setQuery(s.text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const intentColor = nlqResult ? (intentColors[nlqResult.intent] || '#3b82f6') : '#3b82f6';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Main input container */}
      <div style={{
        background: isFocused
          ? 'rgba(15,23,42,0.95)'
          : 'rgba(15,23,42,0.8)',
        border: `1.5px solid ${isFocused ? intentColor : '#334155'}`,
        borderRadius: nlqResult && isFocused ? '14px 14px 0 0' : 14,
        padding: '14px 16px',
        transition: 'all 0.25s ease',
        boxShadow: isFocused ? `0 0 0 3px ${intentColor}22, 0 8px 32px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(12px)'
      }}>
        {/* Top row: icon + input */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Animated brain icon */}
          <div style={{
            fontSize: 20,
            lineHeight: '24px',
            marginTop: 2,
            filter: isInterpreting ? 'hue-rotate(60deg)' : 'none',
            transition: 'filter 0.3s ease',
            animation: isInterpreting ? 'brain-pulse 1s ease infinite' : 'none'
          }}>
            🧠
          </div>

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (!showSuggestions && e.target.value === '') setShowSuggestions(true);
            }}
            onFocus={() => {
              setIsFocused(true);
              if (!query) setShowSuggestions(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onKeyDown={handleKey}
            placeholder={placeholder}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f1f5f9',
              fontSize: 15,
              lineHeight: '1.6',
              resize: 'none',
              fontFamily: "'Inter', -apple-system, sans-serif",
              caretColor: intentColor
            }}
          />

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!query.trim() || isLoading}
            style={{
              background: query.trim() && !isLoading
                ? `linear-gradient(135deg, ${intentColor}, ${intentColor}cc)`
                : '#1e293b',
              border: 'none',
              borderRadius: 10,
              color: query.trim() && !isLoading ? '#fff' : '#475569',
              cursor: query.trim() && !isLoading ? 'pointer' : 'not-allowed',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              transform: query.trim() && !isLoading ? 'scale(1)' : 'scale(0.97)'
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Analysing…
              </span>
            ) : '⚡ Analyse'}
          </button>
        </div>

        {/* NLQ interpretation preview */}
        {nlqResult && query.trim().length > 10 && (
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap'
          }}>
            <span style={{
              background: `${intentColor}22`,
              color: intentColor,
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {nlqResult.analysis_type}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              {nlqResult.explanation}
            </span>
            {isInterpreting && (
              <span style={{ color: '#475569', fontSize: 11, marginLeft: 'auto' }}>
                interpreting…
              </span>
            )}
            <span style={{
              marginLeft: 'auto',
              color: nlqResult.confidence === 'high' ? '#22c55e' : '#f59e0b',
              fontSize: 11,
              fontWeight: 600
            }}>
              {nlqResult.confidence === 'high' ? '● high confidence' : '● medium confidence'}
            </span>
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && !query && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'rgba(15,23,42,0.98)',
          border: '1.5px solid #334155',
          borderTop: 'none',
          borderRadius: '0 0 14px 14px',
          padding: '8px 0',
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
        }}>
          <div style={{ padding: '4px 16px 8px', color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Quick questions
          </div>
          {SUGGESTIONS.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSuggestion(s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 16px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ color: '#cbd5e1', fontSize: 13 }}>{s.text}</span>
              <span style={{
                marginLeft: 'auto',
                color: '#475569',
                fontSize: 10,
                background: '#1e293b',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 600
              }}>{s.category}</span>
            </div>
          ))}
          <div style={{ padding: '8px 16px 4px', color: '#334155', fontSize: 11, borderTop: '1px solid #1e293b', marginTop: 4 }}>
            Press <kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '0 4px', borderRadius: 3, fontSize: 10 }}>↵ Enter</kbd> to analyse · <kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '0 4px', borderRadius: 3, fontSize: 10 }}>Shift+Enter</kbd> for new line
          </div>
        </div>
      )}

      <style>{`
        @keyframes brain-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NLQBar;
