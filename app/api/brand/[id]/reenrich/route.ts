import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { semrushDomainOverview, trafficScore, hasSemrushKey } from '@/lib/semrush';
import { metaScout, metaAdsScore, buildSearchTerms, hasMetaCoworkUrl } from '@/lib/meta';
import { hunterDomainSearch, contactScore, hasHunterKey } from '@/lib/hunter';
import { amazonDtcScore, leadScore, deriveStatus } from '@/lib/scoring';
import type { BrandRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const db = sql();
  const [b] = await db<BrandRecord[]>`SELECT * FROM brands WHERE id = ${id}`;
  if (!b) return NextResponse.json({ error: 'brand not found' }, { status: 404 });

  const log: string[] = [];
  log.push(
    `re-enrich plan for ${b.domain}: SEMrush=${hasSemrushKey() ? 'on' : 'off'}, ` +
      `Meta=${hasMetaCoworkUrl() ? 'on' : 'off'}, Hunter=${hasHunterKey() ? 'on' : 'off'}`,
  );

  const productPaths = safeProductPaths(b.raw_sources_json);
  const [sem, hunter, meta] = await Promise.all([
    safe(() => semrushDomainOverview(b.domain), 'semrush', log),
    safe(() => hunterDomainSearch(b.domain), 'hunter', log),
    safe(
      () =>
        metaScout({
          brand_name: b.brand_name,
          domain: b.domain,
          category: b.product_category ?? '',
          country: 'United States',
          search_terms: buildSearchTerms(b.brand_name, b.domain, b.product_category ?? ''),
        }),
      'meta',
      log,
    ),
  ]);

  const traffic_score = sem ? trafficScore(sem.organic_traffic) : null;
  const m_score =
    meta && meta.source !== 'unavailable'
      ? metaAdsScore({
          active_ad_count: meta.active_ad_count,
          creative_types: meta.creative_types,
          productPaths,
          has_clear_offer: !!meta.main_offer,
        })
      : null;
  const c_score = hunter ? contactScore(hunter.best ?? null) : null;
  const amazon_dtc = amazonDtcScore({
    amazon_url: b.amazon_url ?? null,
    shopify_detected: (b.shopify_detected ?? 0) as 0 | 1,
  });
  const lead = leadScore({
    category_fit: b.category_fit ?? 0,
    traffic_score,
    meta_ads_score: m_score,
    contact_score: c_score,
    amazon_dtc_score: amazon_dtc,
  });
  const status = deriveStatus({
    category_fit: b.category_fit ?? 0,
    meta_active_ad_count: meta?.source !== 'unavailable' ? meta?.active_ad_count : null,
    meta_confidence: meta?.source !== 'unavailable' ? meta?.confidence : null,
    best_email: hunter?.best?.value ?? null,
    meta_source_known: !!meta && meta.source !== 'unavailable',
    lead_score: lead,
  });

  await db`
    UPDATE brands SET
      semrush_organic_traffic = ${sem?.organic_traffic ?? null},
      semrush_paid_traffic    = ${sem?.paid_traffic ?? null},
      semrush_keywords        = ${sem?.organic_keywords ?? null},
      traffic_score           = ${traffic_score},
      meta_ads_found          = ${meta && meta.source !== 'unavailable' ? (meta.ads_found ? 1 : 0) : null},
      meta_active_ad_count    = ${meta && meta.source !== 'unavailable' ? meta.active_ad_count : null},
      meta_confidence         = ${meta && meta.source !== 'unavailable' ? meta.confidence : null},
      meta_main_offer         = ${meta?.main_offer ?? null},
      meta_creative_types     = ${meta?.creative_types?.length ? JSON.stringify(meta.creative_types) : null},
      meta_top_hooks          = ${meta?.top_hooks?.length ? JSON.stringify(meta.top_hooks) : null},
      meta_ads_score          = ${m_score},
      meta_ad_library_url     = ${meta?.ad_library_url ?? null},
      best_email              = ${hunter?.best?.value ?? null},
      email_confidence        = ${hunter?.best?.confidence ?? null},
      hunter_emails_json      = ${hunter?.emails?.length ? JSON.stringify(hunter.emails) : null},
      hunter_company_json     = ${hunter?.raw ? JSON.stringify(hunter.raw) : null},
      contact_score           = ${c_score},
      amazon_dtc_score        = ${amazon_dtc},
      lead_score              = ${lead},
      status                  = ${status},
      last_checked            = NOW()
    WHERE id = ${id}
  `;
  const [row] = await db<BrandRecord[]>`SELECT * FROM brands WHERE id = ${id}`;
  return NextResponse.json({ brand: row, log });
}

async function safe<T>(fn: () => Promise<T>, label: string, log: string[]): Promise<T | null> {
  try {
    return await fn();
  } catch (e: any) {
    log.push(`${label} failed: ${e?.message ?? e}`);
    return null;
  }
}

function safeProductPaths(rawJson?: string | null): string[] {
  if (!rawJson) return [];
  try {
    const j = JSON.parse(rawJson);
    return Array.isArray(j?.product_paths) ? j.product_paths : [];
  } catch {
    return [];
  }
}
