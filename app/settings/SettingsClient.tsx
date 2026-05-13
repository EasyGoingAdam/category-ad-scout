'use client';

import { useEffect, useState } from 'react';

type Integration = {
  configured: boolean;
  vars: string[];
  provider?: string | null;
};

type Settings = {
  integrations: Record<string, Integration>;
  db: { ok: boolean; error?: string; counts?: { scans: number; brands: number; schedules: number } };
};

const FEATURE_NOTES: Record<string, { title: string; gates: string }> = {
  database: { title: 'Database (Supabase Postgres)', gates: 'Required to boot' },
  openai: { title: 'OpenAI', gates: 'Category brainstorming · LLM re-rank · outreach drafting' },
  search: { title: 'Search provider', gates: 'Brand discovery (Phase 2)' },
  semrush: { title: 'SEMrush', gates: 'Traffic enrichment + traffic score' },
  hunter: { title: 'Hunter.io', gates: 'Email discovery + contact score' },
  meta: { title: 'Meta Ad Library cowork', gates: 'Live ads detection + Meta score' },
  telegram: { title: 'Telegram alerts', gates: 'High-quality lead alerts after scheduled scans' },
  cron: { title: 'Cron token', gates: 'Auth for /api/cron/run' },
};

export default function SettingsClient() {
  const [data, setData] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(e?.message ?? 'failed'));
  }, []);

  if (error) return <div className="card p-5 text-red-400">{error}</div>;
  if (!data) return <div className="card p-5 text-muted">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold mb-2">Database</h2>
        {data.db.ok ? (
          <p className="text-sm">
            <span className="pill border-emerald-700/50 text-emerald-300">connected</span>{' '}
            {data.db.counts?.scans} scans · {data.db.counts?.brands} brands ·{' '}
            {data.db.counts?.schedules} schedules
          </p>
        ) : (
          <p className="text-sm text-red-400">
            <span className="pill border-red-800 text-red-300">down</span> {data.db.error}
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>Integration</th>
              <th>Status</th>
              <th>Gates</th>
              <th>Env vars</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.integrations).map(([key, v]) => {
              const note = FEATURE_NOTES[key] ?? { title: key, gates: '' };
              return (
                <tr key={key}>
                  <td className="font-medium">{note.title}</td>
                  <td>
                    {v.configured ? (
                      <span className="pill border-emerald-700/50 text-emerald-300">on</span>
                    ) : (
                      <span className="pill border-amber-700/50 text-amber-300">off</span>
                    )}
                    {v.provider && <span className="text-muted text-xs ml-2">({v.provider})</span>}
                  </td>
                  <td className="text-muted text-sm">{note.gates}</td>
                  <td className="text-xs font-mono text-muted">{v.vars.join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DiagnosticPanel />

      <div className="card p-5 flex items-center gap-3 flex-wrap">
        <button
          className="btn-ghost text-sm"
          disabled={!data.integrations.telegram?.configured}
          onClick={async () => {
            const r = await fetch('/api/settings/test-telegram', { method: 'POST' });
            const d = await r.json();
            alert(d.ok ? '✅ Telegram message sent.' : `❌ ${d.error ?? 'Failed.'}`);
          }}
        >
          Send test Telegram message
        </button>
        <a
          className="btn-ghost text-sm"
          href="/api/healthz"
          target="_blank"
          rel="noreferrer"
        >
          Health check JSON
        </a>
      </div>

      <p className="text-xs text-muted">
        Missing providers don't crash scans — they just leave that field empty and the lead
        score works with whatever signals are present.
      </p>
    </div>
  );
}

type Probe = {
  name: string;
  configured: boolean;
  ok: boolean | null;
  latency_ms?: number;
  detail?: string;
  error?: string;
};

function DiagnosticPanel() {
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setProbes(null);
    try {
      const r = await fetch('/api/settings/diagnose', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setProbes(d.probes ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <div>
          <h2 className="font-semibold">Diagnose all integrations</h2>
          <p className="text-xs text-muted">
            Sends a real request to every configured provider and reports latency + result.
            Confirms your keys actually work before running a scan.
          </p>
        </div>
        <button className="btn-ghost text-sm" disabled={busy} onClick={run}>
          {busy ? 'Running…' : 'Run diagnose'}
        </button>
      </div>
      {error && <div className="text-red-400 text-xs">{error}</div>}
      {probes && (
        <table className="mt-3">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {probes.map((p) => (
              <tr key={p.name}>
                <td className="capitalize">{p.name}</td>
                <td>
                  {p.ok === true ? (
                    <span className="pill text-emerald-300 border-emerald-700/50">ok</span>
                  ) : p.ok === false ? (
                    <span className="pill text-red-300 border-red-700/50">fail</span>
                  ) : (
                    <span className="pill text-muted">skipped</span>
                  )}
                </td>
                <td className="text-muted">
                  {p.latency_ms != null ? `${p.latency_ms} ms` : '—'}
                </td>
                <td className="text-xs text-muted">
                  {p.error ? <span className="text-red-300">{p.error}</span> : p.detail ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
