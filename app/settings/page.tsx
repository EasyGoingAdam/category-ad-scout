import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings &amp; integrations</h1>
      <p className="text-muted text-sm">
        Status of each provider and the database, gathered at request time. Restart Railway after
        changing env vars.
      </p>
      <SettingsClient />
    </main>
  );
}
