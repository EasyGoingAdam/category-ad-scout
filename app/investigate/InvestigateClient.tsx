'use client';

import { useState } from 'react';

type Result = {
  domain: string;
  brand_name: string;
  homepage: null | {
    title: string | null;
    description: string | null;
    shopify: boolean;
    klaviyo: boolean;
    amazon_links: string[];
    socials: Array<{ platform: string; url: string }>;
    product_paths: string[];
  };
  semrush: null | {
    organic_traffic: number | null;
    paid_traffic: number | null;
    organic_keywords: number | null;
    source: string;
  };
  hunter: null | {
    best: null | {
      value: string;
      confidence?: number;
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
    };
    emails_count: number;
    organization?: string | null;
    industry?: string | null;
  };
  meta: null | {
    active_ad_count: number;
    confidence: number;
    main_offer?: string | null;
    ad_library_url: string;
    source: string;
  };
  scores: {
    category_fit: number;
    traffic_score: number | null;
    meta_ads_score: number | null;
    contact_score: number | null;
    amazon_dtc_score: number;
    lead_score: number;
  };
  log: string[];
};

export default function InvestigateClient() {
  const [domain, setDomain] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!domain.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), category: category.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setResult(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[260px]">
          <label className="text-xs text-muted block mb-1">Domain or URL</label>
          <input
            className="input"
            placeholder="nativepet.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Category (optional)</label>
          <input
            className="input"
            style={{ width: 220 }}
            placeholder="dog supplements"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </div>
        <button className="btn" disabled={busy || !domain.trim()} onClick={run}>
          {busy ? 'Investigating…' : 'Investigate'}
        </button>
      </div>
      {error && (
        <div className="card p-4 text-red-400 border-red-900 text-sm">{error}</div>
      )}
      {result && <ResultPanel r={result} />}
    </div>
  );
}

function ResultPanel({ r }: { r: Result }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card p-5">
        <h3 className="font-semibold mb-2">{r.brand_name}</h3>
        <p className="text-sm">
          <a
            className="text-accent hover:underline"
            href={`https://${r.domain}`}
            target="_blank"
            rel="noreferrer"
          >
            {r.domain}
          </a>
        </p>
        {r.homepage?.description && (
          <p className="text-xs text-muted mt-2">{r.homepage.description}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Stat label="Lead score" value={String(r.scores.lead_score)} highlight />
          <Stat label="Category fit" value={String(r.scores.category_fit)} />
          <Stat label="Traffic score" value={fmt(r.scores.traffic_score)} />
          <Stat label="Meta score" value={fmt(r.scores.meta_ads_score)} />
          <Stat label="Contact score" value={fmt(r.scores.contact_score)} />
          <Stat label="Amazon/DTC" value={String(r.scores.amazon_dtc_score)} />
        </div>
      </div>

      <div className="card p-5 space-y-3 text-sm">
        <div>
          <h4 className="font-semibold mb-1">SEMrush</h4>
          {r.semrush ? (
            <ul className="text-xs space-y-1">
              <li>Organic / mo: <strong>{fmt(r.semrush.organic_traffic)}</strong></li>
              <li>Paid / mo: {fmt(r.semrush.paid_traffic)}</li>
              <li>Keywords: {fmt(r.semrush.organic_keywords)}</li>
            </ul>
          ) : (
            <p className="text-muted text-xs">unavailable</p>
          )}
        </div>
        <div>
          <h4 className="font-semibold mb-1">Hunter</h4>
          {r.hunter?.best ? (
            <div className="text-xs">
              <div className="font-mono">{r.hunter.best.value}</div>
              <div className="text-muted">
                {[r.hunter.best.first_name, r.hunter.best.last_name].filter(Boolean).join(' ')} ·{' '}
                {r.hunter.best.position ?? '—'} · conf {r.hunter.best.confidence ?? '—'}
              </div>
              <div className="text-muted">{r.hunter.emails_count} email(s) total</div>
            </div>
          ) : (
            <p className="text-muted text-xs">no emails returned</p>
          )}
        </div>
        <div>
          <h4 className="font-semibold mb-1">Meta Ad Library</h4>
          {r.meta && r.meta.source !== 'unavailable' ? (
            <div className="text-xs">
              <div>Active ads: <strong>{r.meta.active_ad_count}</strong> (conf {r.meta.confidence})</div>
              {r.meta.main_offer && <div>Offer: <em>{r.meta.main_offer}</em></div>}
              <a className="text-accent" href={r.meta.ad_library_url} target="_blank" rel="noreferrer">
                Open Ad Library →
              </a>
            </div>
          ) : (
            <p className="text-muted text-xs">unavailable (set META_COWORK_URL)</p>
          )}
        </div>
      </div>

      <div className="card p-5 text-sm">
        <h4 className="font-semibold mb-2">Homepage signals</h4>
        {r.homepage ? (
          <ul className="text-xs space-y-1">
            <li>Shopify: {r.homepage.shopify ? 'yes' : '—'}</li>
            <li>Klaviyo: {r.homepage.klaviyo ? 'yes' : '—'}</li>
            <li>Amazon link: {r.homepage.amazon_links.length > 0 ? 'yes' : '—'}</li>
            <li>
              Socials:{' '}
              {r.homepage.socials.length === 0
                ? '—'
                : r.homepage.socials.map((s) => s.platform).join(', ')}
            </li>
            <li>Product paths detected: {r.homepage.product_paths.length}</li>
          </ul>
        ) : (
          <p className="text-muted text-xs">homepage fetch failed</p>
        )}
        {r.log.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted cursor-pointer">log ({r.log.length})</summary>
            <pre className="text-xs whitespace-pre-wrap text-muted mt-1">{r.log.join('\n')}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-2 rounded border border-line ${highlight ? 'border-accent' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? 'text-accent' : ''}`}>{value}</div>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}
