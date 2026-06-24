'use client';

import { Activity, Github, Twitter, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 py-12 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold">IntelliFlow</span>
            </div>
            <p className="text-xs text-muted-foreground">
              20-agent parallel data analysis. TypeScript-native. Production-ready.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><a href="#agents" className="hover:text-foreground">Agents</a></li>
              <li><a href="#analyze" className="hover:text-foreground">Analyzer</a></li>
              <li><a href="#chat" className="hover:text-foreground">Chat</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Resources</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><a href="https://github.com/gadda00/IntelliFlow" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a></li>
              <li>API Docs</li>
              <li>Agent Catalog</li>
              <li>Changelog</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Connect</h4>
            <div className="flex gap-2">
              <a href="https://github.com/gadda00/IntelliFlow" target="_blank" rel="noreferrer" className="h-8 w-8 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors">
                <Github className="h-4 w-4" />
              </a>
              <a href="#" className="h-8 w-8 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="mailto:hello@intelliflow.ai" className="h-8 w-8 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
          <div>© 2026 IntelliFlow. Built by Victor Ndunda & contributors.</div>
          <div className="flex gap-4">
            <span>Powered by Next.js 16 · Prisma · Paystack</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
