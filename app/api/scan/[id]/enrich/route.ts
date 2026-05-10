import { NextRequest, NextResponse } from 'next/server';
import { enrichScan } from '@/lib/enrich';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  const log: string[] = [];
  try {
    const result = await enrichScan(id, (m) => log.push(m));
    return NextResponse.json({ ...result, log });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'enrich failed', log },
      { status: 500 },
    );
  }
}
