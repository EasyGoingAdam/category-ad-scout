import LeadsClient from './LeadsClient';

export const dynamic = 'force-dynamic';

export default function LeadsPage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Top leads</h1>
      <p className="text-muted text-sm">
        The highest-scoring brands across every scan you've run. Filter to whatever you're
        actively working — high lead score with verified email and live ads is the bread-and-butter.
      </p>
      <LeadsClient />
    </main>
  );
}
