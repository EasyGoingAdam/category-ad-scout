import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category = String(body?.category ?? '').trim();
  if (!category) return NextResponse.json({ error: 'category is required' }, { status: 400 });

  const [row] = await sql()<{ id: number }[]>`
    INSERT INTO scans (category, status) VALUES (${category}, 'running') RETURNING id
  `;
  return NextResponse.json({ scan_id: Number(row.id), category });
}
