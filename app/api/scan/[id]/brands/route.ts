import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  const brands = await sql()`
    SELECT * FROM brands WHERE scan_id = ${id}
    ORDER BY COALESCE(lead_score, category_fit, 0) DESC, brand_name ASC
  `;
  return NextResponse.json({ brands });
}
