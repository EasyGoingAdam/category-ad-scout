import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env.local');
  }
  _client = new OpenAI({ apiKey: key });
  return _client;
}

// Model picks:
//  - fast: cheap, high-throughput for batched per-candidate work (rerank, etc.)
//  - smart: better writing / reasoning for brainstorm + outreach drafts
export const MODELS = {
  fast: 'gpt-4o-mini',
  smart: 'gpt-4o',
} as const;

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
