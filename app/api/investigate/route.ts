import { NextRequest, NextResponse } from 'next/server';
import { fetchPageMeta } from '@/lib/extract';
import { urlToDomain, isBlockedDomain, brandNameFromTitle } from '@/lib/normalize';
import { semrushDomainOverview, trafficScore } from '@/lib/semrush';
import { metaScout, metaAdsScore, buildSearchTerms } from '@/lib/meta';
import { hunterDomainSearch, contactScore } from '@/lib/hunter';
import { amazonDtcScore, leadScore } from '@/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw = String(body?.domain ?? '').trim();
  const category = String(body?.category ?? '').trim();
  const domain = urlToDomain(raw);
  if (!domain) return NextResponse.json({ error: 'invalid domain' }, { status: 400 });
  if (isBlockedDomain(domain)) {
    return NextResponse.json(
      { error: 'this domain is on the blocklist (marketplace / social / news)' },
      { status: 400 },
    );
  }

  const log: string[] = [];
  const homepage = await fetchPageMeta(`https://${domain}/`);
  if (!homepage) log.push(`could not fetch https://${domain}/`);

  const brand_name = homepage?.ogSiteName?.trim() || brandNameFromTitle(homepage?.title, domain);

  const [sem, hunter, meta] = await Promise.all([
    safe(() => semrushDomainOverview(domain), 'semrush', log),
    safe(() => hunterDomainSearch(domain), 'hunter', log),
    safe(
      () =>
        metaScout({
          brand_name,
          domain,
          category: category || 'general',
          country: 'United States',
          search_terms: buildSearchTerms(brand_name, domain, category || ''),
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
          productPaths: homepage?.productPaths ?? [],
          has_clear_offer: !!meta.main_offer,
        })
      : null;
  const c_score = hunter ? contactScore(hunter.best ?? null) : null;
  const amazon_dtc = amazonDtcScore({
    amazon_url: homepage?.amazonLinks?.[0] ?? null,
    shopify_detected: homepage?.shopify ? 1 : 0,
  });
  // We don't have a category-fit signal without a category-scoped search,
  // so treat it as 70 (neutral-positive) when category is supplied, 60 otherwise.
  const category_fit = category ? 70 : 60;
  const lead = leadScore({
    category_fit,
    traffic_score,
    meta_ads_score: m_score,
    contact_score: c_score,
    amazon_dtc_score: amazon_dtc,
  });

  return NextResponse.json({
    domain,
    brand_name,
    homepage: homepage
      ? {
          title: homepage.title,
          description: homepage.description,
          shopify: homepage.shopify,
          klaviyo: homepage.klaviyo,
          amazon_links: homepage.amazonLinks,
          socials: homepage.socials,
          product_paths: homepage.productPaths,
        }
      : null,
    semrush: sem,
    hunter: hunter
      ? {
          best: hunter.best,
          emails_count: hunter.emails?.length ?? 0,
          organization: hunter.organization,
          industry: hunter.industry,
        }
      : null,
    meta,
    scores: {
      category_fit,
      traffic_score,
      meta_ads_score: m_score,
      contact_score: c_score,
      amazon_dtc_score: amazon_dtc,
      lead_score: lead,
    },
    log,
  });
}

async function safe<T>(fn: () => Promise<T>, label: string, log: string[]): Promise<T | null> {
  try {
    return await fn();
  } catch (e: any) {
    log.push(`${label} failed: ${e?.message ?? e}`);
    return null;
  }
}
