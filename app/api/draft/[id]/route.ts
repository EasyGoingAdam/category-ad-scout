import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mark a draft as sent. Optionally bumps the brand's user_status to "Contacted"
// (if it has no operator override yet) so the pipeline reflects the action.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const db = sql();
  const [row] = await db<Array<{ brand_id: number; sent_at: string | null }>>`
    SELECT brand_id, sent_at FROM drafts WHERE id = ${id}
  `;
  if (!row) return NextResponse.json({ error: 'draft not found' }, { status: 404 });

  await db`UPDATE drafts SET sent_at = NOW() WHERE id = ${id}`;

  // Bump brand to Contacted if no override yet, or if currently New/Qualified/Contact Found.
  await db`
    UPDATE brands
    SET user_status = 'Contacted', user_updated_at = NOW()
    WHERE id = ${row.brand_id}
      AND (user_status IS NULL OR user_status IN ('New', 'Qualified', 'Contact Found'))
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  await sql()`DELETE FROM drafts WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
