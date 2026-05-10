import { describe, it, expect } from 'vitest';
import {
  registrableDomain,
  urlToDomain,
  isBlockedDomain,
  brandNameFromTitle,
  domainToBrand,
} from './normalize';

describe('registrableDomain', () => {
  it('strips www and lowercases', () => {
    expect(registrableDomain('www.NativePet.com')).toBe('nativepet.com');
  });
  it('strips port', () => {
    expect(registrableDomain('Example.com:443')).toBe('example.com');
  });
  it('returns null for empty', () => {
    expect(registrableDomain('')).toBeNull();
  });
});

describe('urlToDomain', () => {
  it('handles bare domain', () => {
    expect(urlToDomain('nativepet.com')).toBe('nativepet.com');
  });
  it('handles full URL', () => {
    expect(urlToDomain('https://www.nativepet.com/products/x?ref=1')).toBe('nativepet.com');
  });
  it('returns null for garbage', () => {
    expect(urlToDomain('not a url')).toBeNull();
  });
});

describe('isBlockedDomain', () => {
  it('blocks marketplaces', () => {
    expect(isBlockedDomain('amazon.com')).toBe(true);
    expect(isBlockedDomain('walmart.com')).toBe(true);
  });
  it('blocks social platforms', () => {
    expect(isBlockedDomain('facebook.com')).toBe(true);
    expect(isBlockedDomain('instagram.com')).toBe(true);
    expect(isBlockedDomain('reddit.com')).toBe(true);
  });
  it('blocks news/list aggregators', () => {
    expect(isBlockedDomain('forbes.com')).toBe(true);
    expect(isBlockedDomain('wirecutter.com')).toBe(true);
  });
  it('blocks subdomains of blocked apex', () => {
    expect(isBlockedDomain('shop.shopify.com')).toBe(true);
  });
  it('does NOT block real brand domains', () => {
    expect(isBlockedDomain('nativepet.com')).toBe(false);
    expect(isBlockedDomain('mushroomcoffeeco.com')).toBe(false);
  });
});

describe('brandNameFromTitle', () => {
  it('picks the shortest meaningful chunk', () => {
    expect(
      brandNameFromTitle(
        'Native Pet | Functional Pet Supplements for Dogs & Cats',
        'nativepet.com',
      ),
    ).toBe('Native Pet');
  });
  it('falls back to domain when title is empty', () => {
    expect(brandNameFromTitle('', 'mushroomcoffeeco.com')).toBe('Mushroomcoffeeco');
  });
  it('drops trailing "Official Store" garbage', () => {
    expect(brandNameFromTitle('OmaxNutrition - Official Store', 'omaxnutrition.com'))
      .toMatch(/^Omax/);
  });
});

describe('domainToBrand', () => {
  it('title-cases a domain root', () => {
    expect(domainToBrand('mushroomcoffeeco.com')).toBe('Mushroomcoffeeco');
  });
  it('handles hyphenated domains', () => {
    expect(domainToBrand('blue-bottle.com')).toBe('Blue Bottle');
  });
});
