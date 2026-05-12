'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { BrandRecord, BrandStatus } from '@/lib/types';

const USER_STATUSES: Array<BrandStatus | 'Contacted' | 'Replied' | 'Closed' | ''> = [
  '',
  'New',
  'Qualified',
  'Has Live Ads',
  'No Ads Found',
  'Needs Review',
  'Bad Fit',
  'Contact Found',
  'Contact Missing',
  'Contacted',
  'Replied',
  'Closed',
];

export default function ScanClient({
  scan,
  initialBrands,
}: {
  scan: { id: number; category: string; status: string; notes: string | null };
  initialBrands: BrandRecord[];
}) {
  const [brands, setBrands] = useState<BrandRecord[]>(initialBrands);
  const [running, setRunning] = useState<null | 'discover' | 'enrich' | 'bulk'>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [hasAdsOnly, setHasAdsOnly] = useState(false);
  const [hasEmailOnly, setHasEmailOnly] = useState(false);
  const [notDraftedOnly, setNotDraftedOnly] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanStatus, setScanStatus] = useState<string>(scan.status);

  // Auto-trigger discovery if the scan was just created and is empty.
  useEffect(() => {
    if (scan.status === 'running' && initialBrands.length === 0) {
      void discover(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-poll while discovery is in progress so new brands appear in the table.
  useEffect(() => {
    if (running !== 'discover' && scanStatus !== 'discovering' && scanStatus !== 'running') {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const [statusRes, brandsRes] = await Promise.all([
          fetch(`/api/scan/${scan.id}/status`),
          fetch(`/api/scan/${scan.id}/brands`),
        ]);
        if (statusRes.ok) {
          const d = await statusRes.json();
          setScanStatus(d.status);
        }
        if (brandsRes.ok) {
          const d = await brandsRes.json();
          if (Array.isArray(d.brands)) setBrands(d.brands);
        }
      } catch {
        /* swallow, keep polling */
      }
    };
    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [running, scanStatus, scan.id]);

  async function refreshBrands() {
    const r = await fetch(`/api/scan/${scan.id}/brands`);
    const d = await r.json();
    setBrands(d.brands ?? []);
  }

  async function discover(silent = false) {
    setRunning('discover');
    setError(null);
    if (!silent) setLog((l) => [...l, 'Starting brand discovery…']);
    try {
      const r = await fetch(`/api/scan/${scan.id}/discover`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setLog((l) => [...l, ...(data.log ?? []), `Inserted: ${data.brands_inserted?.c ?? '?'} brands`]);
      await refreshBrands();
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
      await refreshBrands();
    } catch (e: any) {
      setError(e.message ?? 'Enrichment failed');
    } finally {
      setRunning(null);
    }
  }

  async function reenrichOne(id: number) {
    try {
      const r = await fetch(`/api/brand/${id}/reenrich`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setBrands((bs) => bs.map((b) => (b.id === id ? data.brand : b)));
      setLog((l) => [...l, `Re-enriched #${id}: ${data.log?.join(' · ')}`]);
    } catch (e: any) {
      alert(e?.message ?? 'failed');
    }
  }

  async function patchBrand(id: number, patch: { user_status?: string | null; user_notes?: string | null }) {
    const r = await fetch(`/api/brand/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await r.json();
    if (r.ok) setBrands((bs) => bs.map((b) => (b.id === id ? data.brand : b)));
    else alert(data?.error ?? `HTTP ${r.status}`);
  }

  async function bulkReenrich() {
    if (selected.size === 0) return;
    setRunning('bulk');
    setError(null);
    setLog((l) => [...l, `Bulk re-enrich for ${selected.size} brand(s)…`]);
    try {
      const r = await fetch(`/api/scan/${scan.id}/bulk-reenrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_ids: Array.from(selected) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setLog((l) => [...l, ...(data.log ?? []), `Re-enriched ${data.enriched}/${data.total}.`]);
      await refreshBrands();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  }

  async function bulkSetStatus(status: string | null) {
    if (selected.size === 0) return;
    setRunning('bulk');
    setError(null);
    try {
      const r = await fetch(`/api/scan/${scan.id}/bulk-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_ids: Array.from(selected),
          user_status: status,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setLog((l) => [...l, `Set ${data.updated} brand(s) to ${status ?? 'auto'}`]);
      await refreshBrands();
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  }

  function toggleSelected(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered(ids: number[]) {
    setSelected(new Set(ids));
  }

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return brands.filter((b) => {
      if (hasAdsOnly && !((b.meta_active_ad_count ?? 0) > 0)) return false;
      if (hasEmailOnly && !b.best_email) return false;
      if (notDraftedOnly && b.has_drafts) return false;
      if (filterStatus && (b.user_status ?? b.status) !== filterStatus) return false;
      if (q) {
        const hay = `${b.brand_name} ${b.domain} ${b.best_email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [brands, filterStatus, filterText, hasAdsOnly, hasEmailOnly, notDraftedOnly]);

  const summary = useMemo(() => {
    let qualified = 0;
    let withAds = 0;
    let withEmail = 0;
    let withDraft = 0;
    let withSent = 0;
    let trafficBuckets = { small: 0, sweet: 0, large: 0 };
    let bestLead = 0;
    let avgLead = 0;
    let leadCount = 0;
    for (const b of brands) {
      if ((b.lead_score ?? 0) >= 70) qualified++;
      if ((b.meta_active_ad_count ?? 0) > 0) withAds++;
      if (b.best_email) withEmail++;
      if (b.has_drafts) withDraft++;
      if (b.has_sent_drafts) withSent++;
      const t = b.semrush_organic_traffic != null ? Number(b.semrush_organic_traffic) : 0;
      if (t > 0) {
        if (t < 25_000) trafficBuckets.small++;
        else if (t <= 500_000) trafficBuckets.sweet++;
        else trafficBuckets.large++;
      }
      if (b.lead_score != null) {
        leadCount++;
        avgLead += b.lead_score;
        if (b.lead_score > bestLead) bestLead = b.lead_score;
      }
    }
    return {
      qualified,
      withAds,
      withEmail,
      withDraft,
      withSent,
      trafficBuckets,
      bestLead,
      avgLead: leadCount > 0 ? Math.round(avgLead / leadCount) : 0,
    };
  }, [brands]);

  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center gap-3 flex-wrap">
        <button className="btn" disabled={!!running} onClick={() => discover()}>
          {running === 'discover'
            ? `Discovering… (${brands.length})`
            : brands.length > 0
              ? 'Re-run discovery'
              : 'Discover brands'}
        </button>
        {scanStatus === 'discovering' && running !== 'discover' && (
          <span className="pill text-amber-300 border-amber-700/50">
            discovery in progress · {brands.length} so far
          </span>
        )}
        <button
          className="btn-ghost"
          disabled={!!running || brands.length === 0}
          onClick={enrichAll}
          title="Run SEMrush + Meta Ad Library + Hunter for every brand"
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

      {brands.length > 0 && <SummaryCard total={brands.length} s={summary} />}

      <FilterBar
        statuses={USER_STATUSES}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterText={filterText}
        setFilterText={setFilterText}
        hasAdsOnly={hasAdsOnly}
        setHasAdsOnly={setHasAdsOnly}
        hasEmailOnly={hasEmailOnly}
        setHasEmailOnly={setHasEmailOnly}
        notDraftedOnly={notDraftedOnly}
        setNotDraftedOnly={setNotDraftedOnly}
        total={brands.length}
        shown={filtered.length}
        applyPreset={(preset) => {
          // reset everything first
          setFilterStatus('');
          setFilterText('');
          setHasAdsOnly(false);
          setHasEmailOnly(false);
          if (preset === 'best') {
            setHasEmailOnly(true);
            setHasAdsOnly(true);
          } else if (preset === 'qualified') {
            setFilterStatus('Qualified');
          } else if (preset === 'needs_review') {
            setFilterStatus('Needs Review');
          } else if (preset === 'not_contacted') {
            // no-op beyond reset; the table is sorted by lead score already
          }
        }}
      />

      {log.length > 0 && (
        <details className="card p-4">
          <summary className="text-sm text-muted cursor-pointer">Run log ({log.length})</summary>
          <pre className="text-xs whitespace-pre-wrap mt-2 text-muted">{log.join('\n')}</pre>
        </details>
      )}

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          statuses={USER_STATUSES}
          busy={running === 'bulk'}
          onReenrich={bulkReenrich}
          onSetStatus={bulkSetStatus}
          onClear={() => setSelected(new Set())}
        />
      )}

      <BrandTable
        brands={filtered}
        expanded={expanded}
        setExpanded={setExpanded}
        reenrichOne={reenrichOne}
        patchBrand={patchBrand}
        statuses={USER_STATUSES}
        selected={selected}
        toggleSelected={toggleSelected}
        selectAllFiltered={() =>
          selectAllFiltered(filtered.map((b) => b.id!).filter((n) => Number.isFinite(n)))
        }
      />
    </div>
  );
}

function FilterBar(props: {
  statuses: string[];
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  filterText: string;
  setFilterText: (s: string) => void;
  hasAdsOnly: boolean;
  setHasAdsOnly: (v: boolean) => void;
  hasEmailOnly: boolean;
  setHasEmailOnly: (v: boolean) => void;
  notDraftedOnly: boolean;
  setNotDraftedOnly: (v: boolean) => void;
  total: number;
  shown: number;
  applyPreset: (p: 'best' | 'qualified' | 'needs_review' | 'not_contacted') => void;
}) {
  return (
    <div className="card p-4 flex items-center gap-3 flex-wrap text-sm">
      <div className="flex gap-1">
        <button className="pill cursor-pointer hover:border-accent" onClick={() => props.applyPreset('best')}>
          🎯 Best leads
        </button>
        <button className="pill cursor-pointer hover:border-accent" onClick={() => props.applyPreset('qualified')}>
          ✓ Qualified
        </button>
        <button className="pill cursor-pointer hover:border-accent" onClick={() => props.applyPreset('needs_review')}>
          ? Needs review
        </button>
      </div>
      <div className="w-px h-6 bg-line" />
      <input
        className="input"
        style={{ width: 220 }}
        placeholder="Search brand / domain / email"
        value={props.filterText}
        onChange={(e) => props.setFilterText(e.target.value)}
      />
      <select
        className="input"
        style={{ width: 200 }}
        value={props.filterStatus}
        onChange={(e) => props.setFilterStatus(e.target.value)}
      >
        <option value="">All statuses</option>
        {props.statuses.filter(Boolean).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={props.hasAdsOnly}
          onChange={(e) => props.setHasAdsOnly(e.target.checked)}
        />
        Has live ads
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={props.hasEmailOnly}
          onChange={(e) => props.setHasEmailOnly(e.target.checked)}
        />
        Has email
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={props.notDraftedOnly}
          onChange={(e) => props.setNotDraftedOnly(e.target.checked)}
        />
        Not yet drafted
      </label>
      <span className="ml-auto text-muted">
        {props.shown} / {props.total}
      </span>
    </div>
  );
}

function SummaryCard({
  total,
  s,
}: {
  total: number;
  s: {
    qualified: number;
    withAds: number;
    withEmail: number;
    withDraft: number;
    withSent: number;
    trafficBuckets: { small: number; sweet: number; large: number };
    bestLead: number;
    avgLead: number;
  };
}) {
  const trafficTotal =
    s.trafficBuckets.small + s.trafficBuckets.sweet + s.trafficBuckets.large;
  return (
    <div className="card p-5 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
      <SummaryStat label="Brands" value={String(total)} />
      <SummaryStat
        label="Qualified ≥70"
        value={`${s.qualified}`}
        sub={total > 0 ? `${Math.round((s.qualified / total) * 100)}%` : ''}
      />
      <SummaryStat label="With live ads" value={String(s.withAds)} />
      <SummaryStat label="With email" value={String(s.withEmail)} />
      <SummaryStat
        label="Drafted"
        value={`${s.withDraft}`}
        sub={s.withSent > 0 ? `${s.withSent} sent` : undefined}
      />
      <SummaryStat
        label="Avg / best lead"
        value={`${s.avgLead} / ${s.bestLead}`}
      />
      {trafficTotal > 0 && (
        <div className="col-span-2 md:col-span-6 flex items-center gap-2 text-xs text-muted">
          <span>Traffic distribution:</span>
          <Bar
            label={`<25k (${s.trafficBuckets.small})`}
            pct={(s.trafficBuckets.small / trafficTotal) * 100}
            color="#7a828d"
          />
          <Bar
            label={`25k-500k sweet spot (${s.trafficBuckets.sweet})`}
            pct={(s.trafficBuckets.sweet / trafficTotal) * 100}
            color="#ff7a45"
          />
          <Bar
            label={`>500k (${s.trafficBuckets.large})`}
            pct={(s.trafficBuckets.large / trafficTotal) * 100}
            color="#7a828d"
          />
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-xl font-semibold leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex-1 min-w-[80px]" title={label}>
      <div className="text-xs whitespace-nowrap text-muted truncate">{label}</div>
      <div className="h-2 rounded overflow-hidden bg-panel border border-line">
        <div style={{ width: `${pct}%`, background: color, height: '100%' }} />
      </div>
    </div>
  );
}

function BulkBar({
  count,
  statuses,
  busy,
  onReenrich,
  onSetStatus,
  onClear,
}: {
  count: number;
  statuses: string[];
  busy: boolean;
  onReenrich: () => void;
  onSetStatus: (s: string | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="card p-4 flex items-center gap-3 flex-wrap text-sm border-accent">
      <strong>{count} selected</strong>
      <button className="btn-ghost" disabled={busy} onClick={onReenrich}>
        {busy ? 'Re-enriching…' : 'Re-enrich selected'}
      </button>
      <select
        className="input"
        style={{ width: 220 }}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) onSetStatus(v);
          e.currentTarget.value = '';
        }}
      >
        <option value="" disabled>
          Set status to…
        </option>
        <option value="">— clear override —</option>
        {statuses.filter(Boolean).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button className="btn-ghost ml-auto" onClick={onClear}>
        clear selection
      </button>
    </div>
  );
}

type SortKey =
  | 'brand_name'
  | 'category_fit'
  | 'semrush_organic_traffic'
  | 'traffic_score'
  | 'meta_active_ad_count'
  | 'meta_ads_score'
  | 'best_email'
  | 'lead_score'
  | 'last_checked';

function BrandTable({
  brands,
  expanded,
  setExpanded,
  reenrichOne,
  patchBrand,
  statuses,
  selected,
  toggleSelected,
  selectAllFiltered,
}: {
  brands: BrandRecord[];
  expanded: number | null;
  setExpanded: (id: number | null) => void;
  reenrichOne: (id: number) => void;
  patchBrand: (id: number, p: { user_status?: string | null; user_notes?: string | null }) => void;
  statuses: string[];
  selected: Set<number>;
  toggleSelected: (id: number) => void;
  selectAllFiltered: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('lead_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...brands];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      const an = av == null ? Number.NEGATIVE_INFINITY : Number(av);
      const bn = bv == null ? Number.NEGATIVE_INFINITY : Number(bv);
      if (typeof av === 'string' || typeof bv === 'string') {
        const aa = (av ?? '').toString().toLowerCase();
        const bb = (bv ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? aa.localeCompare(bb) : bb.localeCompare(aa);
      }
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        return sortDir === 'asc' ? an - bn : bn - an;
      }
      return 0;
    });
    return arr;
  }, [brands, sortKey, sortDir]);

  function H({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => {
          if (active) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          else {
            setSortKey(k);
            setSortDir('desc');
          }
        }}
        className={`cursor-pointer select-none ${active ? 'text-accent' : ''}`}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="card p-6 text-muted text-sm">
        No brands match this filter.
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                title="Select all visible"
                checked={brands.length > 0 && brands.every((b) => selected.has(b.id!))}
                onChange={(e) =>
                  e.target.checked
                    ? selectAllFiltered()
                    : brands.forEach((b) => selected.has(b.id!) && toggleSelected(b.id!))
                }
              />
            </th>
            <th></th>
            <H k="brand_name" label="Brand" />
            <th>Website</th>
            <H k="category_fit" label="Fit" />
            <H k="semrush_organic_traffic" label="Traffic / mo" />
            <H k="traffic_score" label="T-Score" />
            <H k="meta_active_ad_count" label="Live ads" />
            <H k="meta_ads_score" label="M-Score" />
            <th>Amazon</th>
            <th>Shopify</th>
            <H k="best_email" label="Best email" />
            <th>Conf</th>
            <H k="lead_score" label="Lead" />
            <th>Status</th>
            <H k="last_checked" label="Checked" />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const isOpen = expanded === b.id;
            const effectiveStatus = b.user_status ?? b.status;
            return (
              <Fragment key={b.id}>
                <tr className={isOpen ? 'bg-panel/40' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(b.id!)}
                      onChange={() => toggleSelected(b.id!)}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => setExpanded(isOpen ? null : (b.id ?? null))}
                      aria-label={isOpen ? 'collapse' : 'expand'}
                    >
                      {isOpen ? '−' : '+'}
                    </button>
                  </td>
                  <td className="font-medium">{b.brand_name}</td>
                  <td>
                    <a
                      className="text-accent hover:underline"
                      href={`https://${b.domain}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {b.domain}
                    </a>
                  </td>
                  <td>{cell(b.category_fit)}</td>
                  <td>
                    {b.semrush_organic_traffic != null
                      ? Math.round(Number(b.semrush_organic_traffic)).toLocaleString()
                      : '—'}
                  </td>
                  <td>{cell(b.traffic_score)}</td>
                  <td>{b.meta_active_ad_count != null ? b.meta_active_ad_count : '—'}</td>
                  <td>{cell(b.meta_ads_score)}</td>
                  <td>
                    {b.amazon_url ? (
                      <a
                        className="text-accent"
                        href={b.amazon_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        yes
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{b.shopify_detected ? 'yes' : '—'}</td>
                  <td className="max-w-[180px]">
                    {b.best_email ? (
                      <span className="flex items-center gap-1">
                        <span className="truncate" title={b.best_email}>
                          {b.best_email}
                        </span>
                        <button
                          className="btn-ghost text-xs px-1 py-0"
                          title="Copy email"
                          onClick={() => {
                            void navigator.clipboard.writeText(b.best_email!);
                          }}
                        >
                          ⎘
                        </button>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{b.email_confidence != null ? b.email_confidence : '—'}</td>
                  <td>{b.lead_score != null ? <strong>{b.lead_score}</strong> : '—'}</td>
                  <td>
                    <span className={`pill ${b.user_status ? 'border-accent text-accent' : ''}`}>
                      {effectiveStatus}
                    </span>
                  </td>
                  <td className="text-muted text-xs">
                    {b.last_checked ? formatTimeAgo(b.last_checked) : '—'}
                  </td>
                  <td>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => reenrichOne(b.id!)}
                      title="Re-run SEMrush + Meta + Hunter for this brand"
                    >
                      ↻
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={17} className="bg-panel/30">
                      <BrandDetail
                        b={b}
                        statuses={statuses}
                        patchBrand={(p) => patchBrand(b.id!, p)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const DEFAULT_PITCH_KEY = 'cas:outreach_pitch';

function BrandDetail({
  b,
  statuses,
  patchBrand,
}: {
  b: BrandRecord;
  statuses: string[];
  patchBrand: (p: { user_status?: string | null; user_notes?: string | null }) => void;
}) {
  const [pitch, setPitch] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(DEFAULT_PITCH_KEY) ?? '';
  });
  const [tone, setTone] = useState<'professional' | 'warm' | 'punchy'>('professional');
  const [draft, setDraft] = useState<
    | null
    | { id?: number; subject: string; body: string; notes?: string; sent_at?: string | null }
  >(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: number;
      subject: string;
      body: string;
      notes: string | null;
      created_at: string;
      sent_at: string | null;
      tone: string | null;
    }>
  >([]);

  async function loadHistory() {
    try {
      const r = await fetch(`/api/brand/${b.id}/draft`);
      if (!r.ok) return;
      const d = await r.json();
      setHistory(d.drafts ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id]);

  async function generateDraft() {
    setDrafting(true);
    setDraftError(null);
    setDraft(null);
    if (typeof window !== 'undefined') localStorage.setItem(DEFAULT_PITCH_KEY, pitch);
    try {
      const r = await fetch(`/api/brand/${b.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_pitch: pitch, tone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setDraft({ id: d.draft_id, subject: d.subject, body: d.body, notes: d.notes, sent_at: null });
      await loadHistory();
    } catch (e: any) {
      setDraftError(e?.message ?? 'failed');
    } finally {
      setDrafting(false);
    }
  }

  async function markSent(draftId: number) {
    const r = await fetch(`/api/draft/${draftId}`, { method: 'POST' });
    if (r.ok) {
      await loadHistory();
      if (draft && draft.id === draftId) setDraft({ ...draft, sent_at: new Date().toISOString() });
    }
  }

  async function deleteDraft(draftId: number) {
    if (!confirm('Delete this draft?')) return;
    const r = await fetch(`/api/draft/${draftId}`, { method: 'DELETE' });
    if (r.ok) {
      await loadHistory();
      if (draft && draft.id === draftId) setDraft(null);
    }
  }

  function copy(s: string) {
    void navigator.clipboard.writeText(s);
  }

  function mailto() {
    if (!draft || !b.best_email) return;
    const url = `mailto:${encodeURIComponent(b.best_email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.location.href = url;
  }
  const socials = parseJson<Array<{ platform: string; url: string }>>(b.socials_json) ?? [];
  const raw = parseJson<{
    search_hits?: Array<{ url: string; title: string; description?: string }>;
    homepage_status?: string;
    final_url?: string | null;
    klaviyo?: boolean;
    product_paths?: string[];
    llm_fit?: { score: number; reason: string };
  }>(b.raw_sources_json);
  const hunterEmails = parseJson<
    Array<{
      value: string;
      type?: string;
      confidence?: number;
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
    }>
  >(b.hunter_emails_json);
  const creativeTypes = parseJson<string[]>(b.meta_creative_types) ?? [];
  const topHooks = parseJson<string[]>(b.meta_top_hooks) ?? [];

  const [notes, setNotes] = useState<string>(b.user_notes ?? '');

  return (
    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
      <section>
        {raw?.llm_fit && (
          <div className="mb-3 text-xs text-muted">
            <span className="pill mr-1">LLM fit {raw.llm_fit.score}</span>
            <em>{raw.llm_fit.reason}</em>
          </div>
        )}
        <h4 className="font-semibold mb-2">Operator</h4>
        <label className="text-xs text-muted block mb-1">Status override</label>
        <select
          className="input mb-3"
          value={b.user_status ?? ''}
          onChange={(e) => patchBrand({ user_status: e.target.value || null })}
        >
          <option value="">— follow auto status ({b.status}) —</option>
          {statuses.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="text-xs text-muted block mb-1">Notes</label>
        <textarea
          className="input"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() =>
            (notes ?? '') !== (b.user_notes ?? '') && patchBrand({ user_notes: notes || null })
          }
          placeholder="who I emailed, replies, anything to remember"
        />
        {b.user_updated_at && (
          <div className="text-xs text-muted mt-1">
            edited {String(b.user_updated_at)}
          </div>
        )}
      </section>

      <section>
        <h4 className="font-semibold mb-2">Meta Ad Library</h4>
        {b.meta_ads_found == null ? (
          <p className="text-muted">No Meta data — set META_COWORK_URL or click ↻.</p>
        ) : (
          <ul className="space-y-1">
            <li>Active ads: <strong>{b.meta_active_ad_count ?? 0}</strong></li>
            <li>Confidence: {b.meta_confidence ?? '—'}</li>
            {b.meta_main_offer && <li>Offer: <em>{b.meta_main_offer}</em></li>}
            {creativeTypes.length > 0 && (
              <li>Creative types: {creativeTypes.join(', ')}</li>
            )}
            {topHooks.length > 0 && <li>Top hooks: {topHooks.join('; ')}</li>}
            {b.meta_ad_library_url && (
              <li>
                <a className="text-accent" href={b.meta_ad_library_url} target="_blank" rel="noreferrer">
                  Open Ad Library →
                </a>
              </li>
            )}
          </ul>
        )}

        <h4 className="font-semibold mt-4 mb-2">Socials</h4>
        {socials.length === 0 ? (
          <p className="text-muted">none detected</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {socials.map((s) => (
              <li key={s.url}>
                <a className="pill text-accent" href={s.url} target="_blank" rel="noreferrer">
                  {s.platform}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="md:col-span-3">
        <h4 className="font-semibold mb-2">Outreach</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <textarea
            className="input md:col-span-2"
            rows={2}
            placeholder="One-line sender pitch — what do you do? (saved locally)"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
          />
          <div className="flex items-stretch gap-2">
            <select
              className="input"
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
            >
              <option value="professional">professional</option>
              <option value="warm">warm</option>
              <option value="punchy">punchy</option>
            </select>
            <button
              className="btn"
              disabled={drafting || !pitch.trim()}
              onClick={generateDraft}
              title="Generate a brand-specific cold email"
            >
              {drafting ? '…' : 'Draft'}
            </button>
          </div>
        </div>
        {draftError && <div className="text-red-400 text-xs mb-2">{draftError}</div>}
        {draft && (
          <div className="border border-line rounded p-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <strong>Subject:</strong>
              <button className="btn-ghost text-xs" onClick={() => copy(draft.subject)}>
                copy
              </button>
            </div>
            <div className="font-mono text-sm">{draft.subject}</div>
            <hr className="border-line" />
            <div className="flex items-baseline justify-between gap-2">
              <strong>Body:</strong>
              <div className="flex gap-2 flex-wrap">
                <button className="btn-ghost text-xs" onClick={() => copy(draft.body)}>
                  copy body
                </button>
                {b.best_email && (
                  <button className="btn-ghost text-xs" onClick={mailto}>
                    open in mail →
                  </button>
                )}
                {draft.id && !draft.sent_at && (
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => markSent(draft.id!)}
                    title="Mark this draft as sent (bumps brand to Contacted)"
                  >
                    mark sent
                  </button>
                )}
                {draft.sent_at && (
                  <span className="pill text-emerald-300 border-emerald-700/50">
                    sent {formatTimeAgo(draft.sent_at)}
                  </span>
                )}
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm">{draft.body}</pre>
            {draft.notes && (
              <div className="text-xs text-muted italic border-t border-line pt-2">
                {draft.notes}
              </div>
            )}
          </div>
        )}
        {history.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted cursor-pointer">
              Draft history ({history.length})
            </summary>
            <ul className="mt-2 space-y-2 text-xs">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="border border-line rounded p-2 hover:border-accent cursor-pointer"
                  onClick={() =>
                    setDraft({
                      id: h.id,
                      subject: h.subject,
                      body: h.body,
                      notes: h.notes ?? undefined,
                      sent_at: h.sent_at,
                    })
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <strong className="truncate">{h.subject}</strong>
                    <span className="text-muted flex items-center gap-2">
                      {h.sent_at ? (
                        <span className="pill text-emerald-300 border-emerald-700/50">
                          sent
                        </span>
                      ) : (
                        <span className="pill">draft</span>
                      )}
                      {formatTimeAgo(h.created_at)}
                      <button
                        className="text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteDraft(h.id);
                        }}
                        title="Delete this draft"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  <div className="text-muted truncate">{h.body.slice(0, 140)}…</div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <h4 className="font-semibold mb-2">Hunter emails</h4>
        {!hunterEmails || hunterEmails.length === 0 ? (
          <p className="text-muted">no emails returned</p>
        ) : (
          <ul className="space-y-1 text-xs max-h-48 overflow-y-auto">
            {hunterEmails.map((e) => (
              <li key={e.value} className="flex items-baseline gap-2">
                <span className="pill">{e.confidence ?? '?'}</span>
                <span className="font-mono">{e.value}</span>
                <span className="text-muted">
                  {[e.first_name, e.last_name].filter(Boolean).join(' ')}{' '}
                  {e.position ? `· ${e.position}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h4 className="font-semibold mt-4 mb-2">Discovery sources</h4>
        {raw?.search_hits?.length ? (
          <ul className="space-y-1 text-xs max-h-48 overflow-y-auto">
            {raw.search_hits.slice(0, 6).map((h, i) => (
              <li key={i}>
                <a className="text-accent" href={h.url} target="_blank" rel="noreferrer">
                  {h.title || h.url}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">no search hits stored</p>
        )}
        {raw?.product_paths?.length ? (
          <p className="text-xs text-muted mt-2">{raw.product_paths.length} product/collection paths detected</p>
        ) : null}
      </section>
    </div>
  );
}

function cell(v: number | null | undefined) {
  if (v == null) return '—';
  return v;
}

function formatTimeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(t).toISOString().slice(0, 10);
}

function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
