'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, X, Mail, Lock, User as UserIcon, Sparkles, LogOut, Key, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, storage } from '@/lib/api-client';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
}

export function AuthModal({ open, onClose, mode }: AuthModalProps) {
  const [localMode, setLocalMode] = useState(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setLocalMode(mode); }, [mode]);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = localMode === 'login'
        ? await api.login(email, password)
        : await api.register(email, password, name);
      storage.setToken(result.token);
      storage.setUser(result.user);
      onClose();
      // Trigger a refresh
      window.dispatchEvent(new Event('intelliflow-auth-changed'));
    } catch (err: any) {
      setError(err.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="p-6 relative">
              <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold">
                  {localMode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                {localMode === 'login' ? 'Sign in to access your analyses and API keys.' : 'Start analyzing data with 20 AI agents in seconds.'}
              </p>

              <div className="space-y-3">
                {localMode === 'register' && (
                  <div>
                    <Label htmlFor="name" className="text-xs">Name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="name" placeholder="Ada Lovelace" value={name} onChange={(e) => setName(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }} />
                  </div>
                </div>
                {error && <div className="text-xs text-destructive p-2 rounded bg-destructive/10">{error}</div>}
                <Button onClick={handleSubmit} disabled={loading || !email || !password || (localMode === 'register' && !name)} className="w-full gap-2">
                  {loading ? 'Please wait...' : (localMode === 'login' ? <><LogIn className="h-4 w-4" /> Sign In</> : <><UserPlus className="h-4 w-4" /> Create Account</>)}
                </Button>
              </div>

              <div className="text-xs text-center text-muted-foreground mt-4">
                {localMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setLocalMode(localMode === 'login' ? 'register' : 'login')}
                  className="text-primary hover:underline font-medium"
                >
                  {localMode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUser(storage.getUser());
    const refresh = () => setUser(storage.getUser());
    window.addEventListener('intelliflow-auth-changed', refresh);
    return () => window.removeEventListener('intelliflow-auth-changed', refresh);
  }, []);

  if (!user) return null;

  const loadKeys = async () => {
    try {
      const resp = await api.listApiKeys();
      setApiKeys(resp.apiKeys);
    } catch {}
  };

  const createKey = async () => {
    setLoading(true);
    try {
      const resp = await api.createApiKey();
      setNewKey(resp.key);
      await loadKeys();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    storage.removeToken();
    storage.removeUser();
    setUser(null);
    window.dispatchEvent(new Event('intelliflow-auth-changed'));
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => { setOpen(true); loadKeys(); }}>
        <Key className="h-3.5 w-3.5" />
        {user.email.split('@')[0]}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { setOpen(false); setNewKey(null); }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-semibold text-lg">{user.name}</h2>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <Badge variant="secondary" className="mt-1 text-[10px] uppercase">{user.plan} plan</Badge>
                  </div>
                  <button onClick={() => { setOpen(false); setNewKey(null); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">API Keys</Label>
                      <Button size="sm" variant="outline" onClick={createKey} disabled={loading} className="h-7 text-xs">
                        <Key className="h-3 w-3 mr-1" /> Generate
                      </Button>
                    </div>
                    {newKey && (
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 mb-2">
                        <p className="text-[10px] text-muted-foreground mb-1">Copy this key — it won't be shown again:</p>
                        <div className="flex items-center gap-1">
                          <code className="text-xs flex-1 truncate font-mono">{newKey}</code>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                            navigator.clipboard.writeText(newKey);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          }}>
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    {apiKeys.length === 0 && !newKey ? (
                      <p className="text-xs text-muted-foreground">No API keys yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {apiKeys.map(k => (
                          <div key={k.id} className="flex justify-between items-center p-2 rounded border border-border/40 text-xs">
                            <div>
                              <div className="font-medium">{k.name}</div>
                              <div className="text-muted-foreground font-mono">{k.prefix}...</div>
                            </div>
                            <button onClick={() => api.deleteApiKey(k.id).then(loadKeys)} className="text-destructive hover:underline text-[10px]">Revoke</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button variant="outline" className="w-full gap-2" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
