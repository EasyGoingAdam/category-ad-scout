import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await sql()<
    Array<{
      id: number;
      brand_name: string;
      domain: string;
      user_status: string;
      best_email: string | null;
      lead_score: number | null;
      meta_active_ad_count: number | null;
      semrush_organic_traffic: number | string | null;
      user_notes: string | null;
      user_updated_at: string | null;
      scan_id: number;
      category: string;
    }>
  >`
    SELECT b.id, b.brand_name, b.domain, b.user_status, b.best_email,
           b.lead_score, b.meta_active_ad_count, b.semrush_organic_traffic,
           b.user_notes, b.user_updated_at, b.scan_id, s.category
    FROM brands b
    JOIN scans s ON s.id = b.scan_id
    WHERE b.user_status IS NOT NULL
    ORDER BY b.user_updated_at DESC NULLS LAST
  `;
  return NextResponse.json({
    brands: rows.map((r) => ({
      ...r,
      semrush_organic_traffic:
        r.semrush_organic_traffic != null ? Number(r.semrush_organic_traffic) : null,
      user_updated_at: r.user_updated_at ? String(r.user_updated_at) : null,
    })),
  });
}
