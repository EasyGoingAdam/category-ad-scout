import { describe, it, expect, vi, afterEach } from 'vitest';
import { draftOutreach } from './outreach';
import type { BrandRecord } from './types';

const original = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = original;
});

const sampleBrand: BrandRecord = {
  id: 1,
  scan_id: 1,
  brand_name: 'Native Pet',
  domain: 'nativepet.com',
  product_category: 'dog supplements',
  meta_description: 'Functional supplements for dogs and cats.',
  shopify_detected: 1,
  amazon_url: 'https://amazon.com/dp/B0XXX',
  semrush_organic_traffic: 185_000,
  meta_active_ad_count: 42,
  meta_main_offer: '20% off subscription',
  meta_creative_types: JSON.stringify(['UGC video', 'static image']),
  status: 'New',
};

function mockAnthropic(response: { subject: string; body: string; notes?: string }) {
  vi.resetModules();
  vi.doMock('./anthropic', () => ({
    anthropic: () => ({
      messages: {
        create: vi.fn(async () => ({
          content: [{ type: 'text', text: JSON.stringify(response) }],
        })),
      },
    }),
    MODELS: { fast: 'haiku', smart: 'sonnet' },
  }));
}

describe('draftOutreach', () => {
  it('returns subject + body parsed from Claude JSON output', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    mockAnthropic({
      subject: 'Quick Amazon question',
      body: 'I noticed Native Pet runs 42 live ads with a 20% subscription offer — and pulls ~185k organic monthly. Curious whether you have an Amazon channel set up, or whether you treat it as out of scope. We run that exact channel end-to-end for DTC brands of your size and would value 15 min to compare notes. Open to it?',
      notes: 'leaned into the ad+traffic signals',
    });
    const { draftOutreach: draftFn } = await import('./outreach');
    const draft = await draftFn(sampleBrand, {
      sender_pitch: 'I run outbound for an Amazon agency.',
    });
    expect(draft.subject).toMatch(/Amazon/i);
    expect(draft.body.length).toBeGreaterThan(50);
    expect(draft.notes).toBeTruthy();
  });

  it('throws if subject or body is missing', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    mockAnthropic({ subject: '', body: 'no subject' });
    const { draftOutreach: draftFn } = await import('./outreach');
    await expect(
      draftFn(sampleBrand, { sender_pitch: 'pitch' }),
    ).rejects.toThrow(/subject or body/);
  });
});
