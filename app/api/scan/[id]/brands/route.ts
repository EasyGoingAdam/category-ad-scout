import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  // Join in a `has_drafts` flag so the UI can filter "not yet drafted" without
  // making a second round-trip per brand.
  const brands = await sql()`
    SELECT b.*,
           EXISTS(SELECT 1 FROM drafts d WHERE d.brand_id = b.id) AS has_drafts,
           EXISTS(SELECT 1 FROM drafts d WHERE d.brand_id = b.id AND d.sent_at IS NOT NULL) AS has_sent_drafts
    FROM brands b
    WHERE b.scan_id = ${id}
    ORDER BY COALESCE(b.lead_score, b.category_fit, 0) DESC, b.brand_name ASC
  `;
  return NextResponse.json({ brands });
}
