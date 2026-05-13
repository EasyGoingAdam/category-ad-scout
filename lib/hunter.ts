export type HunterEmail = {
  value: string;
  type?: string;
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  seniority?: string | null;
  department?: string | null;
  sources?: Array<{ uri?: string }>;
};

export type HunterResult = {
  domain: string;
  organization?: string | null;
  industry?: string | null;
  country?: string | null;
  emails: HunterEmail[];
  best: HunterEmail | null;
  source: 'hunter' | 'unavailable';
  raw?: unknown;
};

export function hasHunterKey(): boolean {
  return Boolean(process.env.HUNTER_API_KEY);
}

export async function hunterDomainSearch(domain: string): Promise<HunterResult> {
  if (!hasHunterKey()) {
    return { domain, emails: [], best: null, source: 'unavailable' };
  }
  const u = new URL('https://api.hunter.io/v2/domain-search');
  u.searchParams.set('domain', domain);
  u.searchParams.set('api_key', process.env.HUNTER_API_KEY!);
  u.searchParams.set('limit', '25');

  const r = await fetch(u);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status === 404) {
      return { domain, emails: [], best: null, source: 'hunter' };
    }
    throw new Error(`Hunter ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const data = j?.data ?? {};
  const emails: HunterEmail[] = Array.isArray(data.emails) ? data.emails : [];
  const best = pickBestEmail(emails);
  return {
    domain,
    organization: data.organization ?? null,
    industry: data.industry ?? null,
    country: data.country ?? null,
    emails,
    best,
    source: 'hunter',
    raw: data,
  };
}

const PRIORITY_PATTERNS: Array<{ rx: RegExp; weight: number }> = [
  { rx: /(founder|ceo|chief executive|owner)/i, weight: 100 },
  { rx: /(head of growth|vp growth|growth lead)/i, weight: 92 },
  { rx: /(cmo|chief marketing|head of marketing|vp marketing|marketing director)/i, weight: 88 },
  { rx: /(ecommerce|e-commerce|dtc|director of.*online)/i, weight: 84 },
  { rx: /(partnerships|business development|biz dev|bd)/i, weight: 78 },
];

const GENERIC_LOCAL = /^(hello|hi|info|contact|support|help|team|press|media|wholesale|partnerships?)@/i;

export function pickBestEmail(emails: HunterEmail[]): HunterEmail | null {
  if (!emails.length) return null;
  let best: HunterEmail | null = null;
  let bestScore = -1;
  for (const e of emails) {
    const score = scoreEmail(e);
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

function scoreEmail(e: HunterEmail): number {
  let s = 0;
  if (e.type === 'personal') s += 20;
  if (e.first_name) s += 5;
  s += Math.min(40, Math.round((e.confidence ?? 0) * 0.4));
  for (const p of PRIORITY_PATTERNS) {
    if (e.position && p.rx.test(e.position)) {
      s += p.weight;
      break;
    }
  }
  // generic mailbox is a fallback
  if (e.value && GENERIC_LOCAL.test(e.value) && s < 30) s += 25;
  return s;
}

export type HunterVerify = {
  email: string;
  status: 'valid' | 'accept_all' | 'webmail' | 'invalid' | 'disposable' | 'unknown';
  score: number;
  regexp?: boolean;
  gibberish?: boolean;
  disposable?: boolean;
  webmail?: boolean;
  mx_records?: boolean;
  smtp_server?: boolean;
  smtp_check?: boolean;
  block?: boolean;
  source: 'hunter' | 'unavailable';
  raw?: unknown;
};

export async function hunterVerifyEmail(email: string): Promise<HunterVerify> {
  if (!hasHunterKey()) {
    return { email, status: 'unknown', score: 0, source: 'unavailable' };
  }
  const u = new URL('https://api.hunter.io/v2/email-verifier');
  u.searchParams.set('email', email);
  u.searchParams.set('api_key', process.env.HUNTER_API_KEY!);

  const r = await fetch(u);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Hunter verify ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const data = j?.data ?? {};
  const status = String(data.status ?? data.result ?? 'unknown') as HunterVerify['status'];
  return {
    email,
    status,
    score: Number(data.score ?? 0),
    regexp: !!data.regexp,
    gibberish: !!data.gibberish,
    disposable: !!data.disposable,
    webmail: !!data.webmail,
    mx_records: !!data.mx_records,
    smtp_server: !!data.smtp_server,
    smtp_check: !!data.smtp_check,
    block: !!data.block,
    source: 'hunter',
    raw: data,
  };
}

export function contactScore(best: HunterEmail | null): number {
  if (!best) return 0;
  let s = 30;
  s += Math.round((best.confidence ?? 0) * 0.4);
  if (best.position) {
    for (const p of PRIORITY_PATTERNS) {
      if (p.rx.test(best.position)) {
        s += Math.round(p.weight * 0.3);
        break;
      }
    }
  }
  if (best.first_name && best.last_name) s += 5;
  return Math.max(0, Math.min(100, s));
}
