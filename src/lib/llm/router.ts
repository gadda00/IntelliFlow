// Busara LLM Router — multi-provider model routing with fallback
//
// All 5 advisory documents recommend NOT locking to a single LLM provider.
// This router tries providers in order and falls back on failure.
// Cost optimization: use cheap models for simple agents, expensive for complex.
//
// Providers supported:
//   1. z-ai-web-dev-sdk (GLM-4.6) — already bundled, free
//   2. OpenAI (GPT-4o, o3-mini) — if OPENAI_API_KEY is set
//   3. Anthropic (Claude) — if ANTHROPIC_API_KEY is set
//   4. Google Gemini — if GOOGLE_GEMINI_API_KEY is set

import 'server-only';
import ZAI from 'z-ai-web-dev-sdk';

export type Complexity = 'low' | 'medium' | 'high';

export interface LLMRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  complexity?: Complexity;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  durationMs: number;
}

interface ProviderConfig {
  name: string;
  available: boolean;
  models: { [key in Complexity]: string };
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'z-ai-sdk',
    available: true,
    models: { low: 'glm-4-flash', medium: 'glm-4.6', high: 'glm-4.6' },
  },
  {
    name: 'openai',
    available: !!(process.env.OPENAI_API_KEY),
    models: { low: 'gpt-4o-mini', medium: 'gpt-4o', high: 'o3-mini' },
  },
  {
    name: 'anthropic',
    available: !!(process.env.ANTHROPIC_API_KEY),
    models: { low: 'claude-3-haiku-20240307', medium: 'claude-3-5-sonnet-20241022', high: 'claude-3-5-sonnet-20241022' },
  },
  {
    name: 'google',
    available: !!(process.env.GOOGLE_GEMINI_API_KEY),
    models: { low: 'gemini-1.5-flash', medium: 'gemini-2.0-flash', high: 'gemini-2.5-pro' },
  },
];

let _zai: any = null;
async function getZAI() {
  if (_zai) return _zai;
  try { _zai = await ZAI.create(); return _zai; } catch { return null; }
}

export async function llmRouter(req: LLMRequest): Promise<LLMResponse> {
  const complexity = req.complexity || 'medium';
  const startTime = Date.now();

  for (const provider of PROVIDERS) {
    if (!provider.available) continue;
    try {
      const model = provider.models[complexity];
      let text = '';

      if (provider.name === 'z-ai-sdk') {
        const zai = await getZAI();
        if (!zai) throw new Error('Z-AI SDK not available');
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          thinking: { type: 'disabled' },
          temperature: req.temperature ?? 0.4,
          max_tokens: req.maxTokens ?? 1000,
        });
        text = completion.choices?.[0]?.message?.content ?? '';
      } else if (provider.name === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }], temperature: req.temperature ?? 0.4, max_tokens: req.maxTokens ?? 1000 }),
        });
        const data = await response.json();
        text = data.choices?.[0]?.message?.content ?? '';
      } else if (provider.name === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, max_tokens: req.maxTokens ?? 1000, system: req.system, messages: [{ role: 'user', content: req.user }] }),
        });
        const data = await response.json();
        text = data.content?.[0]?.text ?? '';
      } else if (provider.name === 'google') {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: req.system }] }, contents: [{ parts: [{ text: req.user }] }], generationConfig: { temperature: req.temperature ?? 0.4, maxOutputTokens: req.maxTokens ?? 1000 } }),
        });
        const data = await response.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      }

      if (text && text.length > 10) {
        return { text, model, provider: provider.name, durationMs: Date.now() - startTime };
      }
    } catch (err) {
      console.warn(`[LLM Router] ${provider.name} failed:`, err);
      continue;
    }
  }

  return { text: '', model: 'none', provider: 'fallback', durationMs: Date.now() - startTime };
}

export function getAvailableProviders(): { name: string; available: boolean; models: string[] }[] {
  return PROVIDERS.map(p => ({ name: p.name, available: p.available, models: Object.values(p.models) }));
}
