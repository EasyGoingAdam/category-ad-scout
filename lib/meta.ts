export type MetaScoutRequest = {
  brand_name: string;
  domain: string;
  category: string;
  country?: string;
  search_terms: string[];
};

export type MetaScoutResponse = {
  ads_found: boolean;
  active_ad_count: number;
  confidence: number;
  main_offer?: string | null;
  creative_types?: string[];
  top_hooks?: string[];
  ad_library_url: string;
  source: 'cowork' | 'unavailable' | 'mock';
  raw?: unknown;
};

export function hasMetaCoworkUrl(): boolean {
  return Boolean(process.env.META_COWORK_URL);
}

export function buildSearchTerms(brand: string, domain: string, category: string): string[] {
  const root = domain.replace(/\.[a-z.]+$/i, '');
  const compact = brand.replace(/\s+/g, '');
  const terms = new Set<string>([brand, root, compact, `${brand} ${category}`]);
  return Array.from(terms).filter((t) => t && t.length >= 3);
}

export function adLibraryUrlFor(brand: string, country = 'US'): string {
  const u = new URL('https://www.facebook.com/ads/library/');
  u.searchParams.set('active_status', 'active');
  u.searchParams.set('ad_type', 'all');
  u.searchParams.set('country', country);
  u.searchParams.set('q', brand);
  u.searchParams.set('search_type', 'keyword_unordered');
  return u.toString();
}

export async function metaScout(req: MetaScoutRequest): Promise<MetaScoutResponse> {
  const url = process.env.META_COWORK_URL;
  if (!url) {
    return {
      ads_found: false,
      active_ad_count: 0,
      confidence: 0,
      ad_library_url: adLibraryUrlFor(req.brand_name, req.country),
      source: 'unavailable',
    };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.META_COWORK_TOKEN
          ? { Authorization: `Bearer ${process.env.META_COWORK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        brand_name: req.brand_name,
        domain: req.domain,
        category: req.category,
        country: req.country ?? 'United States',
        search_terms: req.search_terms,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`Meta cowork ${r.status}: ${text.slice(0, 200)}`);
    }
    const data = (await r.json()) as Partial<MetaScoutResponse> & { raw?: unknown };
    return {
      ads_found: Boolean(data.ads_found),
      active_ad_count: Number(data.active_ad_count ?? 0),
      confidence: Number(data.confidence ?? 0),
      main_offer: data.main_offer ?? null,
      creative_types: data.creative_types ?? [],
      top_hooks: data.top_hooks ?? [],
      ad_library_url: data.ad_library_url ?? adLibraryUrlFor(req.brand_name, req.country),
      source: 'cowork',
      raw: data.raw ?? data,
    };
  } finally {
    clearTimeout(t);
  }
}

export function metaAdsScore(opts: {
  active_ad_count: number;
  creative_types?: string[];
  productPaths?: string[];
  has_clear_offer?: boolean;
}): number {
  const n = Math.max(0, opts.active_ad_count | 0);
  let base = 0;
  if (n === 0) base = 0;
  else if (n <= 3) base = 15;
  else if (n <= 10) base = 35;
  else if (n <= 25) base = 60;
  else if (n <= 75) base = 85;
  else base = 100;

  let bonus = 0;
  if ((opts.creative_types?.length ?? 0) > 1) bonus += 10;
  if ((opts.productPaths?.length ?? 0) > 1) bonus += 10;
  // recency bonus is best determined by the cowork skill; surface it via a flag on raw
  if (opts.has_clear_offer) bonus += 10;

  return Math.max(0, Math.min(100, base + bonus));
}
