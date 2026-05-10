import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hasSearchProvider } from '@/lib/search';
import { hasSemrushKey } from '@/lib/semrush';
import { hasMetaCoworkUrl } from '@/lib/meta';
import { hasHunterKey } from '@/lib/hunter';
import { hasTelegram } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const integrations = {
    database: { configured: !!process.env.DATABASE_URL, vars: ['DATABASE_URL'] },
    anthropic: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      vars: ['ANTHROPIC_API_KEY'],
    },
    search: {
      configured: hasSearchProvider(),
      vars: ['BRAVE_SEARCH_API_KEY', 'SERPAPI_API_KEY'],
      provider: process.env.BRAVE_SEARCH_API_KEY
        ? 'brave'
        : process.env.SERPAPI_API_KEY
          ? 'serpapi'
          : null,
    },
    semrush: { configured: hasSemrushKey(), vars: ['SEMRUSH_API_KEY'] },
    hunter: { configured: hasHunterKey(), vars: ['HUNTER_API_KEY'] },
    meta: {
      configured: hasMetaCoworkUrl(),
      vars: ['META_COWORK_URL', 'META_COWORK_TOKEN (optional)'],
    },
    telegram: {
      configured: hasTelegram(),
      vars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    },
    cron: {
      configured: !!process.env.CRON_TOKEN,
      vars: ['CRON_TOKEN (optional, recommended in prod)'],
    },
  };

  let db: { ok: boolean; error?: string; counts?: { scans: number; brands: number; schedules: number } } = {
    ok: false,
  };
  try {
    const [c] = await sql()<
      Array<{ scans: number; brands: number; schedules: number }>
    >`
      SELECT
        (SELECT COUNT(*)::int FROM scans)     AS scans,
        (SELECT COUNT(*)::int FROM brands)    AS brands,
        (SELECT COUNT(*)::int FROM schedules) AS schedules
    `;
    db = { ok: true, counts: c };
  } catch (e: any) {
    db = { ok: false, error: e?.message ?? 'connection failed' };
  }

  return NextResponse.json({ integrations, db });
}
