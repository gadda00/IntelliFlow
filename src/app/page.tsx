'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/busara/Header';
import { Hero } from '@/components/busara/Hero';
import { AgentGallery } from '@/components/busara/AgentGallery';
import { Analyzer } from '@/components/busara/Analyzer';
import { ChatSection } from '@/components/busara/ChatSection';
import { Pricing } from '@/components/busara/Pricing';
import { Footer } from '@/components/busara/Footer';
import { AuthModal, UserMenu } from '@/components/busara/AuthModal';
import { PWAInstallPrompt } from '@/components/busara/PWAInstallPrompt';
import { storage } from '@/lib/api-client';

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
     
    setMounted(true);
    setUser(storage.getUser());
     
    // Apply dark mode class to html
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

  // Track active section based on scroll
  useEffect(() => {
    if (!mounted) return;
    const sections = ['hero', 'agents', 'analyze', 'chat', 'pricing'];
    const onScroll = () => {
      for (const id of sections.reverse()) {
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
      />

      <main className="flex-1">
        <Hero
          onAnalyze={() => scrollTo('analyze')}
          onSeeAgents={() => scrollTo('agents')}
        />
        <AgentGallery />
        <Analyzer />
        <ChatSection />
        <Pricing />
      </main>

      <Footer />

      {/* Floating auth button (desktop, bottom-right) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 items-end">
        {user ? (
          <UserMenu />
        ) : (
          <>
            <button
              onClick={() => { setAuthMode('login'); setAuthOpen(true); }}
              className="hidden md:block px-4 py-2 rounded-full glass border border-border/40 shadow-md text-sm font-medium hover:bg-muted transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthOpen(true); }}
              className="hidden md:block px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Create account
            </button>
          </>
        )}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} mode={authMode} />
      <PWAInstallPrompt />
    </div>
  );
}
