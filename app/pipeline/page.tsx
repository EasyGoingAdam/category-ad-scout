import PipelineClient from './PipelineClient';

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Pipeline</h1>
      <p className="text-muted text-sm">
        Brands across every scan that you've moved into a user status. Drag-free —
        change column by clicking the status pill on a card.
      </p>
      <PipelineClient />
    </main>
  );
}
