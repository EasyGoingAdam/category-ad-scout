import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cross-scan leaderboard. Returns top brands across every scan, filtered to
// the operator's working preferences. Default ordering is lead_score DESC.
export async function GET(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ leads: [], db: 'unconfigured' }, { status: 200 });
  }
  const params = req.nextUrl.searchParams;
  const minScore = clampInt(params.get('min_score'), 0, 100, 0);
  const hasEmail = params.get('has_email') === '1';
  const hasAds = params.get('has_ads') === '1';
  const notDrafted = params.get('not_drafted') === '1';
  const verifiedOnly = params.get('verified_only') === '1';
  const status = params.get('status') ?? '';
  const limit = clampInt(params.get('limit'), 1, 200, 50);

  const db = sql();
  const rows = await db<
    Array<{
      id: number;
      scan_id: number;
      category: string;
      brand_name: string;
      domain: string;
      lead_score: number | null;
      category_fit: number | null;
      traffic_score: number | null;
      meta_ads_score: number | null;
      contact_score: number | null;
      semrush_organic_traffic: number | string | null;
      meta_active_ad_count: number | null;
      best_email: string | null;
      email_verified_status: string | null;
      email_verified_score: number | null;
      status: string;
      user_status: string | null;
      has_drafts: boolean;
      has_sent_drafts: boolean;
      last_checked: string | null;
    }>
  >`
    SELECT b.id, b.scan_id, s.category, b.brand_name, b.domain,
           b.lead_score, b.category_fit, b.traffic_score, b.meta_ads_score,
           b.contact_score, b.semrush_organic_traffic, b.meta_active_ad_count,
           b.best_email, b.email_verified_status, b.email_verified_score,
           b.status, b.user_status, b.last_checked,
           EXISTS(SELECT 1 FROM drafts d WHERE d.brand_id = b.id) AS has_drafts,
           EXISTS(SELECT 1 FROM drafts d WHERE d.brand_id = b.id AND d.sent_at IS NOT NULL) AS has_sent_drafts
    FROM brands b
    JOIN scans s ON s.id = b.scan_id
    WHERE COALESCE(b.lead_score, 0) >= ${minScore}
      ${hasEmail ? db`AND b.best_email IS NOT NULL` : db``}
      ${hasAds ? db`AND COALESCE(b.meta_active_ad_count, 0) > 0` : db``}
      ${verifiedOnly ? db`AND b.email_verified_status = 'valid'` : db``}
      ${status ? db`AND COALESCE(b.user_status, b.status) = ${status}` : db``}
    ORDER BY b.lead_score DESC NULLS LAST, b.brand_name ASC
    LIMIT ${limit * 2}
  `;
  // notDrafted is post-filtered because the EXISTS subquery would inflate the
  // result count and `limit` then becomes lossy; we already overfetch 2x so
  // the final slice is honest.
  const filtered = notDrafted ? rows.filter((r) => !r.has_drafts) : rows;
  return NextResponse.json({
    leads: filtered.slice(0, limit).map((r) => ({
      ...r,
      semrush_organic_traffic:
        r.semrush_organic_traffic != null ? Number(r.semrush_organic_traffic) : null,
      last_checked: r.last_checked ? String(r.last_checked) : null,
    })),
    total_returned: filtered.length,
  });
}

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
