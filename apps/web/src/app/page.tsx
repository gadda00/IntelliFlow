'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/busara/Header';
import { Hero } from '@/components/busara/Hero';
import { AgentGallery } from '@/components/busara/AgentGallery';
import { ChatSection } from '@/components/busara/ChatSection';
import { Pricing } from '@/components/busara/Pricing';
import { Footer } from '@/components/busara/Footer';
import { AuthModal, UserMenu } from '@/components/busara/AuthModal';
import { PWAInstallPrompt } from '@/components/busara/PWAInstallPrompt';
import { CommandPalette } from '@/components/busara/CommandPalette';
import { OnboardingTour } from '@/components/busara/OnboardingTour';
import { storage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap, Upload, TrendingUp, Brain, ArrowRight, Sparkles } from 'lucide-react';

interface AppUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
}

const ONBOARDING_KEY = 'busara_onboarding_complete';

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [user, setUser] = useState<AppUser | null>(null);
  const [mounted, setMounted] = useState(false);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(storage.getUser());

    const onboardingComplete = typeof window !== 'undefined' ? localStorage.getItem(ONBOARDING_KEY) : null;
    if (!onboardingComplete) {
      const timer = setTimeout(() => setShowOnboarding(true), 1500);
      return () => clearTimeout(timer);
    }

    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const refresh = () => setUser(storage.getUser());
    window.addEventListener('busara-auth-changed', refresh);
    return () => window.removeEventListener('busara-auth-changed', refresh);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const sections = ['pricing', 'chat', 'analyze', 'agents', 'hero'];
    const onScroll = () => {
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(id);
          return;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mounted]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleOnboardingComplete = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  }, []);

  const handleOpenComposer = useCallback(() => {
    window.location.href = '/analyze';
  }, []);

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenChat={() => setChatOpen(true)}
        onOpenAuth={(mode) => { setAuthMode(mode); setAuthOpen(true); }}
      />

      <main className="flex-1">
        <Hero
          onAnalyze={() => window.location.href = '/analyze'}
          onSeeAgents={() => window.location.href = '/agents'}
        />
        <AgentGallery />

        {/* Unified Analyze CTA — replaces legacy Analyzer component */}
        <section id="analyze" className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to analyze your data?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Upload a CSV or JSON file and watch 50 AI agents analyze it in real time.
              Get insights, forecasts, anomaly detection, and actionable recommendations in seconds.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/analyze">
                <Button size="lg" className="gap-2">
                  <Upload className="h-5 w-5" />
                  Start Analysis
                </Button>
              </Link>
              <Link href="/agents">
                <Button size="lg" variant="outline" className="gap-2">
                  <Brain className="h-5 w-5" />
                  Explore Agents
                </Button>
              </Link>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
              <Card className="p-6 text-left">
                <Zap className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">50 AI Agents</h3>
                <p className="text-sm text-muted-foreground">
                  Multi-agent DAG pipeline with real statistical math — Holt-Winters, OLS, K-Means++, Granger causality.
                </p>
              </Card>
              <Card className="p-6 text-left">
                <TrendingUp className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Real Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Not just numbers — get plain-English explanations, recommended actions, and AI-powered narratives.
                </p>
              </Card>
              <Card className="p-6 text-left">
                <Sparkles className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">AI Narrative</h3>
                <p className="text-sm text-muted-foreground">
                  LLM-powered executive summaries that reference your specific data, not generic templates.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <ChatSection isOpen={chatOpen} onToggle={() => setChatOpen(prev => !prev)} />
        <Pricing />
      </main>

      <Footer />

      {user && (
        <div className="fixed bottom-6 right-6 z-40">
          <UserMenu />
        </div>
      )}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(id) => { scrollTo(id); setCommandPaletteOpen(false); }}
        onOpenAuth={(mode) => { setAuthMode(mode); setAuthOpen(true); }}
        onOpenComposer={handleOpenComposer}
        onToggleChat={() => setChatOpen(true)}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} mode={authMode} />

      {showOnboarding && <OnboardingTour onComplete={handleOnboardingComplete} />}

      <PWAInstallPrompt />
    </div>
  );
}
