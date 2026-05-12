'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Card = {
  id: number;
  brand_name: string;
  domain: string;
  user_status: string;
  best_email: string | null;
  lead_score: number | null;
  meta_active_ad_count: number | null;
  semrush_organic_traffic: number | null;
  user_notes: string | null;
  user_updated_at: string | null;
  scan_id: number;
  category: string;
};

const COLUMNS: Array<{ status: string; tone: string }> = [
  { status: 'Qualified', tone: 'border-amber-700/50 text-amber-300' },
  { status: 'Contact Found', tone: 'border-sky-700/50 text-sky-300' },
  { status: 'Contacted', tone: 'border-violet-700/50 text-violet-300' },
  { status: 'Replied', tone: 'border-emerald-700/50 text-emerald-300' },
  { status: 'Closed', tone: 'border-line text-muted' },
];

export default function PipelineClient() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/pipeline');
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setCards(d.brands ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'failed');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function move(id: number, status: string | null) {
    const r = await fetch(`/api/brand/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_status: status }),
    });
    if (r.ok) await load();
    else {
      const d = await r.json().catch(() => ({}));
      alert(d?.error ?? `HTTP ${r.status}`);
    }
  }

  if (error) return <div className="card p-5 text-red-400">{error}</div>;
  if (!cards) return <div className="card p-5 text-muted">Loading…</div>;
  if (cards.length === 0) {
    return (
      <div className="card p-6 text-muted text-sm">
        No brands in the pipeline yet. Open a scan and set a user status on a brand
        (or use bulk-status) to add cards here.
      </div>
    );
  }

  const byStatus = new Map<string, Card[]>();
  for (const c of cards) {
    const arr = byStatus.get(c.user_status) ?? [];
    arr.push(c);
    byStatus.set(c.user_status, arr);
  }
  const otherStatuses = Array.from(byStatus.keys()).filter(
    (s) => !COLUMNS.find((c) => c.status === s),
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...COLUMNS, ...otherStatuses.map((s) => ({ status: s, tone: 'border-line' }))].map(
        (col) => (
          <Column
            key={col.status}
            title={col.status}
            tone={col.tone}
            items={byStatus.get(col.status) ?? []}
            onMove={move}
          />
        ),
      )}
    </div>
  );
}

function Column({
  title,
  tone,
  items,
  onMove,
}: {
  title: string;
  tone: string;
  items: Card[];
  onMove: (id: number, status: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className={`pill ${tone} w-full flex items-center justify-between`}>
        <span>{title}</span>
        <span className="text-xs">{items.length}</span>
      </div>
      {items.map((c) => (
        <CardView key={c.id} c={c} onMove={onMove} />
      ))}
      {items.length === 0 && (
        <div className="border border-dashed border-line rounded p-3 text-xs text-muted">
          empty
        </div>
      )}
    </div>
  );
}

function CardView({ c, onMove }: { c: Card; onMove: (id: number, status: string | null) => void }) {
  return (
    <div className="card p-3 text-sm space-y-1">
      <div className="font-medium">{c.brand_name}</div>
      <div className="text-muted text-xs">
        <a
          className="text-accent hover:underline"
          href={`https://${c.domain}`}
          target="_blank"
          rel="noreferrer"
        >
          {c.domain}
        </a>{' '}
        · <span className="capitalize">{c.category}</span>
      </div>
      <div className="text-xs flex flex-wrap gap-2 text-muted">
        {c.lead_score != null && <span className="pill">lead {c.lead_score}</span>}
        {c.meta_active_ad_count != null && c.meta_active_ad_count > 0 && (
          <span className="pill">{c.meta_active_ad_count} ads</span>
        )}
        {c.semrush_organic_traffic && (
          <span className="pill">
            {c.semrush_organic_traffic >= 1000
              ? `${Math.round(c.semrush_organic_traffic / 1000)}k/mo`
              : `${c.semrush_organic_traffic}/mo`}
          </span>
        )}
      </div>
      {c.best_email && (
        <div className="text-xs font-mono text-muted truncate" title={c.best_email}>
          {c.best_email}
        </div>
      )}
      {c.user_notes && (
        <div className="text-xs text-muted whitespace-pre-wrap line-clamp-3">{c.user_notes}</div>
      )}
      <div className="flex gap-1 mt-1 flex-wrap">
        {COLUMNS.filter((col) => col.status !== c.user_status).map((col) => (
          <button
            key={col.status}
            className="pill text-xs hover:border-accent"
            onClick={() => onMove(c.id, col.status)}
          >
            → {col.status}
          </button>
        ))}
        <Link className="pill text-xs hover:border-accent" href={`/scans/${c.scan_id}`}>
          open scan
        </Link>
        <button
          className="pill text-xs hover:border-red-700"
          title="Remove from pipeline (clears user_status)"
          onClick={() => onMove(c.id, null)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
