'use client';

import { useState } from 'react';
import type { BrandRecord } from '@/lib/types';

export default function ScanClient({
  scan,
  initialBrands,
}: {
  scan: { id: number; category: string; status: string; notes: string | null };
  initialBrands: BrandRecord[];
}) {
  const [brands, setBrands] = useState(initialBrands);
  const [running, setRunning] = useState<null | 'discover' | 'enrich'>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function discover() {
    setRunning('discover');
    setError(null);
    setLog((l) => [...l, 'Starting brand discovery…']);
    try {
      const r = await fetch(`/api/scan/${scan.id}/discover`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setLog((l) => [...l, ...(data.log ?? []), `Inserted: ${data.brands_inserted?.c ?? '?'} brands`]);
      // refresh
      const list = await fetch(`/api/scan/${scan.id}/brands`).then((r) => r.json());
      setBrands(list.brands ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Discovery failed');
    } finally {
      setRunning(null);
    }
  }

  async function enrichAll() {
    setRunning('enrich');
    setError(null);
    setLog((l) => [...l, 'Starting enrichment (SEMrush + Meta + Hunter)…']);
    try {
      const r = await fetch(`/api/scan/${scan.id}/enrich`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setLog((l) => [...l, ...(data.log ?? []), `Enriched ${data.enriched ?? 0} brands.`]);
      const list = await fetch(`/api/scan/${scan.id}/brands`).then((r) => r.json());
      setBrands(list.brands ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Enrichment failed');
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center gap-3 flex-wrap">
        <button className="btn" disabled={!!running} onClick={discover}>
          {running === 'discover' ? 'Discovering…' : brands.length > 0 ? 'Re-run discovery' : 'Discover brands'}
        </button>
        <button
          className="btn-ghost"
          disabled={!!running || brands.length === 0}
          onClick={enrichAll}
          title="Run SEMrush + Meta Ad Library + Hunter enrichment"
        >
          {running === 'enrich' ? 'Enriching…' : 'Enrich all'}
        </button>
        <a
          className="btn-ghost"
          href={`/api/scan/${scan.id}/export.csv`}
          download
          aria-disabled={brands.length === 0}
        >
          Export CSV
        </a>
        {error && <div className="text-sm text-red-400 ml-auto">{error}</div>}
      </div>

      {log.length > 0 && (
        <details className="card p-4">
          <summary className="text-sm text-muted cursor-pointer">Run log ({log.length})</summary>
          <pre className="text-xs whitespace-pre-wrap mt-2 text-muted">{log.join('\n')}</pre>
        </details>
      )}

      <BrandTable brands={brands} />
    </div>
  );
}

function BrandTable({ brands }: { brands: BrandRecord[] }) {
  if (brands.length === 0) {
    return (
      <div className="card p-6 text-muted text-sm">
        No brands yet. Click <em>Discover brands</em> to populate this scan.
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Website</th>
            <th>Fit</th>
            <th>Traffic / mo</th>
            <th>T-Score</th>
            <th>Live ads</th>
            <th>M-Score</th>
            <th>Amazon</th>
            <th>Shopify</th>
            <th>Best email</th>
            <th>Conf</th>
            <th>Lead</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((b) => (
            <tr key={b.id}>
              <td className="font-medium">{b.brand_name}</td>
              <td><a className="text-accent hover:underline" href={`https://${b.domain}`} target="_blank" rel="noreferrer">{b.domain}</a></td>
              <td>{cell(b.category_fit)}</td>
              <td>{b.semrush_organic_traffic != null ? Math.round(b.semrush_organic_traffic).toLocaleString() : '—'}</td>
              <td>{cell(b.traffic_score)}</td>
              <td>{b.meta_active_ad_count != null ? b.meta_active_ad_count : '—'}</td>
              <td>{cell(b.meta_ads_score)}</td>
              <td>{b.amazon_url ? <a className="text-accent" href={b.amazon_url} target="_blank" rel="noreferrer">yes</a> : '—'}</td>
              <td>{b.shopify_detected ? 'yes' : '—'}</td>
              <td className="max-w-[180px] truncate" title={b.best_email ?? undefined}>
                {b.best_email ?? '—'}
              </td>
              <td>{b.email_confidence != null ? b.email_confidence : '—'}</td>
              <td>{b.lead_score != null ? <strong>{b.lead_score}</strong> : '—'}</td>
              <td><span className="pill">{b.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cell(v: number | null | undefined) {
  if (v == null) return '—';
  return v;
}
