'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Zap, AlertCircle, CheckCircle2, X, Sparkles, Database, Globe, Hash, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, AnalysisResult, storage } from '@/lib/api-client';
import { parseCSVText } from '@/lib/parsers-client';
import { AgentDAGVisualizer } from './AgentDAGVisualizer';
import { AnalysisResultsView } from './AnalysisResultsView';
import { WorkflowComposer } from './WorkflowComposer';
import { VoiceInput } from './VoiceInput';

const SAMPLE_DATA = `product,category,sales,quantity,region,date
Widget A,Electronics,1200,30,North,2024-01-15
Widget B,Electronics,1850,42,South,2024-01-16
Gadget X,Tools,950,18,East,2024-01-17
Gadget Y,Tools,1450,28,West,2024-01-18
Widget A,Electronics,1320,33,North,2024-01-19
Widget C,Electronics,2100,55,South,2024-01-20
Gadget X,Tools,880,15,East,2024-01-21
Widget B,Electronics,1920,48,West,2024-01-22
Widget A,Electronics,1250,32,North,2024-01-23
Gadget Z,Tools,1650,35,South,2024-01-24
Widget C,Electronics,2300,62,East,2024-01-25
Widget B,Electronics,2050,52,West,2024-01-26
Widget A,Electronics,1380,36,North,2024-01-27
Gadget X,Tools,990,19,East,2024-01-28
Widget C,Electronics,2450,68,South,2024-01-29
Widget B,Electronics,2150,55,West,2024-01-30
Widget A,Electronics,1420,38,North,2024-01-31
Gadget Z,Tools,1750,38,South,2024-02-01
Widget C,Electronics,2600,72,East,2024-02-02
Widget B,Electronics,2280,59,West,2024-02-03`;

type UploadTab = 'file' | 'paste' | 'url' | 'sample';

