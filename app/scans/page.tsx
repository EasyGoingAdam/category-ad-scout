import { sql } from '@/lib/db';
import Link from 'next/link';
import ScansListClient from './ScansListClient';

export const dynamic = 'force-dynamic';

type ScanRow = {
  id: number;
  category: string;
  created_at: string;
  status: string;
  brand_count: number;
  qualified_count: number;
  best_lead_score: number | null;
};

export default async function ScansPage() {
  const rowsRaw = await sql()<ScanRow[]>`
    SELECT
      s.id,
      s.category,
      s.created_at,
      s.status,
      COALESCE(b.cnt, 0)::int   AS brand_count,
      COALESCE(b.qual, 0)::int  AS qualified_count,
      b.best_score              AS best_lead_score
    FROM scans s
    LEFT JOIN (
      SELECT scan_id,
             COUNT(*)                                       AS cnt,
             COUNT(*) FILTER (WHERE lead_score >= 70)       AS qual,
             MAX(lead_score)                                AS best_score
      FROM brands
      GROUP BY scan_id
    ) b ON b.scan_id = s.id
    ORDER BY s.id DESC
    LIMIT 100
  `;
  const rows = rowsRaw.map((r) => ({ ...r, created_at: String(r.created_at) }));
  return (
    <main className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Scans</h1>
        <Link className="btn-ghost" href="/">+ New scan</Link>
      </div>
      <ScansListClient rows={rows} />
    </main>
  );
}
