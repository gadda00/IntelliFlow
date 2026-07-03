'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Globe, Database, CheckCircle2, Sparkles, ShoppingCart, Smartphone, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SAMPLE_DATASETS } from '@/lib/v7/sampleData';
import { parseCSVText } from '@/lib/parsers-client';

interface UploadStepProps {
  onDataLoaded: (data: Record<string, any>[], fileName: string) => void;
}

export function UploadStep({ onDataLoaded }: UploadStepProps) {
  const [activeTab, setActiveTab] = useState('sample');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const text = await file.text();
    try {
      let rows: Record<string, any>[] = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.rows ?? [parsed]);
      } else {
        rows = parseCSVText(text);
      }
      if (rows.length === 0) {
        setError('No data rows found in file');
        return;
      }
      onDataLoaded(rows, file.name);
    } catch (err: any) {
      setError(`Failed to parse file: ${err.message}`);
    }
  }, [onDataLoaded]);

  const handleSample = useCallback((datasetId: string) => {
    const dataset = SAMPLE_DATASETS.find(d => d.id === datasetId);
    if (dataset) {
      onDataLoaded(dataset.data, `${dataset.id}_sample.csv`);
    }
  }, [onDataLoaded]);

  const handlePaste = useCallback(() => {
    setError(null);
    try {
      let rows: Record<string, any>[] = [];
      const trimmed = pasteText.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        rows = parseCSVText(trimmed);
      }
      if (rows.length === 0) {
        setError('No data rows found');
        return;
      }
      onDataLoaded(rows, 'pasted_data.csv');
    } catch (err: any) {
      setError(`Parse error: ${err.message}`);
    }
  }, [pasteText, onDataLoaded]);

  const handleUrlFetch = useCallback(async () => {
    setError(null);
    if (!urlInput) {
      setError('Enter a URL');
      return;
    }
    try {
      const resp = await fetch(`/api/proxy-url?url=${encodeURIComponent(urlInput)}`);
      if (!resp.ok) throw new Error('Fetch failed');
      const text = await resp.text();
      let rows: Record<string, any>[] = [];
      const fileName = urlInput.split('/').pop() ?? 'data.csv';
      if (fileName.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : (parsed.data ?? [parsed]);
      } else {
        rows = parseCSVText(text);
      }
      onDataLoaded(rows, fileName);
    } catch (err: any) {
      setError(`URL fetch failed: ${err.message}`);
    }
  }, [urlInput, onDataLoaded]);

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-6 md:p-8 border-border/30 shadow-lg">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6 h-11">
            <TabsTrigger value="sample" className="gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" /> Sample</TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5 text-xs"><Upload className="h-3.5 w-3.5" /> Upload</TabsTrigger>
            <TabsTrigger value="paste" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Paste</TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" /> URL</TabsTrigger>
          </TabsList>

          {/* Sample Data Tab */}
          <TabsContent value="sample" className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold mb-1">Choose a sample dataset</h3>
              <p className="text-sm text-muted-foreground">Each dataset showcases different agent capabilities</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {SAMPLE_DATASETS.map((dataset, i) => {
                const icons: Record<string, any> = { ShoppingCart, Smartphone, HeartPulse };
                const Icon = icons[dataset.icon] ?? Database;
                return (
                  <motion.div
                    key={dataset.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card
                      className="p-5 cursor-pointer hover:shadow-xl hover:border-primary/40 transition-all group h-full"
                      onClick={() => handleSample(dataset.id)}
                    >
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h4 className="font-semibold mb-1">{dataset.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{dataset.description}</p>
                      <div className="space-y-1">
                        {dataset.highlights.map(h => (
                          <div key={h} className="flex items-center gap-1.5 text-[10px] text-foreground/70">
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px]">{dataset.data.length} rows</Badge>
                        <span className="text-xs text-primary font-medium group-hover:translate-x-0.5 transition-transform">Try it →</span>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* File Upload Tab */}
          <TabsContent value="file" className="space-y-4">
            <div
              className={`rounded-xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40'
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
              <div className={`h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors ${dragOver ? 'bg-primary/20' : 'bg-muted'}`}>
                <Upload className={`h-8 w-8 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <p className="text-sm font-medium mb-1">Drag & drop your file here</p>
              <p className="text-xs text-muted-foreground mb-4">CSV, TSV, or JSON — up to 50,000 rows</p>
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
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2">
                Browse Files
              </Button>
            </div>
          </TabsContent>

          {/* Paste Tab */}
          <TabsContent value="paste" className="space-y-3">
            <Label htmlFor="paste-data" className="text-xs text-muted-foreground">Paste CSV or JSON data</Label>
            <textarea
              id="paste-data"
              className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-background text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="product,category,sales&#10;Widget A,Electronics,1200&#10;Widget B,Electronics,1850"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button onClick={handlePaste} disabled={!pasteText.trim()} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Parse Data
            </Button>
          </TabsContent>

          {/* URL Tab */}
          <TabsContent value="url" className="space-y-3">
            <Label htmlFor="url-input" className="text-xs text-muted-foreground">Fetch data from a URL</Label>
            <Input
              id="url-input"
              placeholder="https://example.com/data.csv"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Direct link to CSV or JSON. CORS-enabled URLs only.</p>
            <Button onClick={handleUrlFetch} disabled={!urlInput} className="gap-2">
              <Globe className="h-4 w-4" />
              Fetch Data
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}
      </Card>
    </div>
  );
}
