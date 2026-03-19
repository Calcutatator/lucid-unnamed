import { describe, test, expect } from 'bun:test';
import {
  validateAuctionConfig,
  validateBid,
  meetsReserve,
  runAuctionTest,
} from './auction';

describe('validateAuctionConfig', () => {
  test('valid config with all fields', () => {
    const result = validateAuctionConfig({
      minBid: 1,
      maxBid: 100,
      duration: 3600,
      reservePrice: 10,
      sealed: false,
      increment: 0.5,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('valid config with no fields (empty)', () => {
    const result = validateAuctionConfig({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('invalid: negative minBid', () => {
    const result = validateAuctionConfig({ minBid: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('minBid must be a non-negative number');
  });

  test('invalid: maxBid is 0', () => {
    const result = validateAuctionConfig({ maxBid: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('maxBid must be a positive number');
  });

  test('invalid: minBid >= maxBid', () => {
    const result = validateAuctionConfig({ minBid: 10, maxBid: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('minBid must be less than maxBid');
  });

  test('invalid: negative duration', () => {
    const result = validateAuctionConfig({ duration: -100 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duration must be a positive number (seconds)');
  });

  test('warning: duration > 7 days', () => {
    const result = validateAuctionConfig({ duration: 700000 });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('duration exceeds 7 days; consider a shorter auction window');
  });

  test('warning: duration < 60 seconds', () => {
    const result = validateAuctionConfig({ duration: 30 });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('duration is less than 60 seconds; auction may end before bids arrive');
  });

  test('warning: minBid is 0', () => {
    const result = validateAuctionConfig({ minBid: 0 });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('minBid is 0; consider setting a minimum to avoid spam bids');
  });

  test('invalid: negative reservePrice', () => {
    const result = validateAuctionConfig({ reservePrice: -5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('reservePrice must be a non-negative number');
  });

  test('warning: reservePrice < minBid', () => {
    const result = validateAuctionConfig({ minBid: 10, reservePrice: 5 });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('reservePrice is less than minBid; reserve will never be the limiting factor');
  });

  test('invalid: increment is 0', () => {
    const result = validateAuctionConfig({ increment: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('increment must be a positive number');
  });

  test('warning: increment > minBid', () => {
    const result = validateAuctionConfig({ minBid: 1, increment: 5 });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('increment is larger than minBid');
  });

  test('multiple errors combined', () => {
    const result = validateAuctionConfig({
      minBid: -1,
      maxBid: -2,
      duration: 0,
      increment: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateBid', () => {
  const config = { minBid: 1, maxBid: 100, increment: 0.5 };

  test('valid bid with no high bid', () => {
    const result = validateBid(5, config);
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('Bid is valid');
  });

  test('invalid: bid is 0', () => {
    const result = validateBid(0, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('positive');
  });

  test('invalid: bid below minBid', () => {
    const result = validateBid(0.5, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('below minimum');
  });

  test('invalid: bid above maxBid', () => {
    const result = validateBid(101, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds maximum');
  });

  test('invalid: bid does not exceed current high bid', () => {
    const result = validateBid(5, config, 10);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('must exceed current high bid');
  });

  test('invalid: bid does not meet increment', () => {
    const result = validateBid(10.2, config, 10);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('increment');
  });

  test('valid bid meeting increment', () => {
    const result = validateBid(10.5, config, 10);
    expect(result.valid).toBe(true);
  });

  test('invalid: NaN bid', () => {
    const result = validateBid(NaN, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('valid number');
  });
});

describe('meetsReserve', () => {
  test('meets reserve when bid >= reservePrice', () => {
    expect(meetsReserve(10, 5)).toBe(true);
    expect(meetsReserve(5, 5)).toBe(true);
  });

  test('does not meet reserve when bid < reservePrice', () => {
    expect(meetsReserve(3, 5)).toBe(false);
  });

  test('always meets reserve when reservePrice is undefined', () => {
    expect(meetsReserve(0)).toBe(true);
    expect(meetsReserve(100)).toBe(true);
  });
});

describe('runAuctionTest', () => {
  test('runs full test with valid config', () => {
    const result = runAuctionTest({
      minBid: 1,
      maxBid: 100,
      duration: 3600,
      reservePrice: 5,
      increment: 0.5,
    });

    expect(result.configValidation.valid).toBe(true);
    expect(result.bidTests.length).toBeGreaterThan(0);
    expect(typeof result.summary).toBe('string');
    expect(result.summary).toContain('Config valid: true');
  });

  test('runs full test with invalid config', () => {
    const result = runAuctionTest({
      minBid: 100,
      maxBid: 10,
    });

    expect(result.configValidation.valid).toBe(false);
    expect(result.summary).toContain('Config valid: false');
  });

  test('summary includes bid statistics', () => {
    const result = runAuctionTest({ minBid: 1, maxBid: 50 });
    expect(result.summary).toContain('Bids tested:');
    expect(result.summary).toContain('Valid bids:');
    expect(result.summary).toContain('Invalid bids:');
  });

  test('runs with empty config', () => {
    const result = runAuctionTest({});
    expect(result.configValidation.valid).toBe(true);
    expect(result.bidTests.length).toBeGreaterThan(0);
  });
});
