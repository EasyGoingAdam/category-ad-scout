import { describe, it, expect } from 'vitest';
import { pickBestEmail, type HunterEmail } from './hunter';

const E = (overrides: Partial<HunterEmail> = {}): HunterEmail => ({
  value: 'someone@example.com',
  confidence: 80,
  type: 'personal',
  ...overrides,
});

describe('pickBestEmail — priority order from spec', () => {
  it('founder beats every other position', () => {
    const emails = [
      E({ value: 'hello@example.com', confidence: 90 }),
      E({ value: 'marketing@example.com', position: 'Marketing Manager', confidence: 85 }),
      E({ value: 'ben@example.com', position: 'Head of Growth', confidence: 80 }),
      E({ value: 'jane@example.com', position: 'Founder & CEO', confidence: 70 }),
    ];
    expect(pickBestEmail(emails)?.value).toBe('jane@example.com');
  });

  it('Head of Growth beats Marketing at equal confidence', () => {
    const emails = [
      E({ value: 'marketing@example.com', position: 'CMO', confidence: 80 }),
      E({ value: 'ben@example.com', position: 'Head of Growth', confidence: 80 }),
    ];
    expect(pickBestEmail(emails)?.value).toBe('ben@example.com');
  });

  it('Marketing beats Ecommerce', () => {
    const emails = [
      E({ value: 'ecom@example.com', position: 'Director of Ecommerce', confidence: 85 }),
      E({ value: 'cmo@example.com', position: 'CMO', confidence: 80 }),
    ];
    expect(pickBestEmail(emails)?.value).toBe('cmo@example.com');
  });

  it('Ecommerce beats Partnerships', () => {
    const emails = [
      E({ value: 'bd@example.com', position: 'Business Development', confidence: 85 }),
      E({ value: 'ecom@example.com', position: 'Director of Ecommerce', confidence: 75 }),
    ];
    expect(pickBestEmail(emails)?.value).toBe('ecom@example.com');
  });

  it('a generic hello@ wins over a named random email with no title boost', () => {
    const emails = [
      E({ value: 'hello@example.com', confidence: 90, position: null }),
      E({ value: 'qa.intern@example.com', confidence: 50, position: null }),
    ];
    expect(pickBestEmail(emails)?.value).toBe('hello@example.com');
  });

  it('returns null on empty input', () => {
    expect(pickBestEmail([])).toBeNull();
  });

  it('picks the highest confidence when no titles available', () => {
    const emails = [
      E({ value: 'a@example.com', confidence: 30 }),
      E({ value: 'b@example.com', confidence: 80 }),
      E({ value: 'c@example.com', confidence: 50 }),
    ];
    expect(pickBestEmail(emails)?.value).toBe('b@example.com');
  });

  it('handles case-insensitive position matching', () => {
    const emails = [
      E({ value: 'jane@example.com', position: 'co-founder', confidence: 60 }),
      E({ value: 'marketing@example.com', position: 'MARKETING DIRECTOR', confidence: 90 }),
    ];
    // founder wins despite lower confidence — title is the dominant signal
    expect(pickBestEmail(emails)?.value).toBe('jane@example.com');
  });
});
