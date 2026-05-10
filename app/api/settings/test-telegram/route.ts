import { NextResponse } from 'next/server';
import { hasTelegram, sendTelegram } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!hasTelegram()) {
    return NextResponse.json(
      { ok: false, error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set' },
      { status: 400 },
    );
  }
  const r = await sendTelegram(
    `✅ <b>Category Ad Scout</b> test alert from <code>${new Date().toISOString()}</code>`,
  );
  return NextResponse.json(r);
}
