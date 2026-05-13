import { describe, it, expect, vi, afterEach } from 'vitest';
import { semrushDomainOverview, trafficScore } from './semrush';

const realFetch = globalThis.fetch;
const realKey = process.env.SEMRUSH_API_KEY;

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey) process.env.SEMRUSH_API_KEY = realKey;
  else delete process.env.SEMRUSH_API_KEY;
});

function mockResponse(body: string, status = 200) {
  globalThis.fetch = vi.fn(async () => new Response(body, { status })) as any;
}

describe('semrushDomainOverview', () => {
  it('returns unavailable when no key is set', async () => {
    delete process.env.SEMRUSH_API_KEY;
    const r = await semrushDomainOverview('example.com');
    expect(r.source).toBe('unavailable');
    expect(r.organic_traffic).toBeNull();
  });

  it('parses a typical CSV response', async () => {
    process.env.SEMRUSH_API_KEY = 'test';
    mockResponse(
      `Db;Dn;Rk;Or;Ot;Oc;Ad;At;Ac\nus;nytimes.com;42;1500000;75000000;1234;500;5000;5678`,
    );
    const r = await semrushDomainOverview('nytimes.com');
    expect(r.source).toBe('semrush');
    expect(r.organic_traffic).toBe(75_000_000);
    expect(r.paid_traffic).toBe(5_000);
    expect(r.organic_keywords).toBe(1_500_000);
    expect(r.rank).toBe(42);
  });

  it('treats NOTHING FOUND as zero traffic (not an error)', async () => {
    process.env.SEMRUSH_API_KEY = 'test';
    mockResponse('ERROR 50 :: NOTHING FOUND');
    const r = await semrushDomainOverview('tiny-unknown-brand.com');
    expect(r.source).toBe('semrush');
    expect(r.organic_traffic).toBe(0);
    expect(r.paid_traffic).toBe(0);
  });

  it('throws on a non-NOTHING-FOUND ERROR response', async () => {
    process.env.SEMRUSH_API_KEY = 'test';
    mockResponse('ERROR 105 :: INVALID API KEY');
    await expect(semrushDomainOverview('example.com')).rejects.toThrow(/INVALID API KEY/);
  });

  it('throws on HTTP error', async () => {
    process.env.SEMRUSH_API_KEY = 'test';
    mockResponse('rate limited', 429);
    await expect(semrushDomainOverview('example.com')).rejects.toThrow(/SEMrush 429/);
  });

  it('treats unparseable single-line responses as zero traffic', async () => {
    process.env.SEMRUSH_API_KEY = 'test';
    mockResponse('header only with no data row');
    const r = await semrushDomainOverview('example.com');
    expect(r.organic_traffic).toBe(0);
  });
});

describe('trafficScore exhaustive boundary check', () => {
  // Spec rule we test elsewhere too — but worth a parameterized table at
  // the exact tier boundaries to guard against off-by-one regressions.
  const cases: Array<[number, number]> = [
    [0, 0],
    [1, 10],
    [5_000, 10],
    [5_001, 25],
    [25_000, 25],
    [25_001, 50],
    [100_000, 50],
    [100_001, 75],
    [250_000, 75],
    [250_001, 100],
    [500_000, 100],
    [500_001, 80],
    [1_000_000, 80],
    [1_000_001, 60],
    [2_500_000, 60],
    [2_500_001, 40],
    [10_000_000, 40],
  ];
  for (const [n, s] of cases) {
    it(`traffic=${n.toLocaleString()} → score=${s}`, () => {
      expect(trafficScore(n)).toBe(s);
    });
  }
});
