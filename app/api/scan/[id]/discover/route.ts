import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { discoverBrands } from '@/lib/discovery';
import { hasSearchProvider } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  if (!hasSearchProvider()) {
    return NextResponse.json(
      {
        error:
          'No search provider configured. Set BRAVE_SEARCH_API_KEY or SERPAPI_API_KEY.',
      },
      { status: 400 },
    );
  }

  const db = sql();
  const [scan] = await db<{ id: number; category: string; status: string }[]>`
    SELECT id, category, status FROM scans WHERE id = ${id}
  `;
  if (!scan) return NextResponse.json({ error: 'scan not found' }, { status: 404 });

  await db`UPDATE scans SET status = 'discovering' WHERE id = ${id}`;

  const messages: string[] = [];
  const log = (m: string) => messages.push(m);

  try {
    const candidates = await discoverBrands({
      category: scan.category,
      onProgress: log,
      onCandidate: async (c) => {
        // Insert immediately so the UI polling can pick it up
        await db`
          INSERT INTO brands (
            scan_id, brand_name, domain, homepage_title, meta_description,
            product_category, amazon_url, shopify_detected, socials_json,
            raw_sources_json, status, category_fit, last_checked
          ) VALUES (
            ${id}, ${c.brand_name}, ${c.domain}, ${c.homepage_title}, ${c.meta_description},
            ${c.product_category}, ${c.amazon_url}, ${c.shopify_detected}, ${c.socials_json},
            ${c.raw_sources_json}, 'New', ${c.category_fit}, NOW()
          )
          ON CONFLICT (scan_id, domain) DO NOTHING
        `;
      },
      onRerank: async (domain, fit_score, reason) => {
        // Update the persisted row after LLM re-rank lands
        await db`
          UPDATE brands b
          SET category_fit = ${fit_score},
              raw_sources_json = (
                SELECT CASE
                  WHEN raw_sources_json IS NULL THEN ${JSON.stringify({ llm_fit: { score: fit_score, reason } })}
                  ELSE raw_sources_json
                END
                FROM brands WHERE id = b.id
              )
          WHERE b.scan_id = ${id} AND b.domain = ${domain}
        `;
      },
    });

    await db`UPDATE scans SET status = 'discovered', notes = ${messages.join('\n')} WHERE id = ${id}`;
    const [{ count }] = await db<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM brands WHERE scan_id = ${id}
    `;

    return NextResponse.json({
      scan_id: id,
      candidates_found: candidates.length,
      brands_inserted: { c: Number(count) },
      log: messages,
    });
  } catch (e: any) {
    await db`UPDATE scans SET status = 'error', notes = ${`${e?.message ?? e}\n${messages.join('\n')}`} WHERE id = ${id}`;
    return NextResponse.json(
      { error: e?.message ?? 'discovery failed', log: messages },
      { status: 500 },
    );
  }
}
