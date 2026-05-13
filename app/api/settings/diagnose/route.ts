import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { openai, MODELS } from '@/lib/openai';
import { searchWeb, hasSearchProvider } from '@/lib/search';
import { semrushDomainOverview, hasSemrushKey } from '@/lib/semrush';
import { hunterDomainSearch, hasHunterKey } from '@/lib/hunter';
import { metaScout, hasMetaCoworkUrl } from '@/lib/meta';
import { hasTelegram, sendTelegram } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

type Probe = {
  name: string;
  configured: boolean;
  ok: boolean | null;
  latency_ms?: number;
  detail?: string;
  error?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t };
}

export async function POST() {
  const probes: Probe[] = [];

  // 1. Database
  if (!process.env.DATABASE_URL) {
    probes.push({ name: 'database', configured: false, ok: null });
  } else {
    try {
      const r = await timed(() => sql()`SELECT 1::int as ok`);
      probes.push({
        name: 'database',
        configured: true,
        ok: true,
        latency_ms: r.ms,
        detail: 'SELECT 1 succeeded',
      });
    } catch (e: any) {
      probes.push({
        name: 'database',
        configured: true,
        ok: false,
        error: e?.message ?? 'unknown',
      });
    }
  }

  // 2. OpenAI — tiny round-trip to confirm key + reachability
  if (!process.env.OPENAI_API_KEY) {
    probes.push({ name: 'openai', configured: false, ok: null });
  } else {
    try {
      const r = await timed(() =>
        openai().chat.completions.create({
          model: MODELS.fast,
          max_tokens: 8,
          messages: [{ role: 'user', content: 'reply with just OK' }],
        }),
      );
      const text = r.value.choices[0]?.message?.content?.trim() ?? '';
      probes.push({
        name: 'openai',
        configured: true,
        ok: true,
        latency_ms: r.ms,
        detail: `model responded: "${text.slice(0, 30)}"`,
      });
    } catch (e: any) {
      probes.push({
        name: 'openai',
        configured: true,
        ok: false,
        error: e?.message ?? 'unknown',
      });
    }
  }

  // 3. Search provider
  if (!hasSearchProvider()) {
    probes.push({ name: 'search', configured: false, ok: null });
  } else {
    try {
      const r = await timed(() => searchWeb('best mushroom coffee brands', 3));
      probes.push({
        name: 'search',
        configured: true,
        ok: true,
        latency_ms: r.ms,
        detail: `${r.value.length} results · provider=${r.value[0]?.source ?? '?'}`,
      });
    } catch (e: any) {
      probes.push({
        name: 'search',
        configured: true,
        ok: false,
        error: e?.message ?? 'unknown',
      });
    }
  }

  // 4. SEMrush
  if (!hasSemrushKey()) {
    probes.push({ name: 'semrush', configured: false, ok: null });
  } else {
    try {
      const r = await timed(() => semrushDomainOverview('nytimes.com'));
      probes.push({
        name: 'semrush',
        configured: true,
        ok: true,
        latency_ms: r.ms,
        detail: `nytimes.com → ${r.value.organic_traffic ?? '?'} organic / mo`,
      });
    } catch (e: any) {
      probes.push({
        name: 'semrush',
        configured: true,
        ok: false,
        error: e?.message ?? 'unknown',
      });
    }
  }

  // 5. Hunter
  if (!hasHunterKey()) {
    probes.push({ name: 'hunter', configured: false, ok: null });
  } else {
    try {
      const r = await timed(() => hunterDomainSearch('stripe.com'));
      probes.push({
        name: 'hunter',
        configured: true,
        ok: true,
        latency_ms: r.ms,
        detail: `stripe.com → ${r.value.emails.length} email(s) returned`,
      });
    } catch (e: any) {
      probes.push({
        name: 'hunter',
        configured: true,
        ok: false,
        error: e?.message ?? 'unknown',
      });
    }
  }

  // 6. Meta cowork
  if (!hasMetaCoworkUrl()) {
    probes.push({ name: 'meta', configured: false, ok: null });
  } else {
    try {
      const r = await timed(() =>
        metaScout({
          brand_name: 'Test',
          domain: 'example.com',
          category: 'general',
          country: 'United States',
          search_terms: ['example'],
        }),
      );
      probes.push({
        name: 'meta',
        configured: true,
        ok: r.value.source !== 'unavailable',
        latency_ms: r.ms,
        detail: `cowork source=${r.value.source} · ${r.value.active_ad_count} ad(s)`,
      });
    } catch (e: any) {
      probes.push({
        name: 'meta',
        configured: true,
        ok: false,
        error: e?.message ?? 'unknown',
      });
    }
  }

  // 7. Telegram
  probes.push({
    name: 'telegram',
    configured: hasTelegram(),
    ok: hasTelegram() ? true : null,
    detail: hasTelegram()
      ? 'configured; use the "Send test Telegram message" button to verify delivery'
      : 'not configured',
  });

  return NextResponse.json({ probes });
}