export function Analyzer() {
  const [activeTab, setActiveTab] = useState<UploadTab>('sample');
  const [fileContents, setFileContents] = useState<any[]>([]);
  const [rawFileName, setRawFileName] = useState<string>('');
  const [rawFileText, setRawFileText] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [pasteText, setPasteText] = useState<string>('');
  const [nlqQuery, setNlqQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeAgents, setActiveAgents] = useState<Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>>({});
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setRawFileName(file.name);
    const text = await file.text();
    setRawFileText(text);
    try {
      let rows: any[] = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.rows ?? [parsed]);
      } else {
        rows = parseCSVText(text);
      }
      setFileContents(rows);
    } catch (err: any) {
      setError(`Failed to parse file: ${err.message}`);
      setFileContents([]);
    }
  }, []);

  const loadSample = () => {
    setRawFileName('sample_sales_data.csv');
    setRawFileText(SAMPLE_DATA);
    setFileContents(parseCSVText(SAMPLE_DATA));
    setError(null);
  };

  const handleUrlFetch = async () => {
    setError(null);
    if (!urlInput) {
      setError('Enter a URL');
      return;
    }
    try {
      // Server-side fetch through our API
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput, analysisConfig: {} }),
      }).then(r => r.json()).catch(() => null);

      // Better: fetch directly through a CORS proxy if needed
      const direct = await fetch(urlInput).then(r => r.text()).catch(() => null);
      if (!direct) {
        setError('Could not fetch URL (CORS may block browser fetch). Try downloading and uploading as a file.');
        return;
      }
      const fileName = urlInput.split('/').pop() ?? 'data.csv';
      setRawFileName(fileName);
      setRawFileText(direct);
      let rows: any[] = [];
      if (fileName.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(direct);
        rows = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.rows ?? [parsed]);
      } else {
        rows = parseCSVText(direct);
      }
      setFileContents(rows);
    } catch (err: any) {
      setError(`URL fetch failed: ${err.message}`);
    }
  };

  const [selectedAgents, setSelectedAgents] = useState<string[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [streamingLog, setStreamingLog] = useState<string[]>([]);

  const runAnalysis = async (agentIds?: string[]) => {
    setError(null);
    if (!fileContents.length) {
      setError('No data loaded. Use a tab above to load data first.');
      return;
    }
    const agentsToUse = agentIds ?? selectedAgents;
    setIsRunning(true);
    setProgress(0);
    setActiveAgents({});
    setResult(null);
    setStreamingLog([]);

    // If streaming is enabled, use SSE endpoint for real-time updates
    if (useStreaming) {
      try {
        const response = await fetch('/api/analyze-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileContents,
            analysisConfig: { fileName: rawFileName },
            nlqQuery: nlqQuery || undefined,
            enabledAgents: agentsToUse && agentsToUse.length > 0 ? agentsToUse : undefined,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Streaming failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const completedAgents = new Set<string>();
        const totalAgents = 23;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));

                if (currentEvent === 'connected') {
                  setStreamingLog(prev => [...prev, `✓ Connected — analysis ${data.analysisId} started`]);
                } else if (currentEvent === 'agent_update') {
                  const { agentId, agentName, status, stage, durationMs } = data;
                  setActiveAgents(prev => ({ ...prev, [agentId]: status }));

                  if (status === 'completed') {
                    completedAgents.add(agentId);
                    setProgress(Math.round((completedAgents.size / totalAgents) * 100));
                    setStreamingLog(prev => [...prev, `✓ ${agentName} completed (${durationMs}ms)`]);
                  } else if (status === 'running') {
                    setStreamingLog(prev => [...prev, `▶ ${agentName} running...`]);
                  } else if (status === 'failed') {
                    setStreamingLog(prev => [...prev, `✗ ${agentName} failed: ${data.error || ''}`]);
                  }
                } else if (currentEvent === 'complete') {
                  setProgress(100);
                  setStreamingLog(prev => [...prev, `✓ Pipeline complete: ${data.execution.agentsSucceeded} succeeded, ${data.execution.agentsFailed} failed in ${data.totalDurationMs}ms`]);
                  setResult(data);
                  storage.addToHistory({
                    id: data.analysisId,
                    name: rawFileName || 'Analysis',
                    timestamp: new Date().toISOString(),
                    rowCount: fileContents.length,
                    status: data.status,
                  });
                  setIsRunning(false);
                } else if (currentEvent === 'error') {
                  setError(data.error);
                  setIsRunning(false);
                }
              } catch (e) {
                // ignore JSON parse errors for partial chunks
              }
              currentEvent = '';
            }
          }
        }
        return;
      } catch (err: any) {
        console.warn('Streaming failed, falling back to regular API:', err);
        // Fall through to non-streaming
      }
    }

    // Non-streaming fallback (original code)
    const stages = [
      { agents: ['data_scout', 'data_quality_guardian', 'nlq_interpreter', 'privacy_guardian'], duration: 600 },
      { agents: ['data_engineer'], duration: 800 },
      { agents: ['analysis_strategist', 'anomaly_sentinel', 'forecasting_oracle', 'causal_architect', 'knowledge_graph_builder', 'benchmark_agent', 'auto_ml_agent', 'nlp_sentiment_analyst', 'graph_neural_network'], duration: 1400 },
      { agents: ['insight_generator', 'explainability_agent', 'visualization_specialist', 'synthetic_data_generator', 'code_generator', 'anomaly_forecasting'], duration: 1100 },
      { agents: ['narrative_composer', 'conversational_analyst'], duration: 800 },
      { agents: ['orchestrator'], duration: 500 },
    ];

    const visualPromise = (async () => {
      const initial: Record<string, any> = {};
      stages.forEach(s => s.agents.forEach(a => initial[a] = 'pending'));
      setActiveAgents(initial);

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        for (const agent of stage.agents) {
          setActiveAgents(prev => ({ ...prev, [agent]: 'running' }));
          await new Promise(r => setTimeout(r, stage.duration / stage.agents.length));
          setActiveAgents(prev => ({ ...prev, [agent]: 'completed' }));
        }
        setProgress(((i + 1) / stages.length) * 100);
      }
    })();

    try {
      const [analysisResult] = await Promise.all([
        api.analyze({
          fileContents,
          analysisConfig: { fileName: rawFileName },
          nlqQuery: nlqQuery || undefined,
          enabledAgents: agentsToUse && agentsToUse.length > 0 ? agentsToUse : undefined,
        }),
        visualPromise,
      ]);

      if (analysisResult.error) {
        setError(analysisResult.error);
      } else {
        setResult(analysisResult);
        storage.addToHistory({
          id: analysisResult.analysisId,
          name: rawFileName || 'Analysis',
          timestamp: new Date().toISOString(),
          rowCount: fileContents.length,
          status: analysisResult.status,
        });
      }
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed');
      // Mark remaining agents as failed
      setActiveAgents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          if (updated[k] === 'running' || updated[k] === 'pending') updated[k] = 'failed';
        });
        return updated;
      });
    } finally {
      setIsRunning(false);
    }
  };

  const reset = () => {
    setFileContents([]);
    setRawFileName('');
    setRawFileText('');
    setUrlInput('');
    setPasteText('');
    setNlqQuery('');
    setError(null);
    setResult(null);
    setProgress(0);
    setActiveAgents({});
  };

  return (
    <section id="analyze" className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <Badge variant="secondary" className="mb-3">Live Analysis</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Drop your data.<br />
            <span className="gradient-text">Watch it think.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload a CSV or JSON, paste data, fetch a URL, or use our sample.
            All 20+ AI agents run in parallel on real data — no mocks.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          {!result ? (
            <Card className="p-6 md:p-8">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UploadTab)}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="sample" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Sample</TabsTrigger>
                  <TabsTrigger value="file" className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Upload</TabsTrigger>
                  <TabsTrigger value="paste" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Paste</TabsTrigger>
                  <TabsTrigger value="url" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> URL</TabsTrigger>
                </TabsList>

                <TabsContent value="sample" className="space-y-4">
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                    <Database className="h-10 w-10 mx-auto mb-3 text-primary" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Try Busara with a sample e-commerce sales dataset (20 rows × 6 columns).
                    </p>
                    <Button onClick={loadSample} variant="outline" disabled={isRunning}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Load Sample Data
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="file" className="space-y-4">
                  <div
                    className={`rounded-lg border-2 border-dashed p-8 text-center transition-all ${
                      dragOver ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleFile(file);
                    }}
                  >
                    <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">Drag & drop your file here</p>
                    <p className="text-xs text-muted-foreground mb-4">CSV, TSV, or JSON · up to 50,000 rows</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.tsv,.json,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                      Browse Files
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="paste" className="space-y-3">
                  <Label htmlFor="paste-data">Paste CSV or JSON data</Label>
                  <Textarea
                    id="paste-data"
                    placeholder="product,category,sales&#10;Widget A,Electronics,1200&#10;Widget B,Electronics,1850"
                    className="font-mono text-xs min-h-[200px]"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      try {
                        let rows: any[] = [];
                        const trimmed = pasteText.trim();
                        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                          const parsed = JSON.parse(trimmed);
                          rows = Array.isArray(parsed) ? parsed : [parsed];
                        } else {
                          rows = parseCSVText(trimmed);
                        }
                        setFileContents(rows);
                        setRawFileName('pasted_data.csv');
                        setRawFileText(pasteText);
                        setError(null);
                      } catch (err: any) {
                        setError(`Parse error: ${err.message}`);
                      }
                    }}
                    variant="outline"
                    disabled={!pasteText || isRunning}
                  >
                    Parse Data
                  </Button>
                </TabsContent>

                <TabsContent value="url" className="space-y-3">
                  <Label htmlFor="url-input">Fetch data from a URL</Label>
                  <Input
                    id="url-input"
                    placeholder="https://example.com/data.csv"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Direct link to a CSV or JSON file. CORS-enabled URLs only — for others, download & upload.
                  </p>
                  <Button onClick={handleUrlFetch} variant="outline" disabled={!urlInput || isRunning}>
                    Fetch Data
                  </Button>
                </TabsContent>
              </Tabs>

              {/* Loaded data preview */}
              {fileContents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{rawFileName}</span>
                      <Badge variant="secondary" className="text-xs">
                        <Hash className="h-3 w-3 mr-1" />
                        {fileContents.length} rows · {Object.keys(fileContents[0]).length} cols
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setFileContents([])}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {Object.keys(fileContents[0]).slice(0, 6).map(col => (
                            <th key={col} className="text-left py-1.5 px-2 font-medium text-muted-foreground">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fileContents.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-border/40">
                            {Object.keys(fileContents[0]).slice(0, 6).map(col => (
                              <td key={col} className="py-1.5 px-2 truncate max-w-[120px]">{String(row[col] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* Optional NLQ */}
              {fileContents.length > 0 && (
                <div className="mt-4">
                  <Label htmlFor="nlq" className="text-xs text-muted-foreground">
                    Optional: Ask a question in plain English
                  </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="nlq"
                    placeholder="e.g., What's driving sales? Forecast next 6 months."
                    value={nlqQuery}
                    onChange={(e) => setNlqQuery(e.target.value)}
                    className="flex-1"
                  />
                  <VoiceInput onTranscript={(text) => setNlqQuery(prev => (prev ? prev + ' ' : '') + text)} />
                </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="flex-1 gap-2"
                  onClick={() => runAnalysis()}
                  disabled={isRunning || !fileContents.length}
                >
                  <Zap className="h-4 w-4" />
                  {isRunning ? 'Running 23 Agents...' : selectedAgents && selectedAgents.length > 0 ? `Run ${selectedAgents.length} Selected Agents` : 'Run Full Analysis'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setComposerOpen(true)}
                  disabled={isRunning || !fileContents.length}
                  className="gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  Compose
                </Button>
                {(fileContents.length > 0 || result) && (
                  <Button variant="outline" size="lg" onClick={reset} disabled={isRunning}>
                    Reset
                  </Button>
                )}
              </div>

              {selectedAgents && selectedAgents.length > 0 && !isRunning && (
                <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                  <span className="text-primary font-medium">{selectedAgents.length} agents selected</span> via Workflow Composer · dependencies auto-included
                  <button onClick={() => setSelectedAgents(null)} className="ml-2 text-primary hover:underline">clear</button>
                </div>
              )}

              {isRunning && (
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pipeline progress {useStreaming && <Badge variant="secondary" className="ml-2 text-[10px]">SSE Live</Badge>}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                  <AgentDAGVisualizer agentStatuses={activeAgents} />
                  {useStreaming && streamingLog.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border max-h-32 overflow-y-auto scrollbar-thin font-mono text-[11px] space-y-0.5">
                      {streamingLog.slice(-12).map((line, i) => (
                        <div key={i} className={line.startsWith('✗') ? 'text-destructive' : line.startsWith('✓') ? 'text-primary' : 'text-muted-foreground'}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <AnalysisResultsView
              result={result}
              fileContents={fileContents}
              onReset={reset}
            />
          )}
        </div>
      </div>

      <WorkflowComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onApply={(agentIds) => {
          setSelectedAgents(agentIds);
          runAnalysis(agentIds);
        }}
      />
    </section>
  );
}
