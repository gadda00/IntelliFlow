'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Executive, User, Code } from 'lucide-react';

export type Persona = 'executive' | 'manager' | 'analyst';

const PERSONA_STORAGE_KEY = 'busara_persona';

const PERSONAS: Record<Persona, { label: string; icon: any; description: string }> = {
  executive: { label: 'Executive', icon: Executive, description: '3-5 KPIs, traffic lights, top risks' },
  manager: { label: 'Manager', icon: User, description: 'Biggest movers, drill-downs, actions' },
  analyst: { label: 'Analyst', icon: Code, description: 'Raw data, code, methodology, stats' },
};

export function usePersona(): [Persona, (p: Persona) => void] {
  const [persona, setPersona] = useState<Persona>('executive');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(PERSONA_STORAGE_KEY) : null;
    if (stored && stored in PERSONAS) setPersona(stored as Persona);
  }, []);

  const change = (p: Persona) => {
    setPersona(p);
    if (typeof window !== 'undefined') localStorage.setItem(PERSONA_STORAGE_KEY, p);
  };

  return [persona, change];
}

export function PersonaSwitcher({ persona, onChange }: { persona: Persona; onChange: (p: Persona) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground hidden sm:inline">View as:</span>
      <div className="flex gap-1 p-1 rounded-lg bg-muted/30">
        {(Object.keys(PERSONAS) as Persona[]).map(p => {
          const Icon = PERSONAS[p].icon;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                persona === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={PERSONAS[p].description}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{PERSONAS[p].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
