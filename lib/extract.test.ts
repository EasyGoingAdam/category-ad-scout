import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPageMeta } from './extract';

const realFetch = globalThis.fetch;

function mockFetch(html: string, opts: { status?: number; ctype?: string; finalUrl?: string } = {}) {
  globalThis.fetch = vi.fn(async () => {
    return new Response(html, {
      status: opts.status ?? 200,
      headers: { 'content-type': opts.ctype ?? 'text/html' },
    });
  }) as any;
  if (opts.finalUrl) {
    // jsdom's Response doesn't expose .url easily; patch a wrapper.
    globalThis.fetch = vi.fn(async () => {
      const r = new Response(html, {
        status: opts.status ?? 200,
        headers: { 'content-type': opts.ctype ?? 'text/html' },
      });
      Object.defineProperty(r, 'url', { value: opts.finalUrl, configurable: true });
      return r;
    }) as any;
  }
}

beforeEach(() => {
  globalThis.fetch = realFetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('fetchPageMeta', () => {
  it('returns null for non-http schemes', async () => {
    expect(await fetchPageMeta('ftp://example.com')).toBeNull();
  });

  it('returns null when URL is invalid', async () => {
    expect(await fetchPageMeta('not a url')).toBeNull();
  });

  it('returns null when content-type is not HTML', async () => {
    mockFetch('{"x":1}', { ctype: 'application/json' });
    expect(await fetchPageMeta('https://example.com')).toBeNull();
  });

  it('extracts title and meta description', async () => {
    mockFetch(`
      <html>
        <head>
          <title>Native Pet | Supplements for Dogs</title>
          <meta name="description" content="Functional supplements for dogs and cats." />
          <meta property="og:site_name" content="Native Pet" />
        </head>
        <body></body>
      </html>
    `);
    const m = await fetchPageMeta('https://nativepet.com');
    expect(m?.title).toContain('Native Pet');
    expect(m?.description).toContain('Functional supplements');
    expect(m?.ogSiteName).toBe('Native Pet');
  });

  it('detects shopify and klaviyo', async () => {
    mockFetch(`
      <html><head><title>Shop</title></head><body>
        <script src="https://cdn.shopify.com/x.js"></script>
        <script src="https://static.klaviyo.com/y.js"></script>
      </body></html>
    `);
    const m = await fetchPageMeta('https://example.com');
    expect(m?.shopify).toBe(true);
    expect(m?.klaviyo).toBe(true);
  });

  it('collects amazon links and product paths and socials', async () => {
    mockFetch(`
      <html><head><title>Brand</title></head><body>
        <a href="https://www.amazon.com/dp/B0XXXXXXX">Buy on Amazon</a>
        <a href="/products/widget-1">Widget</a>
        <a href="/collections/all">Collections</a>
        <a href="https://www.instagram.com/brand">IG</a>
        <a href="https://www.facebook.com/brand">FB</a>
      </body></html>
    `);
    const m = await fetchPageMeta('https://brand.com');
    expect(m?.amazonLinks.length).toBeGreaterThan(0);
    expect(m?.productPaths.length).toBeGreaterThan(0);
    expect(m?.socials.map((s) => s.platform).sort()).toEqual(['facebook', 'instagram']);
  });

  it('returns null on non-2xx', async () => {
    mockFetch('forbidden', { status: 403 });
    expect(await fetchPageMeta('https://example.com')).toBeNull();
  });
});
