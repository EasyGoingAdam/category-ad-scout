'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lead = {
  id: number;
  scan_id: number;
  category: string;
  brand_name: string;
  domain: string;
  lead_score: number | null;
  category_fit: number | null;
  traffic_score: number | null;
  meta_ads_score: number | null;
  contact_score: number | null;
  semrush_organic_traffic: number | null;
  meta_active_ad_count: number | null;
  best_email: string | null;
  email_verified_status: string | null;
  email_verified_score: number | null;
  status: string;
  user_status: string | null;
  has_drafts: boolean;
  has_sent_drafts: boolean;
  last_checked: string | null;
};

export default function LeadsClient() {
  const [minScore, setMinScore] = useState(50);
  const [hasEmail, setHasEmail] = useState(true);
  const [hasAds, setHasAds] = useState(false);
  const [notDrafted, setNotDrafted] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [limit, setLimit] = useState(50);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    p.set('min_score', String(minScore));
    if (hasEmail) p.set('has_email', '1');
    if (hasAds) p.set('has_ads', '1');
    if (notDrafted) p.set('not_drafted', '1');
    if (verifiedOnly) p.set('verified_only', '1');
    if (statusFilter) p.set('status', statusFilter);
    p.set('limit', String(limit));
    return `/api/leads?${p.toString()}`;
  }, [minScore, hasEmail, hasAds, notDrafted, verifiedOnly, statusFilter, limit]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setLeads(d.leads ?? []);
      })
      .catch((e) => !cancelled && setError(e?.message ?? 'failed'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-3 flex-wrap text-sm">
        <label className="flex items-center gap-2">
          Min lead score
          <input
            type="number"
            className="input"
            style={{ width: 80 }}
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasEmail}
            onChange={(e) => setHasEmail(e.target.checked)}
          />
          Has email
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasAds}
            onChange={(e) => setHasAds(e.target.checked)}
          />
          Has live ads
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
          />
          Email verified valid
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notDrafted}
            onChange={(e) => setNotDrafted(e.target.checked)}
          />
          Not yet drafted
        </label>
        <select
          className="input"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Any status</option>
          {[
            'New',
            'Qualified',
            'Has Live Ads',
            'Needs Review',
            'Contact Found',
            'Contacted',
            'Replied',
            'Closed',
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          Limit
          <input
            type="number"
            className="input"
            style={{ width: 80 }}
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
      </div>

      {error && <div className="card p-4 text-red-400">{error}</div>}

      {loading && !leads && <div className="card p-5 text-muted">Loading…</div>}

      {leads && leads.length === 0 && !loading && (
        <div className="card p-6 text-muted text-sm">
          No leads match these filters. Try lowering the min score or running more scans.
        </div>
      )}

      {leads && leads.length > 0 && (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Lead</th>
                <th>Traffic / mo</th>
                <th>Ads</th>
                <th>Email</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => {
                const effectiveStatus = l.user_status ?? l.status;
                return (
                  <tr key={l.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="font-medium">{l.brand_name}</td>
                    <td className="capitalize text-muted">{l.category}</td>
                    <td>
                      <strong>{l.lead_score ?? '—'}</strong>
                    </td>
                    <td>
                      {l.semrush_organic_traffic
                        ? Math.round(l.semrush_organic_traffic).toLocaleString()
                        : '—'}
                    </td>
                    <td>{l.meta_active_ad_count ?? '—'}</td>
                    <td className="max-w-[200px]">
                      {l.best_email ? (
                        <span className="flex items-center gap-1">
                          <span className="truncate font-mono text-xs" title={l.best_email}>
                            {l.best_email}
                          </span>
                          {l.email_verified_status === 'valid' && (
                            <span className="pill text-[10px] border-emerald-700/50 text-emerald-300">
                              ✓
                            </span>
                          )}
                          {l.email_verified_status === 'invalid' && (
                            <span className="pill text-[10px] border-red-700/50 text-red-300">
                              ✗
                            </span>
                          )}
                          {l.has_sent_drafts && (
                            <span
                              className="pill text-[10px] border-violet-700/50 text-violet-300"
                              title="Draft sent"
                            >
                              sent
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`pill ${l.user_status ? 'border-accent text-accent' : ''}`}>
                        {effectiveStatus}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="btn-ghost text-xs"
                        href={`/scans/${l.scan_id}?brand=${l.id}`}
                      >
                        open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
