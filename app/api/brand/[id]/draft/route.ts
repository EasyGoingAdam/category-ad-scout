import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { draftOutreach, DEFAULT_SENDER_PITCH } from '@/lib/outreach';
import type { BrandRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const drafts = await sql()<
    Array<{
      id: number;
      brand_id: number;
      subject: string;
      body: string;
      notes: string | null;
      tone: string | null;
      sender_pitch: string | null;
      created_at: string;
      sent_at: string | null;
    }>
  >`
    SELECT id, brand_id, subject, body, notes, tone, sender_pitch, created_at, sent_at
    FROM drafts WHERE brand_id = ${id}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({
    drafts: drafts.map((d) => ({
      ...d,
      created_at: String(d.created_at),
      sent_at: d.sent_at ? String(d.sent_at) : null,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY required for outreach drafting' },
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
    const [row] = await sql()<
      Array<{
        id: number;
        created_at: string;
      }>
    >`
      INSERT INTO drafts (brand_id, subject, body, notes, tone, sender_pitch)
      VALUES (${id}, ${draft.subject}, ${draft.body}, ${draft.notes ?? null}, ${tone}, ${sender_pitch})
      RETURNING id, created_at
    `;
    return NextResponse.json({
      brand_id: id,
      draft_id: row.id,
      created_at: String(row.created_at),
      ...draft,
      tone,
      sender_pitch,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'draft failed' }, { status: 500 });
  }
}
