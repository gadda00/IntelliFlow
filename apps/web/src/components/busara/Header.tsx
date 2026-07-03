'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Menu, X, Moon, Sun, Sparkles, Search, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { storage } from '@/lib/api-client';

interface HeaderProps {
  activeSection: string;
  setActiveSection: (s: string) => void;
  darkMode: boolean;
  setDarkMode: (b: boolean) => void;
  onOpenCommandPalette: () => void;
  onOpenChat: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const NAV_ITEMS = [
  { id: 'hero', label: 'Home', type: 'scroll' as const },
  { id: 'agents-page', label: 'Agents', badge: '50', type: 'route' as const, href: '/agents' },
  { id: 'analyze-page', label: 'Analyze', badge: 'v7', type: 'route' as const, href: '/analyze' },
  { id: 'pricing', label: 'Pricing', type: 'scroll' as const },
];

export function Header({ activeSection, setActiveSection, darkMode, setDarkMode, onOpenCommandPalette, onOpenChat, onOpenAuth }: HeaderProps) {
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

  const navigate = (item: typeof NAV_ITEMS[0]) => {
    if (item.type === 'route' && item.href) {
      window.location.href = item.href;
    } else {
      scrollTo(item.id);
    }
    setMobileOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'glass-heavy border-b border-border/30 shadow-lg shadow-background/5'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={() => scrollTo('hero')} className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-primary to-accent-foreground flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="font-bold text-base tracking-tight">Busara</span>
            <span className="text-[10px] text-muted-foreground -mt-0.5">v7.0 · 50 agents</span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item)}
              className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                activeSection === item.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {activeSection === item.id && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="relative z-10 text-[9px] h-4 px-1 bg-primary/10 text-primary border-primary/20">
                  {item.badge}
                </Badge>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            id="cmd-trigger"
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground text-xs hover:bg-muted hover:text-foreground transition-all duration-200"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-background/60 border border-border/40 font-mono text-[10px]">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <Button
            id="chat-trigger"
            variant="ghost"
            size="icon"
            onClick={onOpenChat}
            className="h-9 w-9 relative"
            title="Chat with Busara"
          >
            <Sparkles className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-50" />
              <span className="relative rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
          </Button>

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
            <Button size="sm" variant="outline" className="hidden md:flex gap-2" onClick={() => window.location.href = '/analyze'}>
              <Sparkles className="h-3.5 w-3.5" />
              {user.name?.split(' ')[0] ?? 'Dashboard'}
            </Button>
          ) : (
            <div className="hidden md:flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => onOpenAuth('login')} className="text-xs">
                Sign in
              </Button>
              <Button size="sm" onClick={() => window.location.href = '/analyze'} className="gap-1.5">
                <Sparkles className="h-3 w-3" />
                Get Started
              </Button>
            </div>
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
            className="md:hidden glass-heavy border-b border-border/30"
          >
            <div className="container mx-auto px-4 py-3 flex flex-col gap-1">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all flex items-center justify-between ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary">
                      {item.badge}
                    </Badge>
                  )}
                </button>
              ))}
              <button
                onClick={() => { onOpenCommandPalette(); setMobileOpen(false); }}
                className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground text-left flex items-center gap-2 hover:bg-muted transition-colors"
              >
                <Search className="h-4 w-4" />
                Search commands...
              </button>
              {!user && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-border/30">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { onOpenAuth('login'); setMobileOpen(false); }}>
                    Sign in
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => { onOpenAuth('register'); setMobileOpen(false); }}>
                    Get Started
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
