import { describe, it, expect } from 'vitest';
import { amazonDtcScore, leadScore, deriveStatus } from './scoring';
import { trafficScore } from './semrush';
import { metaAdsScore } from './meta';
import { contactScore } from './hunter';

describe('trafficScore — tiered formula from spec', () => {
  it.each([
    [0, 0],
    [1, 10],
    [5_000, 10],
    [5_001, 25],
    [25_000, 25],
    [25_001, 50],
    [100_000, 50],
    [250_000, 75],
    [500_000, 100], // peak — not too large, not too small
    [500_001, 80],
    [1_000_000, 80],
    [2_500_000, 60],
    [5_000_000, 40], // enterprise — discounted
  ])('traffic=%i → score=%i', (traffic, expected) => {
    expect(trafficScore(traffic)).toBe(expected);
  });

  it('peaks at 500k and decreases above', () => {
    expect(trafficScore(500_000)).toBeGreaterThan(trafficScore(2_000_000));
    expect(trafficScore(500_000)).toBeGreaterThan(trafficScore(50));
  });

  it('handles null/undefined as zero', () => {
    expect(trafficScore(null)).toBe(0);
    expect(trafficScore(undefined)).toBe(0);
  });
});

describe('metaAdsScore — bonuses cap at 100', () => {
  it('zero ads = zero score', () => {
    expect(metaAdsScore({ active_ad_count: 0 })).toBe(0);
  });
  it('1-3 ads = 15 base', () => {
    expect(metaAdsScore({ active_ad_count: 2 })).toBe(15);
  });
  it('11-25 ads = 60 base', () => {
    expect(metaAdsScore({ active_ad_count: 20 })).toBe(60);
  });
  it('76+ ads = 100 base', () => {
    expect(metaAdsScore({ active_ad_count: 200 })).toBe(100);
  });
  it('all bonuses applied but cap is 100', () => {
    const v = metaAdsScore({
      active_ad_count: 200,
      creative_types: ['video', 'image'],
      productPaths: ['/p/a', '/p/b'],
      has_clear_offer: true,
    });
    expect(v).toBe(100);
  });
  it('mid-tier benefits from bonuses', () => {
    const base = metaAdsScore({ active_ad_count: 5 }); // 35
    const bonused = metaAdsScore({
      active_ad_count: 5,
      creative_types: ['video', 'image'],
      productPaths: ['/p/a', '/p/b'],
      has_clear_offer: true,
    });
    expect(bonused - base).toBe(30);
  });
});

describe('amazonDtcScore', () => {
  it('amazon only = 50', () => {
    expect(amazonDtcScore({ amazon_url: 'https://amazon.com/x' })).toBe(50);
  });
  it('shopify only = 50', () => {
    expect(amazonDtcScore({ shopify_detected: 1 })).toBe(50);
  });
  it('both = 100', () => {
    expect(amazonDtcScore({ amazon_url: 'https://amazon.com/x', shopify_detected: 1 })).toBe(100);
  });
  it('neither = 0', () => {
    expect(amazonDtcScore({})).toBe(0);
  });
});

describe('contactScore — Hunter prioritization', () => {
  it('null email = 0', () => {
    expect(contactScore(null)).toBe(0);
  });
  it('founder beats generic', () => {
    const founder = contactScore({
      value: 'jane@example.com',
      confidence: 90,
      first_name: 'Jane',
      last_name: 'Doe',
      position: 'Founder & CEO',
    });
    const generic = contactScore({ value: 'hello@example.com', confidence: 80 });
    expect(founder).toBeGreaterThan(generic);
  });
  it('caps at 100', () => {
    const v = contactScore({
      value: 'ceo@example.com',
      confidence: 100,
      first_name: 'Jane',
      last_name: 'Doe',
      position: 'Founder & CEO',
    });
    expect(v).toBeLessThanOrEqual(100);
  });
});

describe('leadScore — 30/25/25/10/10 weighted', () => {
  it('zero everywhere = 0', () => {
    expect(leadScore({})).toBe(0);
  });
  it('100s everywhere = 100', () => {
    expect(
      leadScore({
        category_fit: 100,
        traffic_score: 100,
        meta_ads_score: 100,
        contact_score: 100,
        amazon_dtc_score: 100,
      }),
    ).toBe(100);
  });
  it('weights add to 1.0', () => {
    // category_fit alone at 100 => 30
    expect(leadScore({ category_fit: 100 })).toBe(30);
    expect(leadScore({ traffic_score: 100 })).toBe(25);
    expect(leadScore({ meta_ads_score: 100 })).toBe(25);
    expect(leadScore({ contact_score: 100 })).toBe(10);
    expect(leadScore({ amazon_dtc_score: 100 })).toBe(10);
  });
});

describe('deriveStatus — important rules from spec', () => {
  it('low fit → Bad Fit even with great metrics', () => {
    expect(
      deriveStatus({
        category_fit: 10,
        meta_active_ad_count: 50,
        meta_confidence: 90,
        best_email: 'a@b.com',
        meta_source_known: true,
        lead_score: 95,
      }),
    ).toBe('Bad Fit');
  });
  it('low Meta confidence → Needs Review (never mark "running ads" loosely)', () => {
    expect(
      deriveStatus({
        category_fit: 80,
        meta_active_ad_count: 12,
        meta_confidence: 40,
        meta_source_known: true,
      }),
    ).toBe('Needs Review');
  });
  it('high confidence + ads → Has Live Ads', () => {
    expect(
      deriveStatus({
        category_fit: 80,
        meta_active_ad_count: 12,
        meta_confidence: 90,
        meta_source_known: true,
      }),
    ).toBe('Has Live Ads');
  });
  it('high confidence + zero ads → No Ads Found', () => {
    expect(
      deriveStatus({
        category_fit: 80,
        meta_active_ad_count: 0,
        meta_confidence: 90,
        meta_source_known: true,
      }),
    ).toBe('No Ads Found');
  });
  it('Meta unavailable + email + high lead → Qualified', () => {
    expect(
      deriveStatus({
        category_fit: 80,
        meta_source_known: false,
        best_email: 'a@b.com',
        lead_score: 80,
      }),
    ).toBe('Qualified');
  });
});
