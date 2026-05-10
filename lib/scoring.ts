import type { BrandRecord, BrandStatus } from './types';

export function amazonDtcScore(b: Pick<BrandRecord, 'amazon_url' | 'shopify_detected'>): number {
  let s = 0;
  if (b.amazon_url) s += 50;
  if (b.shopify_detected) s += 50;
  return Math.max(0, Math.min(100, s));
}

export function leadScore(b: {
  category_fit?: number | null;
  traffic_score?: number | null;
  meta_ads_score?: number | null;
  contact_score?: number | null;
  amazon_dtc_score?: number | null;
}): number {
  const cf = b.category_fit ?? 0;
  const ts = b.traffic_score ?? 0;
  const ms = b.meta_ads_score ?? 0;
  const cs = b.contact_score ?? 0;
  const ad = b.amazon_dtc_score ?? 0;
  const score =
    0.30 * cf +
    0.25 * ts +
    0.25 * ms +
    0.10 * cs +
    0.10 * ad;
  return Math.round(score);
}

export function deriveStatus(b: {
  category_fit?: number | null;
  meta_active_ad_count?: number | null;
  meta_confidence?: number | null;
  best_email?: string | null;
  meta_source_known?: boolean;
  lead_score?: number | null;
}): BrandStatus {
  if ((b.category_fit ?? 0) < 30) return 'Bad Fit';
  const adCount = b.meta_active_ad_count ?? null;
  const adConf = b.meta_confidence ?? null;
  if (adCount != null && b.meta_source_known) {
    if (adConf != null && adConf < 60) return 'Needs Review';
    if (adCount >= 1) return 'Has Live Ads';
    if (adCount === 0) return 'No Ads Found';
  }
  if ((b.lead_score ?? 0) >= 70) return 'Qualified';
  if (b.best_email) return 'Contact Found';
  return 'New';
}
