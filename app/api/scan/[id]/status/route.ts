import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  const [row] = await sql()<
    Array<{ id: number; status: string; count: number }>
  >`
    SELECT s.id, s.status,
           (SELECT COUNT(*)::int FROM brands WHERE scan_id = s.id) AS count
    FROM scans s
    WHERE s.id = ${id}
  `;
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row);
}
