/**
 * Auction mode validation logic.
 * Tests whether an auction configuration is valid and follows expected patterns.
 */

export interface AuctionConfig {
  /** Minimum bid amount in USDC */
  minBid?: number;
  /** Maximum bid amount in USDC */
  maxBid?: number;
  /** Auction duration in seconds */
  duration?: number;
  /** Reserve price in USDC */
  reservePrice?: number;
  /** Whether the auction uses sealed bids */
  sealed?: boolean;
  /** Bid increment in USDC */
  increment?: number;
}

export interface AuctionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: AuctionConfig;
}

export interface BidValidationResult {
  valid: boolean;
  reason: string;
}

/**
 * Validates an auction configuration for correctness.
 */
export function validateAuctionConfig(config: AuctionConfig): AuctionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate minBid
  if (config.minBid !== undefined) {
    if (typeof config.minBid !== 'number' || config.minBid < 0) {
      errors.push('minBid must be a non-negative number');
    }
    if (config.minBid === 0) {
      warnings.push('minBid is 0; consider setting a minimum to avoid spam bids');
    }
  }

  // Validate maxBid
  if (config.maxBid !== undefined) {
    if (typeof config.maxBid !== 'number' || config.maxBid <= 0) {
      errors.push('maxBid must be a positive number');
    }
  }

  // Validate minBid < maxBid
  if (config.minBid !== undefined && config.maxBid !== undefined) {
    if (config.minBid >= config.maxBid) {
      errors.push('minBid must be less than maxBid');
    }
  }

  // Validate duration
  if (config.duration !== undefined) {
    if (typeof config.duration !== 'number' || config.duration <= 0) {
      errors.push('duration must be a positive number (seconds)');
    }
    if (config.duration > 604800) {
      warnings.push('duration exceeds 7 days; consider a shorter auction window');
    }
    if (config.duration < 60) {
      warnings.push('duration is less than 60 seconds; auction may end before bids arrive');
    }
  }

  // Validate reservePrice
  if (config.reservePrice !== undefined) {
    if (typeof config.reservePrice !== 'number' || config.reservePrice < 0) {
      errors.push('reservePrice must be a non-negative number');
    }
    if (config.minBid !== undefined && config.reservePrice < config.minBid) {
      warnings.push('reservePrice is less than minBid; reserve will never be the limiting factor');
    }
  }

  // Validate increment
  if (config.increment !== undefined) {
    if (typeof config.increment !== 'number' || config.increment <= 0) {
      errors.push('increment must be a positive number');
    }
    if (config.minBid !== undefined && config.increment > config.minBid) {
      warnings.push('increment is larger than minBid');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

/**
 * Validates whether a bid is acceptable given auction config and current state.
 */
export function validateBid(
  bidAmount: number,
  config: AuctionConfig,
  currentHighBid?: number
): BidValidationResult {
  if (typeof bidAmount !== 'number' || isNaN(bidAmount)) {
    return { valid: false, reason: 'Bid amount must be a valid number' };
  }

  if (bidAmount <= 0) {
    return { valid: false, reason: 'Bid amount must be positive' };
  }

  if (config.minBid !== undefined && bidAmount < config.minBid) {
    return { valid: false, reason: `Bid ${bidAmount} is below minimum bid of ${config.minBid}` };
  }

  if (config.maxBid !== undefined && bidAmount > config.maxBid) {
    return { valid: false, reason: `Bid ${bidAmount} exceeds maximum bid of ${config.maxBid}` };
  }

  if (currentHighBid !== undefined) {
    if (bidAmount <= currentHighBid) {
      return { valid: false, reason: `Bid ${bidAmount} must exceed current high bid of ${currentHighBid}` };
    }
    if (config.increment !== undefined && bidAmount < currentHighBid + config.increment) {
      return {
        valid: false,
        reason: `Bid ${bidAmount} must be at least ${currentHighBid + config.increment} (current ${currentHighBid} + increment ${config.increment})`,
      };
    }
  }

  return { valid: true, reason: 'Bid is valid' };
}

/**
 * Determines if an auction meets its reserve price.
 */
export function meetsReserve(highBid: number, reservePrice?: number): boolean {
  if (reservePrice === undefined) return true;
  return highBid >= reservePrice;
}

/**
 * Simulates a complete auction test scenario.
 */
export function runAuctionTest(config: AuctionConfig): {
  configValidation: AuctionValidationResult;
  bidTests: Array<{ bid: number; result: BidValidationResult }>;
  summary: string;
} {
  const configValidation = validateAuctionConfig(config);

  const testBids = [
    0,
    (config.minBid ?? 1) - 0.001,
    config.minBid ?? 1,
    (config.minBid ?? 1) + (config.increment ?? 0.01),
    (config.maxBid ?? 100) / 2,
    config.maxBid ?? 100,
    (config.maxBid ?? 100) + 1,
  ];

  let currentHigh: number | undefined;
  const bidTests: Array<{ bid: number; result: BidValidationResult }> = [];

  for (const bid of testBids) {
    const result = validateBid(bid, config, currentHigh);
    bidTests.push({ bid, result });
    if (result.valid) {
      currentHigh = bid;
    }
  }

  const validBids = bidTests.filter((t) => t.valid).length;
  const invalidBids = bidTests.filter((t) => !t.valid).length;

  const summary = [
    `Config valid: ${configValidation.valid}`,
    `Config errors: ${configValidation.errors.length}`,
    `Config warnings: ${configValidation.warnings.length}`,
    `Bids tested: ${bidTests.length}`,
    `Valid bids: ${validBids}`,
    `Invalid bids: ${invalidBids}`,
    currentHigh !== undefined
      ? `Final high bid: ${currentHigh}, meets reserve: ${meetsReserve(currentHigh, config.reservePrice)}`
      : 'No valid bids placed',
  ].join('; ');

  return { configValidation, bidTests, summary };
}
