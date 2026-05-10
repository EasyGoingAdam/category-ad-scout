'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Row = {
  id: number;
  category: string;
  created_at: string;
  status: string;
  brand_count: number;
  qualified_count: number;
  best_lead_score: number | null;
};

export default function ScansListClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(id: number) {
    if (!confirm(`Delete scan #${id}? This will also delete its brands.`)) return;
    setBusy(id);
    try {
      const r = await fetch(`/api/scan/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? 'failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Category</th>
            <th>Status</th>
            <th>Brands</th>
            <th>Qualified (≥70)</th>
            <th>Top score</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="text-muted text-sm">
                No scans yet. Start one from the home page.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>#{r.id}</td>
              <td className="capitalize">{r.category}</td>
              <td>
                <span className="pill">{r.status}</span>
              </td>
              <td>{r.brand_count}</td>
              <td>{r.qualified_count}</td>
              <td>{r.best_lead_score ?? '—'}</td>
              <td className="text-muted">{r.created_at}</td>
              <td className="flex gap-2">
                <Link className="btn-ghost text-xs" href={`/scans/${r.id}`}>open</Link>
                <button
                  className="btn-ghost text-xs"
                  disabled={busy === r.id}
                  onClick={() => remove(r.id)}
                >
                  {busy === r.id ? '…' : 'delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
