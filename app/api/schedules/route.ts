import { NextRequest, NextResponse } from 'next/server';
import { listSchedules, createSchedule } from '@/lib/schedules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const schedules = await listSchedules();
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category = String(body?.category ?? '').trim();
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });
  const cadence_days = Number(body?.cadence_days ?? 7);
  try {
    const row = await createSchedule(category, cadence_days);
    return NextResponse.json({ schedule: row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 400 });
  }
}
