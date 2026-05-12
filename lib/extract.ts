import * as cheerio from 'cheerio';

export type PageMeta = {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  ogSiteName: string | null;
  shopify: boolean;
  klaviyo: boolean;
  amazonLinks: string[];
  socials: { platform: string; url: string }[];
  productPaths: string[];
  rawSnippet: string; // first ~2KB for audit
};

const UA =
  'Mozilla/5.0 (compatible; CategoryAdScout/0.1; +https://example.com/bot)';

const FETCH_TIMEOUT_MS = 12000;

export async function fetchPageMeta(rawUrl: string): Promise<PageMeta | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  // Only http(s)
  if (!/^https?:$/.test(url.protocol)) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.toLowerCase().includes('html')) return null;
    const text = await res.text();
    const $ = cheerio.load(text);
    const title = ($('title').first().text() || '').trim() || null;
    const meta = (name: string) =>
      $(`meta[name="${name}"]`).attr('content')?.trim() ||
      $(`meta[property="${name}"]`).attr('content')?.trim() ||
      null;
    const description = meta('description') || meta('og:description');
    const ogSiteName = meta('og:site_name');
    const html = text.toLowerCase();
    const shopify =
      /cdn\.shopify\.com|myshopify\.com|shopify\.com\/s\/files|shopify\.theme|x-shopify/i.test(
        text,
      );
    const klaviyo = /static\.klaviyo\.com|klaviyo\.js|_klOnsite/i.test(text);

    const links = new Set<string>();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) links.add(href);
    });

    const amazonLinks = Array.from(links)
      .filter((h) => /amazon\.com|amzn\.to/i.test(h))
      .slice(0, 5);

    const socials: PageMeta['socials'] = [];
    const seenSocial = new Set<string>();
    for (const l of links) {
      const m = l.match(
        /(facebook\.com|instagram\.com|tiktok\.com|youtube\.com|pinterest\.com|x\.com|twitter\.com|linkedin\.com)\/[^\s"']+/i,
      );
      if (m) {
        const platform = m[1].replace(/\.com$/, '');
        const norm = `https://${m[0].replace(/^https?:\/\//, '')}`.replace(/[?#].*$/, '');
        const key = `${platform}:${norm}`;
        if (!seenSocial.has(key)) {
          seenSocial.add(key);
          socials.push({ platform, url: norm });
        }
      }
    }

    const productPaths = Array.from(links)
      .filter((h) => /\/products?\/|\/collections\/|\/shop\//i.test(h))
      .slice(0, 5);

    return {
      url: rawUrl,
      finalUrl: res.url || rawUrl,
      title,
      description,
      ogSiteName,
      shopify,
      klaviyo,
      amazonLinks,
      socials,
      productPaths,
      rawSnippet: text.slice(0, 2048),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPageMetaPool(
  urls: string[],
  concurrency = 5,
  onResult?: (idx: number, meta: PageMeta | null) => void | Promise<void>,
): Promise<Array<PageMeta | null>> {
  const out: Array<PageMeta | null> = new Array(urls.length).fill(null);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= urls.length) return;
        const meta = await fetchPageMeta(urls[idx]);
        out[idx] = meta;
        if (onResult) await onResult(idx, meta);
      }
    }),
  );
  return out;
}
