import { sql } from './db';
import { discoverBrands } from './discovery';
import { enrichScan } from './enrich';
import { sendTelegram, formatScanAlert, hasTelegram } from './telegram';
import type { BrandRecord } from './types';

export type ScheduleRow = {
  id: number;
  category: string;
  cadence_days: number;
  last_run_at: string | null;
  next_run_at: string | null;
  enabled: number;
  created_at: string;
};

export async function listSchedules(): Promise<ScheduleRow[]> {
  return sql()<ScheduleRow[]>`SELECT * FROM schedules ORDER BY id DESC`;
}

export async function createSchedule(category: string, cadence_days = 7): Promise<ScheduleRow> {
  const cat = category.trim();
  if (!cat) throw new Error('category required');
  const cadence = Math.max(1, Math.min(90, cadence_days | 0));
  const [row] = await sql()<ScheduleRow[]>`
    INSERT INTO schedules (category, cadence_days, next_run_at)
    VALUES (${cat}, ${cadence}, NOW())
    RETURNING *
  `;
  return row;
}

export async function deleteSchedule(id: number): Promise<void> {
  await sql()`DELETE FROM schedules WHERE id = ${id}`;
}

export async function setEnabled(id: number, enabled: boolean): Promise<void> {
  await sql()`UPDATE schedules SET enabled = ${enabled ? 1 : 0} WHERE id = ${id}`;
}

export async function dueSchedules(): Promise<ScheduleRow[]> {
  return sql()<ScheduleRow[]>`
    SELECT * FROM schedules
    WHERE enabled = 1
      AND (next_run_at IS NULL OR next_run_at <= NOW())
    ORDER BY id ASC
  `;
}

export async function runSchedule(
  s: ScheduleRow,
  log: (m: string) => void,
): Promise<{ scan_id: number; alerted: boolean }> {
  log(`Running schedule #${s.id} (${s.category}, every ${s.cadence_days}d)`);
  const db = sql();
  const [scanRow] = await db<{ id: number }[]>`
    INSERT INTO scans (category, status) VALUES (${s.category}, 'running') RETURNING id
  `;
  const scan_id = Number(scanRow.id);

  const candidates = await discoverBrands({ category: s.category, onProgress: log });

  for (const c of candidates) {
    await db`
      INSERT INTO brands (
        scan_id, brand_name, domain, homepage_title, meta_description,
        product_category, amazon_url, shopify_detected, socials_json,
        raw_sources_json, status, category_fit, last_checked
      ) VALUES (
        ${scan_id}, ${c.brand_name}, ${c.domain}, ${c.homepage_title}, ${c.meta_description},
        ${c.product_category}, ${c.amazon_url}, ${c.shopify_detected}, ${c.socials_json},
        ${c.raw_sources_json}, 'New', ${c.category_fit}, NOW()
      )
      ON CONFLICT (scan_id, domain) DO NOTHING
    `;
  }
  await db`UPDATE scans SET status = 'discovered' WHERE id = ${scan_id}`;

  await enrichScan(scan_id, log);

  await db`
    UPDATE schedules
    SET last_run_at = NOW(),
        next_run_at = NOW() + (cadence_days || ' days')::interval
    WHERE id = ${s.id}
  `;

  let alerted = false;
  if (hasTelegram()) {
    const top = await db<
      Array<
        Pick<
          BrandRecord,
          'brand_name' | 'domain' | 'lead_score' | 'meta_active_ad_count' | 'semrush_organic_traffic' | 'best_email'
        >
      >
    >`
      SELECT brand_name, domain, lead_score, meta_active_ad_count,
             semrush_organic_traffic, best_email
      FROM brands
      WHERE scan_id = ${scan_id} AND lead_score >= 75
      ORDER BY lead_score DESC LIMIT 8
    `;
    if (top.length > 0) {
      const msg = formatScanAlert({
        category: s.category,
        scan_id,
        topBrands: top.map((t) => ({
          brand_name: t.brand_name,
          domain: t.domain,
          lead_score: t.lead_score ?? null,
          meta_active_ad_count: t.meta_active_ad_count ?? null,
          semrush_organic_traffic:
            t.semrush_organic_traffic != null ? Number(t.semrush_organic_traffic) : null,
          best_email: t.best_email ?? null,
        })),
      });
      const r = await sendTelegram(msg);
      alerted = !!r.ok;
      log(`Telegram alert: ${alerted ? 'sent' : 'failed/skipped'}`);
    }
  }

  return { scan_id, alerted };
}
