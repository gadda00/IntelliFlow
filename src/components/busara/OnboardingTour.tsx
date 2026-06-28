'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Sparkles, Brain, Zap, MessageCircle, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'hero',
    title: 'Welcome to Busara',
    description: 'Busara is a 26-agent AI data intelligence platform. Upload any dataset and get instant insights from specialized AI agents running in parallel. Let us show you around!',
    icon: Sparkles,
  },
  {
    targetId: 'agents',
    title: 'Meet the Agents',
    description: 'Busara has 26 specialized AI agents organized in a 7-stage pipeline. From Data Scout to the Orchestrator, each agent has a unique role. Click any agent to learn more about what it does.',
    icon: Brain,
  },
  {
    targetId: 'analyze',
    title: 'Analyze Your Data',
    description: 'This is the core of Busara. Upload a CSV or JSON file, paste data, fetch from a URL, or use our sample dataset. Then hit "Run Full Analysis" and watch 26 agents process your data in real time.',
    icon: Zap,
  },
  {
    targetId: 'chat-trigger',
    title: 'Chat with Busara',
    description: 'Ask questions about your data, the agents, or analysis results at any time. The conversational analyst is always available via this button.',
    icon: MessageCircle,
  },
  {
    targetId: 'cmd-trigger',
    title: 'Command Palette',
    description: 'Press Cmd+K (or Ctrl+K) anytime to quickly navigate, find features, or jump to any agent. This is your fastest way to access everything Busara offers.',
    icon: Keyboard,
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      setVisible(false);
      setTimeout(onComplete, 300);
    } else {
      setStep(s => s + 1);
    }
  }, [isLast, onComplete]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  const skip = useCallback(() => {
    setVisible(false);
    setTimeout(onComplete, 300);
  }, [onComplete]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, skip]);

  useEffect(() => {
    const el = document.getElementById(currentStep.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep.targetId]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-foreground/20 backdrop-blur-[2px]"
            onClick={skip}
          />

          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[160] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />

              <div className="relative">
                <button onClick={skip} className="absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>

                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center mb-4">
                  <currentStep.icon className="h-6 w-6 text-primary-foreground" />
                </div>

                <h3 className="text-lg font-bold mb-2">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{currentStep.description}</p>

                <div className="flex items-center gap-1.5 mb-4">
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all ${
                        i === step ? 'w-6 bg-primary' : i < step ? 'w-4 bg-primary/40' : 'w-4 bg-muted'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {step > 0 && (
                      <Button variant="ghost" size="sm" onClick={prev} className="gap-1">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={skip}>
                      Skip tour
                    </Button>
                    <Button size="sm" onClick={next} className="gap-1.5">
                      {isLast ? 'Get Started' : 'Next'}
                      {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
                      {isLast && <Sparkles className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
