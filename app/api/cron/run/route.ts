import { NextRequest, NextResponse } from 'next/server';
import { dueSchedules, runSchedule } from '@/lib/schedules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_TOKEN;
  if (!expected) return true;
  const hdr = req.headers.get('authorization') ?? '';
  const tok = hdr.startsWith('Bearer ') ? hdr.slice(7) : req.nextUrl.searchParams.get('token');
  return tok === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const due = await dueSchedules();
  const log: string[] = [];
  const results: Array<{ schedule_id: number; scan_id?: number; alerted?: boolean; error?: string }> = [];
  for (const s of due) {
    try {
      const r = await runSchedule(s, (m) => log.push(`[#${s.id}] ${m}`));
      results.push({ schedule_id: s.id, ...r });
    } catch (e: any) {
      results.push({ schedule_id: s.id, error: e?.message ?? String(e) });
      log.push(`[#${s.id}] FAILED: ${e?.message ?? e}`);
    }
  }
  return NextResponse.json({ ran: results.length, results, log });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
