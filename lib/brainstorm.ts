import { anthropic, MODELS } from './anthropic';
import type { CategorySuggestion } from './types';

const SYSTEM = `You are an Amazon ecommerce strategist. You generate product categories that meet ALL of these criteria:
- High Amazon compatibility (sellable on Amazon, ships well, broad demand)
- Replenishable / consumable preferred (drives subscribe-and-save and repeat orders)
- Strong DTC potential (brand-led, story-driven, high LTV)
- Sufficient brand density (5-30 meaningful DTC brands exist)
- Brands likely run Meta/Instagram ads
- Product differentiation potential (not pure commodity)

You always return STRICT JSON matching the schema. No prose, no markdown fences.`;

const SCHEMA_PROMPT = `Return JSON with this exact shape:
{
  "categories": [
    {
      "category": "string, 2-5 word category name (lowercase, plural where natural)",
      "rationale": "string, 1-2 sentence reason this category fits",
      "amazon_fit": "number 0-100",
      "dtc_potential": "number 0-100",
      "meta_ad_likelihood": "number 0-100",
      "brand_density": "number 0-100",
      "example_brands": ["string", "..."]  // 3-5 known brands in this category
    }
  ]
}`;

export async function brainstormCategories(opts: {
  count?: number;
  seed?: string;
}): Promise<CategorySuggestion[]> {
  const count = opts.count ?? 12;
  const seedText = opts.seed
    ? `Bias suggestions toward this theme/seed: "${opts.seed}". Categories should be adjacent to or compatible with the seed but still meet all criteria.`
    : 'Range across health/wellness, pet, home, baby, outdoor, food/beverage, beauty, fitness, kitchen.';

  const client = anthropic();
  const res = await client.messages.create({
    model: MODELS.smart,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Generate ${count} product categories.

${seedText}

${SCHEMA_PROMPT}

Output JSON only.`,
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();

  const json = extractJson(text);
  const parsed = JSON.parse(json);
  const list: CategorySuggestion[] = Array.isArray(parsed?.categories)
    ? parsed.categories
    : [];
  return list.filter(
    (c) => c && typeof c.category === 'string' && c.category.trim().length > 0,
  );
}

function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return s;
}
