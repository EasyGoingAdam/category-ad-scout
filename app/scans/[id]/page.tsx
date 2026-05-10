import { sql } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ScanClient from './ScanClient';
import type { BrandRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ScanDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();
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
    SELECT * FROM brands WHERE scan_id = ${id}
    ORDER BY COALESCE(lead_score, category_fit, 0) DESC, brand_name ASC
  `;
  // postgres-js returns Date for timestamptz; serialize for the client component
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
    semrush_organic_traffic:
      b.semrush_organic_traffic != null ? Number(b.semrush_organic_traffic) : null,
    semrush_paid_traffic:
      b.semrush_paid_traffic != null ? Number(b.semrush_paid_traffic) : null,
  };
}
