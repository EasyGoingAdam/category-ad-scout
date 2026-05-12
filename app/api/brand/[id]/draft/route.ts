import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { draftOutreach, DEFAULT_SENDER_PITCH } from '@/lib/outreach';
import type { BrandRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY required for outreach drafting' },
      { status: 400 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const sender_pitch =
    typeof body?.sender_pitch === 'string' && body.sender_pitch.trim()
      ? body.sender_pitch.trim()
      : DEFAULT_SENDER_PITCH;
  const tone =
    body?.tone === 'warm' || body?.tone === 'punchy' ? body.tone : 'professional';

  const [b] = await sql()<BrandRecord[]>`SELECT * FROM brands WHERE id = ${id}`;
  if (!b) return NextResponse.json({ error: 'brand not found' }, { status: 404 });

  try {
    const draft = await draftOutreach(b, {
      sender_pitch,
      tone,
      recipient_name: null,
      recipient_position: null,
    });
    return NextResponse.json({ brand_id: id, ...draft });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'draft failed' }, { status: 500 });
  }
}
