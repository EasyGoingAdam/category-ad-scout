import { sql } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ScanClient from './ScanClient';
import type { BrandRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ScanDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();

  if (!process.env.DATABASE_URL) {
    return (
      <main className="space-y-4">
        <div className="card p-5 border-amber-700/50">
          <p className="text-sm text-amber-300 mb-1">Database unavailable</p>
          <p className="text-xs text-muted">
            DATABASE_URL is not set. Add it in Railway → Variables and redeploy.
          </p>
          <p className="text-xs text-muted mt-2">
            Visit <Link className="text-accent" href="/settings">/settings</Link> to see which
            integrations are configured.
          </p>
        </div>
      </main>
    );
  }

  const db = sql();
  const [scan] = await db<
    Array<{
      id: number;
      category: string;
      created_at: string;
      status: string;
      notes: string | null;
    }>
  >`SELECT id, category, created_at, status, notes FROM scans WHERE id = ${id}`;
  if (!scan) return notFound();
  const brands = await db<BrandRecord[]>`
    SELECT b.*,
           EXISTS(SELECT 1 FROM drafts d WHERE d.brand_id = b.id) AS has_drafts,
           EXISTS(SELECT 1 FROM drafts d WHERE d.brand_id = b.id AND d.sent_at IS NOT NULL) AS has_sent_drafts
    FROM brands b
    WHERE b.scan_id = ${id}
    ORDER BY COALESCE(b.lead_score, b.category_fit, 0) DESC, b.brand_name ASC
  `;
  const safeScan = { ...scan, created_at: String(scan.created_at) };
  return (
    <main className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold capitalize">{scan.category}</h1>
        <Link className="btn-ghost" href="/scans">← All scans</Link>
      </div>
      <div className="card p-5 text-sm flex flex-wrap gap-x-6 gap-y-2">
        <div><span className="text-muted">Scan ID:</span> #{scan.id}</div>
        <div><span className="text-muted">Status:</span> <span className="pill">{scan.status}</span></div>
        <div><span className="text-muted">Created:</span> {safeScan.created_at}</div>
        <div><span className="text-muted">Brands:</span> {brands.length}</div>
      </div>
      {scan.notes && (
        <details className="card p-4">
          <summary className="text-sm text-muted cursor-pointer">
            Persisted discovery log ({scan.notes.split('\n').length} lines)
          </summary>
          <pre className="text-xs whitespace-pre-wrap mt-2 text-muted">{scan.notes}</pre>
        </details>
      )}
      <ScanClient
        scan={{ id: scan.id, category: scan.category, status: scan.status, notes: scan.notes }}
        initialBrands={brands.map(serializeBrand)}
      />
    </main>
  );
}

function serializeBrand(b: BrandRecord): BrandRecord {
  return {
    ...b,
    last_checked: b.last_checked ? String(b.last_checked) : null,
    created_at: b.created_at ? String(b.created_at) : undefined,
    user_updated_at: b.user_updated_at ? String(b.user_updated_at) : null,
    email_verified_at: b.email_verified_at ? String(b.email_verified_at) : null,
    semrush_organic_traffic:
      b.semrush_organic_traffic != null ? Number(b.semrush_organic_traffic) : null,
    semrush_paid_traffic:
      b.semrush_paid_traffic != null ? Number(b.semrush_paid_traffic) : null,
  };
}
