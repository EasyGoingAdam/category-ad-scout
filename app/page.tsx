'use client';

import { useEffect, useState } from 'react';
import type { CategorySuggestion } from '@/lib/types';

type Integration = { configured: boolean; vars: string[]; provider?: string | null };

type SavedCategory = {
  id: number;
  category: string;
  rationale: string | null;
  amazon_fit: number | null;
  dtc_potential: number | null;
  meta_ad_likelihood: number | null;
  brand_density: number | null;
  example_brands: string[];
  last_scan_id: number | null;
  last_scanned_at: string | null;
  created_at: string;
};

export default function Home() {
  const [needsSetup, setNeedsSetup] = useState<null | Array<{ name: string; vars: string }>>(
    null,
  );
  const [category, setCategory] = useState('');
  const [seed, setSeed] = useState('');
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<SavedCategory[] | null>(null);
  const [loading, setLoading] = useState<'none' | 'brainstorm' | 'scan'>('none');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        const blocking: Array<{ name: string; vars: string }> = [];
        const req: Array<[string, string]> = [
          ['database', 'Database'],
          ['anthropic', 'Anthropic (for brainstorming)'],
          ['search', 'Search provider (for discovery)'],
        ];
        for (const [k, label] of req) {
          const i: Integration | undefined = d.integrations?.[k];
          if (i && !i.configured) blocking.push({ name: label, vars: i.vars.join(' / ') });
        }
        setNeedsSetup(blocking);
      })
      .catch(() => setNeedsSetup(null));

    void loadSaved();
  }, []);

  async function loadSaved() {
    try {
      const r = await fetch('/api/saved-categories');
      if (!r.ok) return;
      const d = await r.json();
      const arr: SavedCategory[] = d.categories ?? [];
      setSaved(arr);
      setSavedSet(new Set(arr.map((s) => s.category.toLowerCase())));
    } catch {
      /* ignore */
    }
  }

  async function brainstorm() {
    setLoading('brainstorm');
    setError(null);
    try {
      const r = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seed.trim() || undefined, count: 12 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setSuggestions(data.categories ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to brainstorm');
    } finally {
      setLoading('none');
    }
  }

  async function startScan(cat: string) {
    if (!cat.trim()) return;
    setLoading('scan');
    setError(null);
    try {
      const r = await fetch('/api/scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      window.location.href = `/scans/${data.scan_id}`;
    } catch (e: any) {
      setError(e.message ?? 'Failed to start scan');
    } finally {
      setLoading('none');
    }
  }

  async function saveCategory(s: CategorySuggestion) {
    try {
      const r = await fetch('/api/saved-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSavedSet((prev) => new Set([...prev, s.category.toLowerCase()]));
      await loadSaved();
    } catch (e: any) {
      alert(e?.message ?? 'save failed');
    }
  }

  async function removeSaved(id: number) {
    if (!confirm('Remove this saved category?')) return;
    await fetch(`/api/saved-categories/${id}`, { method: 'DELETE' });
    await loadSaved();
  }

  return (
    <main className="space-y-8">
      {needsSetup && needsSetup.length > 0 && (
        <section className="card p-5 border-amber-700/50">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-amber-300">Finish setup before your first scan</h3>
              <p className="text-sm text-muted">
                These integrations are missing. Add the env vars and restart the service.
              </p>
            </div>
            <a className="btn-ghost text-sm" href="/settings">
              Open settings →
            </a>
          </div>
          <ul className="mt-3 text-sm space-y-1">
            {needsSetup.map((n) => (
              <li key={n.name}>
                <span className="pill border-amber-700/50 text-amber-300 mr-2">missing</span>
                <strong>{n.name}</strong>{' '}
                <span className="text-muted font-mono text-xs">{n.vars}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-6">
        <h1 className="text-2xl font-semibold mb-1">Find ecommerce brands worth contacting</h1>
        <p className="text-muted text-sm mb-5">
          Enter a category. We discover brands, score traffic, check for live Meta ads,
          find emails, and rank them.
        </p>

        <div className="flex gap-3">
          <input
            className="input"
            placeholder="e.g. dog supplements, pickleball paddles, mushroom coffee"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startScan(category)}
          />
          <button
            className="btn"
            onClick={() => startScan(category)}
            disabled={!category.trim() || loading !== 'none'}
          >
            {loading === 'scan' ? 'Starting…' : 'Scan'}
          </button>
        </div>
      </section>

      {saved && saved.length > 0 && (
        <section className="card p-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">Saved categories</h2>
            <p className="text-xs text-muted">{saved.length}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((s) => (
              <div key={s.id} className="border border-line rounded-md p-3 hover:border-accent">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="font-semibold capitalize">{s.category}</h3>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => startScan(s.category)}
                    disabled={loading !== 'none'}
                  >
                    rescan →
                  </button>
                </div>
                {s.rationale && (
                  <p className="text-xs text-muted mb-2 line-clamp-2">{s.rationale}</p>
                )}
                <div className="text-xs text-muted flex items-center justify-between">
                  <span>
                    {s.last_scan_id ? (
                      <a className="text-accent" href={`/scans/${s.last_scan_id}`}>
                        last scan #{s.last_scan_id}
                      </a>
                    ) : (
                      'never scanned'
                    )}
                  </span>
                  <button
                    className="text-red-400 hover:text-red-300 text-xs"
                    onClick={() => removeSaved(s.id)}
                    title="Remove from saved"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card p-6">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Don't have a category?</h2>
            <p className="text-muted text-sm">Brainstorm Amazon-friendly DTC categories.</p>
          </div>
          <div className="flex gap-2 items-center">
            <input
              className="input"
              style={{ width: 260 }}
              placeholder="Optional theme (e.g. pet, sleep, fitness)"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
            <button
              className="btn-ghost"
              onClick={brainstorm}
              disabled={loading !== 'none'}
            >
              {loading === 'brainstorm' ? 'Thinking…' : 'Brainstorm'}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 mb-3 border border-red-900 rounded p-3 bg-red-950/30">
            {error}
          </div>
        )}

        {suggestions.length === 0 ? (
          <p className="text-muted text-sm">
            No suggestions yet. Click <em>Brainstorm</em> to generate categories.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((s) => (
              <CategoryCard
                key={s.category}
                s={s}
                isSaved={savedSet.has(s.category.toLowerCase())}
                onPick={() => startScan(s.category)}
                onSave={() => saveCategory(s)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CategoryCard({
  s,
  isSaved,
  onPick,
  onSave,
}: {
  s: CategorySuggestion;
  isSaved: boolean;
  onPick: () => void;
  onSave: () => void;
}) {
  return (
    <div className="border border-line rounded-md p-4 hover:border-accent transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold capitalize">{s.category}</h3>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={onSave}
            disabled={isSaved}
            title={isSaved ? 'Already saved' : 'Save for later'}
          >
            {isSaved ? '✓ saved' : '☆ save'}
          </button>
          <button className="btn-ghost text-xs" onClick={onPick}>
            Use →
          </button>
        </div>
      </div>
      <p className="text-sm text-muted mb-3 leading-snug">{s.rationale}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <Score label="Amazon" v={s.amazon_fit} />
        <Score label="DTC" v={s.dtc_potential} />
        <Score label="Meta ads" v={s.meta_ad_likelihood} />
        <Score label="Brand density" v={s.brand_density} />
      </div>
      {s.example_brands?.length > 0 && (
        <div className="text-xs text-muted">
          Examples: {s.example_brands.slice(0, 5).join(', ')}
        </div>
      )}
    </div>
  );
}

function Score({ label, v }: { label: string; v: number }) {
  const tone =
    v >= 80 ? 'text-emerald-300 border-emerald-700/50' :
    v >= 60 ? 'text-amber-300 border-amber-700/50' :
              'text-muted border-line';
  return <span className={`pill ${tone}`}>{label} {v}</span>;
}
