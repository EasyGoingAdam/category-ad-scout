'use client';

import { useState } from 'react';
import type { CategorySuggestion } from '@/lib/types';

export default function Home() {
  const [category, setCategory] = useState('');
  const [seed, setSeed] = useState('');
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState<'none' | 'brainstorm' | 'scan'>('none');
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="space-y-8">
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
              <CategoryCard key={s.category} s={s} onPick={() => startScan(s.category)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CategoryCard({ s, onPick }: { s: CategorySuggestion; onPick: () => void }) {
  return (
    <div className="border border-line rounded-md p-4 hover:border-accent transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold capitalize">{s.category}</h3>
        <button className="btn-ghost text-xs" onClick={onPick}>Use →</button>
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
  return (
    <span className={`pill ${tone}`}>{label} {v}</span>
  );
}
