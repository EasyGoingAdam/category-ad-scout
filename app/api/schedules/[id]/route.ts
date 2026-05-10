import { NextRequest, NextResponse } from 'next/server';
import { deleteSchedule, setEnabled } from '@/lib/schedules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  if (typeof body?.enabled === 'boolean') {
    await setEnabled(id, body.enabled);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  await deleteSchedule(id);
  return NextResponse.json({ ok: true });
}
