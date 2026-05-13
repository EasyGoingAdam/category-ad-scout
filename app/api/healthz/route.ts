import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Healthcheck contract used by Railway:
//   - 200 + ok:true        → DB reachable, app fully live
//   - 200 + ok:true, degraded:'no-db' → no DATABASE_URL yet (first-time setup);
//                            Railway must keep the service running so the
//                            operator can navigate to /settings to fix it
//   - 503                  → DB is configured but unreachable (real outage)
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: true,
        degraded: 'no-db',
        message:
          'DATABASE_URL is not set. App is running in degraded mode — visit /settings.',
      },
      { status: 200 },
    );
  }
  try {
    const [{ ok }] = await sql()<{ ok: number }[]>`SELECT 1::int as ok`;
    return NextResponse.json({ ok: ok === 1, db: 'up' });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db: 'down', error: e?.message ?? 'unknown' },
      { status: 503 },
    );
  }
}
