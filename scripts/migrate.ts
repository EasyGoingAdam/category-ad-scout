import { migrate, sql } from '../lib/db';

async function main() {
  console.log('Running migration against', maskUrl(process.env.DATABASE_URL));
  await migrate();
  const tables =
    await sql()`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log('Tables present:', tables.map((t) => t.tablename).join(', '));
  await sql().end();
}

function maskUrl(u?: string) {
  if (!u) return '(unset)';
  return u.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
