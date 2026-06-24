// Supabase client — server-side
// Used as an optional alternative to the custom JWT auth.
// If SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, Supabase Auth is used.
// Otherwise, the custom JWT auth in src/lib/auth/server.ts is used.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface SupabaseUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
}

export async function getUserFromSupabase(accessToken: string): Promise<SupabaseUser | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;

  // Fetch the user's plan from our database (sync)
  const { db } = await import('@/lib/db');
  const dbUser = await db.user.findUnique({
    where: { email: data.user.email ?? '' },
  });

  return {
    id: data.user.id,
    email: data.user.email ?? '',
    name: data.user.user_metadata?.name ?? dbUser?.name ?? null,
    plan: dbUser?.plan ?? 'free',
  };
}

/**
 * Sync a Supabase auth user into our local database.
 * Called after Supabase signup/login to ensure the user exists in our User table.
 */
export async function syncSupabaseUser(supabaseUser: { id: string; email: string; name?: string }): Promise<void> {
  const { db } = await import('@/lib/db');
  await db.user.upsert({
    where: { email: supabaseUser.email },
    create: {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.name ?? null,
      plan: 'free',
    },
    update: {
      name: supabaseUser.name ?? undefined,
    },
  });
}
