import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { runSchedule, type ScheduleRow } from '@/lib/schedules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const [row] = await sql()<ScheduleRow[]>`SELECT * FROM schedules WHERE id = ${id}`;
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const log: string[] = [];
  try {
    const r = await runSchedule(row, (m) => log.push(m));
    return NextResponse.json({ schedule_id: id, ...r, log });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed', log }, { status: 500 });
  }
}
