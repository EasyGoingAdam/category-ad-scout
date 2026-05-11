'use client';

import { useState } from 'react';
import type { ScheduleRow } from '@/lib/schedules';

export default function SchedulesClient({ initial }: { initial: ScheduleRow[] }) {
  const [rows, setRows] = useState<ScheduleRow[]>(initial);
  const [category, setCategory] = useState('');
  const [cadence, setCadence] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch('/api/schedules');
    const d = await r.json();
    setRows(d.schedules ?? []);
  }

  async function add() {
    if (!category.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, cadence_days: cadence }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setCategory('');
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: number, enabled: boolean) {
    await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    refresh();
  }

  async function remove(id: number) {
    if (!confirm('Delete this schedule?')) return;
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    refresh();
  }

  async function runOne(id: number) {
    if (!confirm('Run this schedule right now? It will discover + enrich.')) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/schedules/${id}/run`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      await refresh();
      alert(`Done. Scan #${d.scan_id} ${d.alerted ? '(alert sent)' : ''}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/cron/run', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      await refresh();
      alert(`Ran ${d.ran} schedule(s). See Scans for results.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs text-muted block mb-1">Category</label>
            <input
              className="input"
              placeholder="e.g. mushroom coffee"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Cadence (days)</label>
            <input
              type="number"
              min={1}
              max={90}
              className="input"
              style={{ width: 110 }}
              value={cadence}
              onChange={(e) => setCadence(Number(e.target.value))}
            />
          </div>
          <button className="btn" disabled={busy || !category.trim()} onClick={add}>
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={runNow}>
            {busy ? 'Running…' : 'Run due now'}
          </button>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>

      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Every</th>
              <th>Last run</th>
              <th>Next run</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted text-sm">
                  No schedules yet.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td className="capitalize">{s.category}</td>
                <td>{s.cadence_days}d</td>
                <td className="text-muted">{s.last_run_at ?? '—'}</td>
                <td className="text-muted">{s.next_run_at ?? '—'}</td>
                <td>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => toggle(s.id, !s.enabled)}
                  >
                    {s.enabled ? 'on' : 'off'}
                  </button>
                </td>
                <td className="flex gap-2">
                  <button className="btn-ghost text-xs" disabled={busy} onClick={() => runOne(s.id)}>
                    run now
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => remove(s.id)}>
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
