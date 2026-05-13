import { openai, MODELS } from './openai';
import type { BrandRecord } from './types';

export type DraftRequest = {
  sender_pitch: string;
  recipient_name?: string | null;
  recipient_position?: string | null;
  tone?: 'professional' | 'warm' | 'punchy';
};

export type Draft = {
  subject: string;
  body: string;
  notes?: string;
};

const SYSTEM = `You write short, specific, low-pressure cold emails to ecommerce brand operators.

Hard constraints:
- 60-110 words in the body
- Specific to this brand — reference 1-2 concrete signals (organic traffic level, live ad count, ad creative type, Amazon presence, Shopify/DTC)
- One clear ask: either a 15-min call or a one-line yes/no question
- No generic openers like "I came across your brand", "Hope you're well", "I wanted to reach out"
- No buzzwords: synergy, leverage, circle back, touch base, drive value, partner up
- No flattery beyond one specific compliment grounded in a signal
- No questions about features the brand may or may not have — work only from the signals provided
- Subject line: 4-9 words, descriptive but not salesy

Return STRICT JSON: { "subject": "...", "body": "...", "notes": "<optional 1-line rationale>" }`;

export async function draftOutreach(
  brand: BrandRecord,
  req: DraftRequest,
): Promise<Draft> {
  const client = openai();
  const signals = signalsBlock(brand);
  const recipient =
    [req.recipient_name, req.recipient_position && `(${req.recipient_position})`]
      .filter(Boolean)
      .join(' ') || 'an operator at the brand';

  const tone = req.tone ?? 'professional';

  const prompt = `Sender pitch (what the sender does):
"""
${req.sender_pitch.trim()}
"""

Tone: ${tone}.
Recipient: ${recipient}.

Brand:
- Name: ${brand.brand_name}
- Domain: ${brand.domain}
- Category: ${brand.product_category ?? '(unknown)'}

Signals (only reference signals that are present):
${signals}

Draft the email now. Return JSON only.`;

  const res = await client.chat.completions.create({
    model: MODELS.smart,
    response_format: { type: 'json_object' },
    max_tokens: 800,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('OpenAI returned an empty response');
  const parsed = JSON.parse(text);
  const subject = typeof parsed?.subject === 'string' ? parsed.subject.trim() : '';
  const body = typeof parsed?.body === 'string' ? parsed.body.trim() : '';
  if (!subject || !body) throw new Error('outreach draft missing subject or body');
  return {
    subject,
    body,
    notes: typeof parsed?.notes === 'string' ? parsed.notes.trim() : undefined,
  };
}

function signalsBlock(b: BrandRecord): string {
  const lines: string[] = [];
  if (b.semrush_organic_traffic != null) {
    lines.push(`- organic traffic ~${formatNum(Number(b.semrush_organic_traffic))} / mo`);
  }
  if (b.meta_active_ad_count != null && b.meta_active_ad_count > 0) {
    lines.push(`- ${b.meta_active_ad_count} live Meta ads`);
  }
  if (b.meta_main_offer) lines.push(`- main offer in ads: "${b.meta_main_offer}"`);
  if (b.meta_creative_types) {
    try {
      const arr = JSON.parse(b.meta_creative_types);
      if (Array.isArray(arr) && arr.length) lines.push(`- creative types: ${arr.join(', ')}`);
    } catch {
      /* ignore */
    }
  }
  if (b.shopify_detected) lines.push('- runs on Shopify (DTC)');
  if (b.amazon_url) lines.push('- sells on Amazon');
  if (b.meta_description) lines.push(`- homepage tagline: "${b.meta_description.slice(0, 180)}"`);
  if (lines.length === 0) lines.push('- (no enrichment signals yet — speak to category fit only)');
  return lines.join('\n');
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

export const DEFAULT_SENDER_PITCH =
  process.env.OUTREACH_PERSONA?.trim() ||
  "I run outbound for a service that helps ecommerce brands grow on Amazon — we plug in alongside an existing DTC operation and run the Amazon channel end-to-end.";
