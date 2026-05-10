import { sql } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ScansPage() {
  const rows = await sql()<
    Array<{ id: number; category: string; created_at: string; status: string }>
  >`SELECT id, category, created_at, status FROM scans ORDER BY id DESC LIMIT 100`;
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Scans</h1>
      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted text-sm">
                  No scans yet. Start one from the home page.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td className="capitalize">{r.category}</td>
                <td><span className="pill">{r.status}</span></td>
                <td className="text-muted">{String(r.created_at)}</td>
                <td>
                  <Link className="btn-ghost" href={`/scans/${r.id}`}>Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
