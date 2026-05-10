export function hasTelegram(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegram(text: string, opts?: { parse_mode?: 'HTML' | 'Markdown' }) {
  if (!hasTelegram()) return { ok: false, skipped: true };
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: text.length > 3500 ? text.slice(0, 3490) + '…' : text,
      parse_mode: opts?.parse_mode ?? 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data?.ok, response: data };
}

export function formatScanAlert(opts: {
  category: string;
  scan_id: number;
  topBrands: Array<{
    brand_name: string;
    domain: string;
    lead_score: number | null;
    meta_active_ad_count: number | null;
    semrush_organic_traffic: number | null;
    best_email: string | null;
  }>;
}): string {
  const head = `🛒 <b>Category Ad Scout</b>\nCategory: <b>${escape(opts.category)}</b> (scan #${opts.scan_id})`;
  const rows = opts.topBrands.slice(0, 8).map((b) => {
    const trafficStr = b.semrush_organic_traffic != null ? `${formatNum(b.semrush_organic_traffic)}/mo` : '—';
    const adsStr = b.meta_active_ad_count != null ? `${b.meta_active_ad_count} ads` : '—';
    const emailStr = b.best_email ? ` · ${escape(b.best_email)}` : '';
    return `• <b>${escape(b.brand_name)}</b> [${b.lead_score ?? '–'}] — ${escape(b.domain)} — ${trafficStr} · ${adsStr}${emailStr}`;
  });
  return `${head}\n\n${rows.join('\n')}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

function escape(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}
