import { openai, MODELS } from './openai';

export type RerankInput = {
  domain: string;
  brand_name: string;
  title: string | null;
  description: string | null;
};

export type RerankOutput = {
  domain: string;
  fit_score: number; // 0-100
  reason: string; // ≤120 chars
};

const SYSTEM = `You score how well a website fits a target product category. You return STRICT JSON only.

A high fit (80-100) means: the site clearly sells products in this exact category (or core to it). The brand is a recognizable ecommerce/DTC operation, not a marketplace, blog, news article, list/guide, retailer, dictionary, or wiki.

A medium fit (50-79) means: adjacent or related category but not exact (e.g. dog supplements site that mostly sells dog toys), or category match is implied but evidence is weak.

A low fit (0-49) means: wrong category, marketplace/aggregator, news/blog/affiliate-list, or evidence is missing/contradictory.

Use only the title and description provided as evidence. Do not hallucinate — if evidence is weak, score conservatively and say so in the reason.`;

export async function rerankCategoryFit(
  category: string,
  items: RerankInput[],
): Promise<RerankOutput[]> {
  if (!process.env.OPENAI_API_KEY) {
    return items.map((i) => ({ domain: i.domain, fit_score: 0, reason: 'no openai key' }));
  }
  if (items.length === 0) return [];

  const client = openai();
  const prompt = `Target category: "${category}"

For each brand below, score category fit 0-100 and give a ≤120-char reason.
Return ONLY JSON shaped { "results": [ { "domain": "...", "fit_score": 0-100, "reason": "..." } ] }.
Keep result order matching input order.

Brands:
${items
  .map(
    (it, i) =>
      `${i + 1}. ${it.domain}
   brand: ${it.brand_name}
   title: ${(it.title ?? '').slice(0, 200)}
   description: ${(it.description ?? '').slice(0, 240)}`,
  )
  .join('\n')}

Output JSON only.`;

  const res = await client.chat.completions.create({
    model: MODELS.fast,
    response_format: { type: 'json_object' },
    max_tokens: Math.min(8000, items.length * 60 + 200),
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() ?? '';
  if (!text) {
    return items.map((i) => ({ domain: i.domain, fit_score: 0, reason: 'empty model response' }));
  }
  const parsed = JSON.parse(text);
  const arr: any[] = Array.isArray(parsed?.results) ? parsed.results : [];

  const out: RerankOutput[] = items.map((it, i) => {
    const byDomain = arr.find((r) => typeof r?.domain === 'string' && r.domain === it.domain);
    const r = byDomain ?? arr[i];
    const fit = clamp(Number(r?.fit_score ?? 0), 0, 100);
    return {
      domain: it.domain,
      fit_score: Number.isFinite(fit) ? fit : 0,
      reason: typeof r?.reason === 'string' ? r.reason.slice(0, 200) : '',
    };
  });
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
