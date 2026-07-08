'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'date';
  placeholder?: string;
  options?: FilterOption[];
}

export interface FilterValues {
  [key: string]: string;
}

interface FilterBarProps {
  fields: FilterField[];
  values: FilterValues;
  onChange: (name: string, value: string) => void;
  onReset?: () => void;
  /** Right-aligned custom actions. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Reusable filter bar for dashboard list pages.
 * Renders a responsive grid of inputs/selects plus an optional reset button.
 */
export function FilterBar({ fields, values, onChange, onReset, actions, className }: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some(v => v !== '' && v !== undefined && v !== null);

  return (
    <div
      className={
        'rounded-lg border border-slate-800 bg-slate-900/40 p-3 md:p-4 ' + (className ?? '')
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {fields.map(field => (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {field.label}
            </label>
            {field.type === 'select' ? (
              <Select
                value={values[field.name] ?? '__all'}
                onValueChange={v => onChange(field.name, v === '__all' ? '' : v)}
              >
                <SelectTrigger className="bg-slate-950/60 border-slate-700 text-slate-100 w-full">
                  <SelectValue placeholder={field.placeholder ?? 'All'} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="__all">All</SelectItem>
                  {field.options?.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                {field.type === 'text' && (
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                )}
                <Input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ''}
                  onChange={e => onChange(field.name, e.target.value)}
                  className={
                    'bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-600 ' +
                    (field.type === 'text' ? 'pl-8' : '')
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {(onReset || actions) && (
        <div className="mt-3 flex items-center justify-between">
          <div>
            {onReset && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={!hasActiveFilters}
                className="text-slate-400 hover:text-slate-200 disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reset filters
              </Button>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
