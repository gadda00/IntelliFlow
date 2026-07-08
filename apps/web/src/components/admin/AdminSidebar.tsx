'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Brain,
  ChevronLeft,
  Cpu,
  GitBranch,
  Menu,
  ServerCog,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Admin sidebar — mirrors the look-and-feel of the dashboard sidebar but
 * uses rose/red accents to visually distinguish admin from regular use.
 *
 * Sections: Agents, Trajectories, Evolution, Users, System.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Platform',
    items: [
      {
        href: '/admin/agents',
        label: 'Agents',
        icon: Brain,
        description: 'Stability & config',
      },
      {
        href: '/admin/trajectories',
        label: 'Trajectories',
        icon: GitBranch,
        description: 'GDPR + dataset export',
      },
      {
        href: '/admin/evolution',
        label: 'Evolution',
        icon: Cpu,
        description: 'Approve / reject actions',
      },
    ],
  },
  {
    title: 'Governance',
    items: [
      {
        href: '/admin/users',
        label: 'Users',
        icon: Users,
        description: 'Accounts & RBAC',
      },
      {
        href: '/admin/system',
        label: 'System',
        icon: ServerCog,
        description: 'Server, DB, LLM, errors',
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 h-14">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">Admin Console</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(v => !v)}
          className="text-slate-300 hover:text-slate-100 hover:bg-slate-800"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 z-30 h-screen w-64 shrink-0 border-r border-slate-800 bg-slate-950 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="hidden lg:flex h-16 items-center gap-2.5 px-5 border-b border-slate-800">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-sm">Admin</span>
            <span className="text-[10px] text-slate-500 -mt-0.5">Busara platform ops</span>
          </div>
        </div>

        <nav className="p-3 space-y-6 overflow-y-auto h-[calc(100vh-4rem)] scrollbar-thin">
          {NAV_SECTIONS.map(section => (
            <div key={section.title}>
              <p className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map(item => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors group',
                        active
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-rose-400' : 'text-slate-500 group-hover:text-slate-300',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium leading-tight">{item.label}</p>
                        <p className="text-[10px] text-slate-600 truncate">{item.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to Busara
            </Link>
          </div>

          <div className="pt-2">
            <Badge
              variant="outline"
              className="text-[9px] border-rose-500/30 text-rose-400/70"
            >
              <Activity className="h-2.5 w-2.5 mr-1" />
              Restricted access
            </Badge>
          </div>
        </nav>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
