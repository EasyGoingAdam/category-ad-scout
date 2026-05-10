import { NextRequest, NextResponse } from 'next/server';
import { brainstormCategories } from '@/lib/brainstorm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const seed = typeof body?.seed === 'string' ? body.seed : undefined;
    const count = typeof body?.count === 'number' ? Math.max(4, Math.min(20, body.count)) : 12;
    const categories = await brainstormCategories({ seed, count });
    return NextResponse.json({ categories });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Brainstorm failed' },
      { status: 500 },
    );
  }
}
