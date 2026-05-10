const BLOCKLIST = new Set([
  // marketplaces / aggregators / news
  'amazon.com', 'amazon.ca', 'amazon.co.uk', 'amazon.de', 'amzn.to',
  'walmart.com', 'target.com', 'ebay.com', 'etsy.com', 'aliexpress.com',
  'temu.com', 'shein.com', 'wayfair.com', 'overstock.com', 'costco.com',
  'bestbuy.com', 'homedepot.com', 'lowes.com',
  // social / video / forums
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
  'youtube.com', 'youtu.be', 'pinterest.com', 'reddit.com', 'linkedin.com',
  'threads.net', 'medium.com', 'substack.com', 'quora.com',
  // search / maps / docs
  'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'maps.google.com',
  'docs.google.com', 'sites.google.com',
  // review / list / blog publishers
  'trustpilot.com', 'sitejabber.com', 'bbb.org', 'producthunt.com',
  'wirecutter.com', 'nytimes.com', 'wsj.com', 'forbes.com', 'businessinsider.com',
  'cnn.com', 'cnbc.com', 'bloomberg.com', 'reuters.com', 'cnet.com', 'theverge.com',
  'wired.com', 'gizmodo.com', 'mashable.com', 'techcrunch.com',
  'menshealth.com', 'womenshealthmag.com', 'self.com', 'cosmopolitan.com',
  'allrecipes.com', 'foodnetwork.com', 'epicurious.com', 'bonappetit.com',
  'glamour.com', 'vogue.com', 'gq.com', 'esquire.com', 'people.com',
  'today.com', 'goodhousekeeping.com', 'realsimple.com',
  // platform/marketing infrastructure
  'shopify.com', 'klaviyo.com', 'mailchimp.com', 'wordpress.com', 'wix.com',
  'squarespace.com', 'webflow.com', 'godaddy.com', 'cloudflare.com',
  // wikis / dictionaries / reference
  'wikipedia.org', 'wiktionary.org', 'fandom.com',
  // affiliate-heavy lists
  'rtings.com', 'tomsguide.com', 'pcmag.com', 'engadget.com',
  // generic search hubs
  'kit.com', 'linktr.ee', 'beacons.ai', 'lnk.bio',
  // image hosts / CDNs
  'imgur.com', 'flickr.com', 'unsplash.com', 'pexels.com',
]);

export function registrableDomain(rawHost: string): string | null {
  const host = (rawHost || '').toLowerCase().trim();
  if (!host) return null;
  // strip port
  const noPort = host.split(':')[0];
  // strip leading 'www.'
  return noPort.replace(/^www\./, '');
}

export function urlToDomain(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim().startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return registrableDomain(u.hostname);
  } catch {
    return null;
  }
}

export function isBlockedDomain(domain: string): boolean {
  if (!domain) return true;
  if (BLOCKLIST.has(domain)) return true;
  // also block exact-second-level matches against the blocklist's apex
  // e.g. shop.shopify.com → shopify.com → blocked
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const apex = parts.slice(i).join('.');
    if (BLOCKLIST.has(apex)) return true;
  }
  return false;
}

const BRAND_SUFFIXES = [
  'shop', 'store', 'official', 'co', 'inc', 'llc', 'company', 'brand',
];

export function brandNameFromTitle(title: string | null | undefined, domain: string): string {
  const fallback = domainToBrand(domain);
  if (!title) return fallback;
  let t = title.trim();
  // common separators: " | ", " - ", " — ", " · ", " : "
  const parts = t.split(/\s+[|\-—·:]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return fallback;
  // pick the SHORTEST part that contains alphabetic chars (often the brand name)
  const candidates = parts
    .filter((p) => /[a-z]/i.test(p))
    .sort((a, b) => a.length - b.length);
  let candidate = candidates[0] ?? parts[0];
  // if the domain word is in the candidate, prefer that part
  const domainWord = domain.replace(/\.[a-z.]+$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const withDomain = parts.find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, '').includes(domainWord));
  if (withDomain) candidate = withDomain;
  // strip trailing brand suffixes
  candidate = candidate.replace(/\s*[|\-]\s*(official|store|shop)\s*$/i, '').trim();
  if (candidate.length > 60) candidate = fallback;
  return candidate || fallback;
}

export function domainToBrand(domain: string): string {
  const base = domain.replace(/\.[a-z.]+$/, '');
  // split on common separators within the domain
  const cleaned = base.replace(/[-_]/g, ' ').replace(/[^a-z0-9 ]/gi, '');
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !BRAND_SUFFIXES.includes(w.toLowerCase()))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || base;
}
