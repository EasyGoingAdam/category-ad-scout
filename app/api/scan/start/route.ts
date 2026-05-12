import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category = String(body?.category ?? '').trim();
  if (!category) return NextResponse.json({ error: 'category is required' }, { status: 400 });

  const db = sql();
  const [row] = await db<{ id: number }[]>`
    INSERT INTO scans (category, status) VALUES (${category}, 'running') RETURNING id
  `;
  const scan_id = Number(row.id);
  // If this category exists in saved_categories, stamp last_scan_id + last_scanned_at.
  await db`
    UPDATE saved_categories
    SET last_scan_id = ${scan_id}, last_scanned_at = NOW()
    WHERE category = ${category}
  `;
  return NextResponse.json({ scan_id, category });
}
