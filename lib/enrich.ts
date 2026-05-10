import { sql } from './db';
import { semrushDomainOverview, trafficScore, hasSemrushKey } from './semrush';
import { metaScout, metaAdsScore, buildSearchTerms, hasMetaCoworkUrl } from './meta';
import { hunterDomainSearch, contactScore, hasHunterKey } from './hunter';
import { amazonDtcScore, leadScore, deriveStatus } from './scoring';
import type { BrandRecord } from './types';

export type EnrichLog = (msg: string) => void;

export async function enrichScan(
  scanId: number,
  log: EnrichLog = () => {},
): Promise<{ enriched: number }> {
  const s = sql();
  const [scan] = await s<{ id: number; category: string }[]>`
    SELECT id, category FROM scans WHERE id = ${scanId}
  `;
  if (!scan) throw new Error(`scan ${scanId} not found`);

  const brands = await s<BrandRecord[]>`
    SELECT * FROM brands WHERE scan_id = ${scanId}
  `;

  log(
    `Enrichment plan: ${brands.length} brands. ` +
      `SEMrush=${hasSemrushKey() ? 'on' : 'off'}, ` +
      `Meta=${hasMetaCoworkUrl() ? 'on' : 'off'}, ` +
      `Hunter=${hasHunterKey() ? 'on' : 'off'}`,
  );

  let enriched = 0;
  for (const b of brands) {
    try {
      await enrichOne(b, scan.category, log);
      enriched++;
    } catch (e: any) {
      log(`brand ${b.domain}: ${e?.message ?? e}`);
    }
  }
  await s`UPDATE scans SET status = 'enriched' WHERE id = ${scanId}`;
  return { enriched };
}

async function enrichOne(b: BrandRecord, category: string, log: EnrichLog) {
  const productPaths = safeProductPaths(b.raw_sources_json);

  const [sem, hunter, meta] = await Promise.all([
    safe(() => semrushDomainOverview(b.domain), 'semrush', b.domain, log),
    safe(() => hunterDomainSearch(b.domain), 'hunter', b.domain, log),
    safe(
      () =>
        metaScout({
          brand_name: b.brand_name,
          domain: b.domain,
          category,
          country: 'United States',
          search_terms: buildSearchTerms(b.brand_name, b.domain, category),
        }),
      'meta',
      b.domain,
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

  const merged = {
    category_fit: b.category_fit ?? 0,
    traffic_score: traffic_score ?? null,
    meta_ads_score: m_score ?? null,
    contact_score: c_score ?? null,
    amazon_dtc_score: amazon_dtc,
  };
  const lead = leadScore(merged);
  const status = deriveStatus({
    category_fit: b.category_fit ?? 0,
    meta_active_ad_count: meta?.source !== 'unavailable' ? meta?.active_ad_count : null,
    meta_confidence: meta?.source !== 'unavailable' ? meta?.confidence : null,
    best_email: hunter?.best?.value ?? null,
    meta_source_known: !!meta && meta.source !== 'unavailable',
    lead_score: lead,
  });

  await sql()`
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
    WHERE id = ${b.id!}
  `;

  log(
    `${b.domain}: traffic=${sem?.organic_traffic ?? 'n/a'}, ` +
      `ads=${meta?.source === 'unavailable' ? 'n/a' : meta?.active_ad_count ?? 'n/a'}, ` +
      `email=${hunter?.best?.value ?? 'n/a'}, lead=${lead}`,
  );
}

async function safe<T>(
  fn: () => Promise<T>,
  label: string,
  domain: string,
  log: EnrichLog,
): Promise<T | null> {
  try {
    return await fn();
  } catch (e: any) {
    log(`${label}@${domain} failed: ${e?.message ?? e}`);
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
