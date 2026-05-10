export type SearchHit = {
  url: string;
  title: string;
  description?: string;
  source: 'brave' | 'serpapi';
};

export function hasSearchProvider(): boolean {
  return Boolean(process.env.BRAVE_SEARCH_API_KEY || process.env.SERPAPI_API_KEY);
}

export async function searchWeb(query: string, count = 10): Promise<SearchHit[]> {
  if (process.env.BRAVE_SEARCH_API_KEY) return braveSearch(query, count);
  if (process.env.SERPAPI_API_KEY) return serpapiSearch(query, count);
  throw new Error(
    'No search provider configured. Set BRAVE_SEARCH_API_KEY or SERPAPI_API_KEY in .env.local',
  );
}

async function braveSearch(query: string, count: number): Promise<SearchHit[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(20, count)));
  url.searchParams.set('country', 'us');
  url.searchParams.set('safesearch', 'moderate');

  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY!,
    },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Brave search failed: ${r.status} ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  const results = (data?.web?.results ?? []) as Array<{
    url?: string;
    title?: string;
    description?: string;
  }>;
  return results
    .filter((r) => r.url)
    .map((r) => ({
      url: r.url!,
      title: stripHtml(r.title ?? ''),
      description: stripHtml(r.description ?? ''),
      source: 'brave' as const,
    }));
}

async function serpapiSearch(query: string, count: number): Promise<SearchHit[]> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('num', String(Math.min(20, count)));
  url.searchParams.set('api_key', process.env.SERPAPI_API_KEY!);

  const r = await fetch(url);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`SerpAPI failed: ${r.status} ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  const results = (data?.organic_results ?? []) as Array<{
    link?: string;
    title?: string;
    snippet?: string;
  }>;
  return results
    .filter((r) => r.link)
    .map((r) => ({
      url: r.link!,
      title: r.title ?? '',
      description: r.snippet ?? '',
      source: 'serpapi' as const,
    }));
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}
