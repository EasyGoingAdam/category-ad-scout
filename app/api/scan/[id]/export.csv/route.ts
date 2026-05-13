import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { BrandRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNS: Array<{ key: keyof BrandRecord | 'website'; header: string }> = [
  { key: 'brand_name', header: 'Brand' },
  { key: 'website', header: 'Website' },
  { key: 'category_fit', header: 'Category Fit' },
  { key: 'semrush_organic_traffic', header: 'Monthly Organic Traffic' },
  { key: 'semrush_paid_traffic', header: 'Paid Traffic' },
  { key: 'semrush_keywords', header: 'Organic Keywords' },
  { key: 'traffic_score', header: 'Traffic Score' },
  { key: 'meta_active_ad_count', header: 'Live Meta Ads' },
  { key: 'meta_confidence', header: 'Meta Confidence' },
  { key: 'meta_main_offer', header: 'Meta Main Offer' },
  { key: 'meta_creative_types', header: 'Meta Creative Types' },
  { key: 'meta_top_hooks', header: 'Meta Top Hooks' },
  { key: 'meta_ads_score', header: 'Meta Ads Score' },
  { key: 'meta_ad_library_url', header: 'Ad Library URL' },
  { key: 'amazon_url', header: 'Amazon Presence' },
  { key: 'shopify_detected', header: 'Shopify Detected' },
  { key: 'amazon_dtc_score', header: 'Amazon/DTC Score' },
  { key: 'best_email', header: 'Best Email' },
  { key: 'email_confidence', header: 'Email Confidence' },
  { key: 'contact_score', header: 'Contact Score' },
  { key: 'lead_score', header: 'Lead Score' },
  { key: 'status', header: 'Status' },
  { key: 'last_checked', header: 'Last Checked' },
];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  const db = sql();
  const [scan] = await db<{ category: string }[]>`
    SELECT category FROM scans WHERE id = ${id}
  `;
  if (!scan) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Optional ?ids=1,2,3 narrows the export to a specific selection.
  const idsParam = req.nextUrl.searchParams.get('ids');
  const ids = idsParam
    ? idsParam.split(',').map((s) => Number(s.trim())).filter(Number.isFinite)
    : null;

  const brands = ids && ids.length > 0
    ? await db<BrandRecord[]>`
        SELECT * FROM brands WHERE scan_id = ${id} AND id IN ${db(ids)}
        ORDER BY COALESCE(lead_score, category_fit, 0) DESC, brand_name ASC
      `
    : await db<BrandRecord[]>`
        SELECT * FROM brands WHERE scan_id = ${id}
        ORDER BY COALESCE(lead_score, category_fit, 0) DESC, brand_name ASC
      `;

  const lines: string[] = [];
  lines.push(COLUMNS.map((c) => csvCell(c.header)).join(','));
  for (const b of brands) {
    const row = COLUMNS.map((c) => {
      if (c.key === 'website') return csvCell(`https://${b.domain}`);
      const v = (b as any)[c.key];
      if (c.key === 'shopify_detected') return csvCell(v ? 'yes' : 'no');
      if (c.key === 'amazon_url') return csvCell(v ? 'yes' : 'no');
      return csvCell(v);
    });
    lines.push(row.join(','));
  }
  const csv = lines.join('\n');
  const slug =
    scan.category.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'scan';
  const filename = `category-ad-scout-${slug}-${id}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : String(v);
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
