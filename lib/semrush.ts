export type SemrushOverview = {
  domain: string;
  organic_traffic: number | null;
  paid_traffic: number | null;
  organic_keywords: number | null;
  rank: number | null;
  source: 'semrush' | 'unavailable';
};

const ENDPOINT = 'https://api.semrush.com/';

export function hasSemrushKey(): boolean {
  return Boolean(process.env.SEMRUSH_API_KEY);
}

export async function semrushDomainOverview(
  domain: string,
  database = 'us',
): Promise<SemrushOverview> {
  if (!hasSemrushKey()) {
    return {
      domain,
      organic_traffic: null,
      paid_traffic: null,
      organic_keywords: null,
      rank: null,
      source: 'unavailable',
    };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set('type', 'domain_ranks');
  url.searchParams.set('key', process.env.SEMRUSH_API_KEY!);
  url.searchParams.set('domain', domain);
  url.searchParams.set('database', database);
  url.searchParams.set(
    'export_columns',
    'Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac',
  );

  const r = await fetch(url, { method: 'GET' });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`SEMrush ${r.status}: ${text.slice(0, 200)}`);
  }
  // SEMrush returns either an error string ("ERROR 50 :: ...") or CSV with ; separators.
  if (text.startsWith('ERROR')) {
    if (/NOTHING FOUND/i.test(text)) {
      return {
        domain,
        organic_traffic: 0,
        paid_traffic: 0,
        organic_keywords: 0,
        rank: null,
        source: 'semrush',
      };
    }
    throw new Error(`SEMrush API error: ${text.trim()}`);
  }

  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return {
      domain,
      organic_traffic: 0,
      paid_traffic: 0,
      organic_keywords: 0,
      rank: null,
      source: 'semrush',
    };
  }
  const header = lines[0].split(';');
  const row = lines[1].split(';');
  const idx = (k: string) => header.indexOf(k);
  const num = (k: string) => {
    const i = idx(k);
    if (i < 0) return null;
    const n = Number(row[i]);
    return Number.isFinite(n) ? n : null;
  };

  return {
    domain,
    organic_traffic: num('Ot'),
    paid_traffic: num('At'),
    organic_keywords: num('Or'),
    rank: num('Rk'),
    source: 'semrush',
  };
}

export function trafficScore(organicTraffic: number | null | undefined): number {
  const t = organicTraffic ?? 0;
  if (t <= 0) return 0;
  if (t <= 5_000) return 10;
  if (t <= 25_000) return 25;
  if (t <= 100_000) return 50;
  if (t <= 250_000) return 75;
  if (t <= 500_000) return 100;
  if (t <= 1_000_000) return 80;
  if (t <= 2_500_000) return 60;
  return 40;
}
