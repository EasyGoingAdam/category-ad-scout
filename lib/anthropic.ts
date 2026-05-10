import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env.local');
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export const MODELS = {
  fast: 'claude-haiku-4-5-20251001',
  smart: 'claude-sonnet-4-6',
} as const;
