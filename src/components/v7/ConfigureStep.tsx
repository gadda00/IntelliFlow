'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Zap, Settings2, Database, Target, Calendar, MessageSquare, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { V7AnalysisConfig } from '@/hooks/useV7Analysis';

interface ConfigureStepProps {
  data: Record<string, any>[];
  fileName: string;
  onBack: () => void;
  onConfigure: (config: V7AnalysisConfig) => void;
}

const PRESETS = [
  {
    id: 'full',
    name: 'Full Pipeline',
    description: 'All 50 agents — complete analysis',
    icon: Layers,
    config: {},
  },
  {
    id: 'forecast',
    name: 'Forecast Focus',
    description: 'Time series forecasting + anomalies',
    icon: Zap,
    config: { forecastHorizon: 12, seasonLength: 12 },
  },
  {
    id: 'fraud',
    name: 'Fraud & Anomaly',
    description: 'Anomaly detection + fraud rules',
    icon: Target,
    config: { anomalyThreshold: 2.5 },
  },
  {
    id: 'quick',
    name: 'Quick Insights',
    description: 'Fast path — just the essentials',
    icon: Sparkles,
    config: { forecastHorizon: 6 },
  },
];

export function ConfigureStep({ data, fileName, onBack, onConfigure }: ConfigureStepProps) {
  const [targetColumn, setTargetColumn] = useState('');
  const [timeColumn, setTimeColumn] = useState('');
  const [nlqQuery, setNlqQuery] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState(6);
  const [selectedPreset, setSelectedPreset] = useState('full');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Analyze data to suggest columns
  const columnInfo = useMemo(() => {
    if (!data.length) return { columns: [], numericColumns: [], timeColumns: [], preview: [] };
    const columns = Object.keys(data[0]);
    const numericColumns: string[] = [];
    const timeColumns: string[] = [];

    for (const col of columns) {
      const values = data.slice(0, 20).map(r => r[col]);
      const numericCount = values.filter(v => !isNaN(Number(v)) && v !== null && v !== '').length;
      if (numericCount / values.length > 0.7) {
        numericColumns.push(col);
      }
      const dateCount = values.filter(v => !isNaN(Date.parse(String(v))) && String(v).length >= 8).length;
      if (dateCount / values.length > 0.7) {
        timeColumns.push(col);
      }
    }

    return {
      columns,
      numericColumns,
      timeColumns,
      preview: data.slice(0, 5),
    };
  }, [data]);

  const handleStart = () => {
    const preset = PRESETS.find(p => p.id === selectedPreset);
    const config: V7AnalysisConfig = {
      ...preset?.config,
      targetColumn: targetColumn || undefined,
      timeColumn: timeColumn || undefined,
      nlqQuery: nlqQuery || undefined,
      forecastHorizon,
      fileName,
    };
    onConfigure(config);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Data Summary */}
      <Card className="p-5 border-border/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {data.length} rows · {columnInfo.columns.length} columns ·{' '}
                {columnInfo.numericColumns.length} numeric · {columnInfo.timeColumns.length} datetime
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Change Data
          </Button>
        </div>

        {/* Data Preview */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/30">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {columnInfo.columns.slice(0, 8).map(col => (
                  <th key={col} className="text-left py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columnInfo.preview.map((row, i) => (
                <tr key={i} className="border-t border-border/20">
                  {columnInfo.columns.slice(0, 8).map(col => (
                    <td key={col} className="py-1.5 px-3 truncate max-w-[120px]">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Preset Selection */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Analysis Preset
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PRESETS.map(preset => (
            <motion.button
              key={preset.id}
              whileHover={{ y: -2 }}
              onClick={() => setSelectedPreset(preset.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                selectedPreset === preset.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/40 hover:border-primary/30'
              }`}
            >
              <preset.icon className={`h-5 w-5 mb-2 ${selectedPreset === preset.id ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="font-medium text-sm mb-0.5">{preset.name}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-2">{preset.description}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Optional Configuration */}
      <Card className="p-5 border-border/30">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Advanced Configuration</h3>
            <Badge variant="secondary" className="text-[9px]">Optional</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{showAdvanced ? 'Hide' : 'Show'}</span>
        </button>

        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-4 space-y-4"
          >
            {/* Target Column */}
            <div>
              <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                <Target className="h-3 w-3" />
                Target Column (for forecasting & regression)
              </Label>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">Auto-detect</option>
                {columnInfo.numericColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Time Column */}
            <div>
              <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                <Calendar className="h-3 w-3" />
                Time Column (for time series analysis)
              </Label>
              <select
                value={timeColumn}
                onChange={(e) => setTimeColumn(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">Auto-detect</option>
                {columnInfo.timeColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Forecast Horizon */}
            <div>
              <Label className="text-xs mb-1.5 block">Forecast Horizon (periods)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={forecastHorizon}
                onChange={(e) => setForecastHorizon(parseInt(e.target.value) || 6)}
                className="w-32"
              />
            </div>

            {/* NLQ Query */}
            <div>
              <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="h-3 w-3" />
                Natural Language Question (optional)
              </Label>
              <Input
                placeholder="e.g., What's driving sales? Forecast next 6 months."
                value={nlqQuery}
                onChange={(e) => setNlqQuery(e.target.value)}
              />
            </div>
          </motion.div>
        )}
      </Card>

      {/* Start Button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button size="lg" onClick={handleStart} className="gap-2 shadow-lg shadow-primary/20">
          <Zap className="h-4 w-4" />
          Run 50-Agent Analysis
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
