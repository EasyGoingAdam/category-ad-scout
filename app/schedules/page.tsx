import { listSchedules } from '@/lib/schedules';
import SchedulesClient from './SchedulesClient';

export const dynamic = 'force-dynamic';

export default async function SchedulesPage() {
  const raw = await listSchedules();
  const schedules = raw.map((s) => ({
    ...s,
    last_run_at: s.last_run_at ? String(s.last_run_at) : null,
    next_run_at: s.next_run_at ? String(s.next_run_at) : null,
    created_at: String(s.created_at),
  }));
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Scheduled rescans</h1>
      <p className="text-muted text-sm">
        Each schedule runs the full pipeline (discover → enrich → score) and sends a Telegram alert
        when high-quality leads (score ≥ 75) are found. Trigger via{' '}
        <code className="text-accent">POST /api/cron/run</code> from any scheduler.
      </p>
      <SchedulesClient initial={schedules} />
    </main>
  );
}
