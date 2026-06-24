'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Github, Menu, X, Moon, Sun, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { storage } from '@/lib/api-client';

interface HeaderProps {
  activeSection: string;
  setActiveSection: (s: string) => void;
  darkMode: boolean;
  setDarkMode: (b: boolean) => void;
}

const NAV_ITEMS = [
  { id: 'hero', label: 'Home' },
  { id: 'agents', label: 'Agents' },
  { id: 'analyze', label: 'Analyze' },
  { id: 'chat', label: 'Chat' },
  { id: 'pricing', label: 'Pricing' },
];

export function Header({ activeSection, setActiveSection, darkMode, setDarkMode }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
     
    setUser(storage.getUser());
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass border-b border-border/40 shadow-sm' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={() => scrollTo('hero')} className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="font-bold text-base tracking-tight">Akili</span>
            <span className="text-[10px] text-muted-foreground -mt-0.5">v3.1 · 20 agents</span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeSection === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="h-9 w-9"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <Button size="sm" variant="outline" className="hidden md:flex gap-2" onClick={() => scrollTo('analyze')}>
              <Sparkles className="h-3.5 w-3.5" />
              {user.name?.split(' ')[0] ?? 'Dashboard'}
            </Button>
          ) : (
            <Button size="sm" className="hidden md:flex" onClick={() => scrollTo('analyze')}>
              Get Started
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-b border-border/40"
          >
            <div className="container mx-auto px-4 py-3 flex flex-col gap-1">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
