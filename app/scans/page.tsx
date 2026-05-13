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
  let rows: ScanRow[] = [];
  let dbError: string | null = null;

  if (!process.env.DATABASE_URL) {
    dbError = 'DATABASE_URL is not set. Add it in Railway → Variables and redeploy.';
  } else {
    try {
      const raw = await sql()<ScanRow[]>`
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
      rows = raw.map((r) => ({ ...r, created_at: String(r.created_at) }));
    } catch (e: any) {
      dbError = e?.message ?? 'database error';
    }
  }

  return (
    <main className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Scans</h1>
        <Link className="btn-ghost" href="/">+ New scan</Link>
      </div>
      {dbError && (
        <div className="card p-5 border-amber-700/50">
          <p className="text-sm text-amber-300 mb-1">Database unavailable</p>
          <p className="text-xs text-muted">{dbError}</p>
          <p className="text-xs text-muted mt-2">
            Visit <Link className="text-accent" href="/settings">/settings</Link> to see which
            integrations are configured.
          </p>
        </div>
      )}
      {!dbError && <ScansListClient rows={rows} />}
    </main>
  );
}
