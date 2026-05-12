import { searchWeb, type SearchHit } from './search';
import { fetchPageMetaPool, type PageMeta } from './extract';
import {
  brandNameFromTitle,
  isBlockedDomain,
  urlToDomain,
} from './normalize';
import { rerankCategoryFit } from './rerank';

export type Candidate = {
  domain: string;
  brand_name: string;
  homepage_title: string | null;
  meta_description: string | null;
  product_category: string;
  amazon_url: string | null;
  shopify_detected: 0 | 1;
  socials_json: string;
  raw_sources_json: string;
  category_fit: number;
  source_hits: SearchHit[];
};

export function buildQueries(category: string): string[] {
  const c = category.trim();
  return [
    `best ${c} brands`,
    `top ${c} brands`,
    `${c} Shopify brands`,
    `${c} DTC brands`,
    `${c} subscription brand`,
    `${c} ecommerce brand`,
    `${c} buy online`,
    `${c} Amazon`,
    `best ${c} on Amazon`,
    `${c} "Amazon's Choice"`,
    `${c} "Subscribe & Save"`,
    `${c} "free shipping"`,
    `${c} "subscribe and save"`,
    `${c} "Shopify"`,
  ];
}

export async function discoverBrands(opts: {
  category: string;
  maxQueries?: number;
  maxCandidates?: number;
  onProgress?: (msg: string) => void;
  /** Fired for each candidate as soon as its homepage fetch completes,
   *  before LLM re-rank runs. Use this to stream rows into a DB. */
  onCandidate?: (c: Candidate) => void | Promise<void>;
  /** Fired after the LLM re-rank step with the {domain, fit_score, reason}
   *  for each candidate so a caller can update the persisted row. */
  onRerank?: (domain: string, fit_score: number, reason: string) => void | Promise<void>;
}): Promise<Candidate[]> {
  const { category } = opts;
  const maxQueries = opts.maxQueries ?? 10;
  const maxCandidates = opts.maxCandidates ?? 60;
  const log = opts.onProgress ?? (() => {});

  // Phase 2a: search
  const queries = buildQueries(category).slice(0, maxQueries);
  log(`Running ${queries.length} search queries…`);

  const allHits: SearchHit[] = [];
  for (const q of queries) {
    try {
      const hits = await searchWeb(q, 10);
      allHits.push(...hits);
    } catch (e: any) {
      log(`Search "${q}" failed: ${e?.message ?? e}`);
    }
  }
  log(`Got ${allHits.length} raw search hits.`);

  // Phase 2b: collapse to candidate domains
  const byDomain = new Map<string, { hits: SearchHit[] }>();
  for (const h of allHits) {
    const d = urlToDomain(h.url);
    if (!d) continue;
    if (isBlockedDomain(d)) continue;
    if (!byDomain.has(d)) byDomain.set(d, { hits: [] });
    byDomain.get(d)!.hits.push(h);
  }

  // rank by hit count, take top maxCandidates
  const ranked = Array.from(byDomain.entries())
    .sort((a, b) => b[1].hits.length - a[1].hits.length)
    .slice(0, maxCandidates);

  log(`Filtered to ${ranked.length} candidate domains. Fetching homepages…`);

  // Phase 2c: fetch homepage of each candidate to enrich + verify.
  // Builds and emits candidates incrementally as each homepage completes,
  // so a caller can stream them into a DB and the UI can poll.
  const homepages = ranked.map(([d]) => `https://${d}/`);
  const out: Candidate[] = [];
  await fetchPageMetaPool(homepages, 6, async (idx, meta) => {
    const [domain, info] = ranked[idx];
    const cand = buildCandidate(category, domain, info.hits, meta);
    if (cand) {
      out.push(cand);
      if (opts.onCandidate) await opts.onCandidate(cand);
    }
  });

  // Phase 3b: LLM re-rank category fit (uses the title/description as evidence).
  // Falls back to the heuristic score on any failure.
  if (process.env.ANTHROPIC_API_KEY && out.length > 0) {
    try {
      log(`Re-ranking ${out.length} candidates with Claude…`);
      const llm = await rerankCategoryFit(
        category,
        out.map((c) => ({
          domain: c.domain,
          brand_name: c.brand_name,
          title: c.homepage_title,
          description: c.meta_description,
        })),
      );
      const byDomain = new Map(llm.map((r) => [r.domain, r]));
      for (const c of out) {
        const r = byDomain.get(c.domain);
        if (!r) continue;
        // 70/30 blend favoring the LLM; preserves stability if LLM mis-scores once.
        c.category_fit = Math.round(0.7 * r.fit_score + 0.3 * c.category_fit);
        // Stash reason into raw_sources_json for the detail panel.
        try {
          const obj = JSON.parse(c.raw_sources_json);
          obj.llm_fit = { score: r.fit_score, reason: r.reason };
          c.raw_sources_json = JSON.stringify(obj);
        } catch {
          /* ignore */
        }
        if (opts.onRerank) {
          await opts.onRerank(c.domain, c.category_fit, r.reason);
        }
      }
    } catch (e: any) {
      log(`LLM re-rank failed, keeping heuristic scores: ${e?.message ?? e}`);
    }
  }

  log(`Built ${out.length} brand candidates.`);
  return out;
}

function buildCandidate(
  category: string,
  domain: string,
  hits: SearchHit[],
  meta: PageMeta | null,
): Candidate | null {
  // If we couldn't fetch the homepage at all, the candidate is weak — skip
  // unless we have multiple distinct search hits (still worth keeping).
  if (!meta && hits.length < 2) return null;

  const title = meta?.title ?? hits[0]?.title ?? null;
  const description = meta?.description ?? hits[0]?.description ?? null;
  const brand_name = meta?.ogSiteName?.trim() || brandNameFromTitle(title, domain);

  const amazon_url = meta?.amazonLinks?.[0] ?? null;
  const shopify_detected: 0 | 1 = meta?.shopify ? 1 : 0;

  const socials_json = JSON.stringify(meta?.socials ?? []);
  const raw_sources_json = JSON.stringify({
    search_hits: hits.slice(0, 6).map((h) => ({
      url: h.url,
      title: h.title,
      description: h.description,
      source: h.source,
    })),
    homepage_status: meta ? 'ok' : 'failed',
    final_url: meta?.finalUrl ?? null,
    klaviyo: meta?.klaviyo ?? false,
    product_paths: meta?.productPaths ?? [],
  });

  const category_fit = scoreCategoryFit({ category, title, description, hits });

  return {
    domain,
    brand_name,
    homepage_title: title,
    meta_description: description,
    product_category: category,
    amazon_url,
    shopify_detected,
    socials_json,
    raw_sources_json,
    category_fit,
    source_hits: hits,
  };
}

function scoreCategoryFit(opts: {
  category: string;
  title: string | null;
  description: string | null;
  hits: SearchHit[];
}): number {
  const tokens = opts.category
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return 50;
  const text = [
    opts.title ?? '',
    opts.description ?? '',
    ...opts.hits.map((h) => `${h.title} ${h.description ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();

  const matched = tokens.filter((t) => text.includes(t)).length;
  const ratio = matched / tokens.length;

  let score = Math.round(ratio * 80);
  if (opts.hits.length >= 3) score += 10;
  if (opts.hits.length >= 5) score += 5;
  if (opts.title && tokens.some((t) => opts.title!.toLowerCase().includes(t))) score += 5;
  return Math.max(0, Math.min(100, score));
}
