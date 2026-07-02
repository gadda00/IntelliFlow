'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, X, Zap, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useV7Analysis, V7AnalysisConfig } from '@/hooks/useV7Analysis';
import { UploadStep } from './UploadStep';
import { ConfigureStep } from './ConfigureStep';
import { PipelineStep } from './PipelineStep';
import { ResultsStep } from './ResultsStep';

type WizardStep = 'upload' | 'configure' | 'pipeline' | 'results';

const STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: 'upload', label: 'Upload Data', icon: Upload },
  { id: 'configure', label: 'Configure', icon: Zap },
  { id: 'pipeline', label: 'Pipeline', icon: Zap },
  { id: 'results', label: 'Results', icon: Check },
];

export function AnalyzePage() {
  const [step, setStep] = useState<WizardStep>('upload');
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState('');
  const [config, setConfig] = useState<V7AnalysisConfig>({});

  const analysis = useV7Analysis();

  const handleDataLoaded = useCallback((newData: Record<string, any>[], name: string) => {
    setData(newData);
    setFileName(name);
    setStep('configure');
  }, []);

  const handleConfigure = useCallback((newConfig: V7AnalysisConfig) => {
    setConfig(newConfig);
    setStep('pipeline');
    // Start the analysis
    analysis.startAnalysis(data, { ...newConfig, fileName });
  }, [data, analysis]);

  const handleRestart = useCallback(() => {
    analysis.reset();
    setData([]);
    setFileName('');
    setConfig({});
    setStep('upload');
  }, [analysis]);

  const handleBack = useCallback(() => {
    if (step === 'configure') setStep('upload');
    else if (step === 'pipeline' && !analysis.isStreaming && !analysis.isComplete) setStep('configure');
  }, [step, analysis]);

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3 border border-primary/20 bg-primary/5">
            <Zap className="h-3 w-3 mr-1 text-primary" />
            Busara v7.0 — 50-Agent Analysis
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Analysis Workspace
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
            Upload your data, configure the analysis, and watch 50 AI agents process it in real time.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {STEPS.map((s, i) => {
              const isActive = step === s.id;
              const isComplete = currentStepIndex > i;
              const isAccessible = i <= currentStepIndex;

              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : isComplete
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                      } ${!isAccessible ? 'opacity-40' : ''}`}
                    >
                      {isComplete ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <s.icon className="h-4 w-4" />
                      )}
                    </div>
                    <span className={`text-[10px] md:text-xs font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 md:mx-4 transition-colors duration-300 ${
                      isComplete ? 'bg-primary' : 'bg-border'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {step === 'upload' && (
              <UploadStep onDataLoaded={handleDataLoaded} />
            )}
            {step === 'configure' && (
              <ConfigureStep
                data={data}
                fileName={fileName}
                onBack={handleBack}
                onConfigure={handleConfigure}
              />
            )}
            {step === 'pipeline' && (
              <PipelineStep
                agentStates={analysis.agentStates}
                isStreaming={analysis.isStreaming}
                isComplete={analysis.isComplete}
                error={analysis.error}
                executionSummary={analysis.executionSummary}
                onProceed={() => setStep('results')}
                onCancel={() => {
                  analysis.cancelAnalysis();
                  setStep('configure');
                }}
              />
            )}
            {step === 'results' && (
              <ResultsStep
                agentStates={analysis.agentStates}
                executionSummary={analysis.executionSummary}
                onRestart={handleRestart}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
