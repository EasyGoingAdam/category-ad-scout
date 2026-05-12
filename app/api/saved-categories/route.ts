import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
  id: number;
  category: string;
  rationale: string | null;
  amazon_fit: number | null;
  dtc_potential: number | null;
  meta_ad_likelihood: number | null;
  brand_density: number | null;
  example_brands: string | null;
  last_scan_id: number | null;
  last_scanned_at: string | null;
  created_at: string;
};

export async function GET() {
  const rows = await sql()<Row[]>`
    SELECT id, category, rationale, amazon_fit, dtc_potential,
           meta_ad_likelihood, brand_density, example_brands,
           last_scan_id, last_scanned_at, created_at
    FROM saved_categories
    ORDER BY id DESC
  `;
  return NextResponse.json({
    categories: rows.map((r) => ({
      ...r,
      example_brands: r.example_brands ? safeArray(r.example_brands) : [],
      last_scanned_at: r.last_scanned_at ? String(r.last_scanned_at) : null,
      created_at: String(r.created_at),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category = String(body?.category ?? '').trim();
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });
  const examples = Array.isArray(body?.example_brands) ? body.example_brands.slice(0, 10) : null;
  const [row] = await sql()<Array<{ id: number }>>`
    INSERT INTO saved_categories (
      category, rationale, amazon_fit, dtc_potential, meta_ad_likelihood,
      brand_density, example_brands
    ) VALUES (
      ${category},
      ${typeof body?.rationale === 'string' ? body.rationale : null},
      ${numOrNull(body?.amazon_fit)},
      ${numOrNull(body?.dtc_potential)},
      ${numOrNull(body?.meta_ad_likelihood)},
      ${numOrNull(body?.brand_density)},
      ${examples ? JSON.stringify(examples) : null}
    )
    ON CONFLICT (category) DO NOTHING
    RETURNING id
  `;
  return NextResponse.json({ ok: true, id: row?.id ?? null });
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeArray(s: string): string[] {
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}
