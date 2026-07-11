'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, X, Zap, Upload, Home, Download, RotateCcw } from 'lucide-react';
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
    else if (step === 'results') setStep('pipeline');
  }, [step, analysis]);

  const handleStepClick = useCallback((targetStep: WizardStep) => {
    const targetIndex = STEPS.findIndex(s => s.id === targetStep);
    const currentIndex = STEPS.findIndex(s => s.id === step);
    // Allow navigating to any completed or current step
    if (targetIndex <= currentIndex) {
      setStep(targetStep);
    }
  }, [step]);

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
              </Link>
              <div className="h-4 w-px bg-border" />
              <Badge variant="secondary" className="border border-primary/20 bg-primary/5">
                <Zap className="h-3 w-3 mr-1 text-primary" />
                50-Agent Analysis
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {step !== 'upload' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="gap-1.5"
                  disabled={step === 'pipeline' && (analysis.isStreaming || analysis.isComplete)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              )}
              {step === 'results' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestart}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    New Analysis
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl pt-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
            Analysis Workspace
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            Upload your data, configure the analysis, and watch 50 AI agents process it in real time.
          </p>
        </div>

        {/* Step Progress Bar — Clickable */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {STEPS.map((s, i) => {
              const isActive = step === s.id;
              const isComplete = currentStepIndex > i;
              const isAccessible = i <= currentStepIndex;

              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => isAccessible && handleStepClick(s.id)}
                    disabled={!isAccessible}
                    className={`flex flex-col items-center gap-1.5 transition-opacity ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    aria-label={`Go to ${s.label} step`}
                  >
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : isComplete
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                      } ${!isAccessible ? 'opacity-40' : ''} ${isAccessible && !isActive ? 'hover:border-primary/50' : ''}`}
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
                  </button>
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
              <div data-testid="wizard-upload-step">
                <UploadStep onDataLoaded={handleDataLoaded} />
              </div>
            )}
            {step === 'configure' && (
              <div data-testid="wizard-configure-step">
                <ConfigureStep
                  data={data}
                  fileName={fileName}
                  onBack={handleBack}
                  onConfigure={handleConfigure}
                />
              </div>
            )}
            {step === 'pipeline' && (
              <div data-testid="wizard-pipeline-step">
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
              </div>
            )}
            {step === 'results' && (
              <div data-testid="wizard-results-step">
                <ResultsStep
                  agentStates={analysis.agentStates}
                  executionSummary={analysis.executionSummary}
                  onRestart={handleRestart}
                  onBack={handleBack}
                  data={data}
                  fileName={fileName}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
