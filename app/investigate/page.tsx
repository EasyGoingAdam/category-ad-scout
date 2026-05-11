import InvestigateClient from './InvestigateClient';

export const dynamic = 'force-dynamic';

export default function InvestigatePage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Investigate a domain</h1>
      <p className="text-muted text-sm">
        Paste any ecommerce site to pull its homepage signals, SEMrush traffic, live Meta ads,
        and Hunter contacts in one shot. Useful when you hear about a brand and want to size it
        up before adding it to a scan.
      </p>
      <InvestigateClient />
    </main>
  );
}
