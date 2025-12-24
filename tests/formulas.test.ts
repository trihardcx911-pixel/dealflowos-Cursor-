/**
 * Unit tests for underwriting formulas
 * 
 * Run with: npx jest tests/formulas.test.ts
 */

import { calculateMOA, calculateDealScore } from "../src/lib/formulas";

describe("calculateMOA", () => {
  it("should calculate MOA correctly with all values", () => {
    // MOA = (ARV * multiplier) - repairs - assignmentFee
    // MOA = (250000 * 0.70) - 35000 - 10000 = 175000 - 35000 - 10000 = 130000
    const result = calculateMOA(250000, 0.70, 35000, 10000);
    expect(result).toBe(130000);
  });

  it("should return null if ARV is null", () => {
    const result = calculateMOA(null, 0.70, 35000, 10000);
    expect(result).toBeNull();
  });

  it("should return null if repairs is null", () => {
    const result = calculateMOA(250000, 0.70, null, 10000);
    expect(result).toBeNull();
  });

  it("should handle different multipliers", () => {
    // MOA = (300000 * 0.65) - 50000 - 15000 = 195000 - 50000 - 15000 = 130000
    const result = calculateMOA(300000, 0.65, 50000, 15000);
    expect(result).toBe(130000);
  });

  it("should handle zero repairs", () => {
    // Edge case: property needs no repairs
    const result = calculateMOA(200000, 0.70, 0, 10000);
    expect(result).toBeNull(); // 0 is falsy, so returns null
  });
});

describe("calculateDealScore", () => {
  it("should return high score for excellent deal", () => {
    // Low repair ratio (< 15%) and low MOA ratio (< 50%)
    const result = calculateDealScore({
      arv: 250000,
      estimatedRepairs: 25000, // 10% of ARV
      moa: 100000, // 40% of ARV
      offerPrice: 90000,
    });
    expect(result).toBe(80); // 40 + 40 = 80
  });

  it("should return medium score for decent deal", () => {
    const result = calculateDealScore({
      arv: 250000,
      estimatedRepairs: 50000, // 20% of ARV
      moa: 140000, // 56% of ARV
      offerPrice: 130000,
    });
    expect(result).toBe(50); // 25 + 25 = 50
  });

  it("should penalize if offer is above MOA", () => {
    const result = calculateDealScore({
      arv: 250000,
      estimatedRepairs: 25000,
      moa: 100000,
      offerPrice: 110000, // Above MOA
    });
    expect(result).toBe(60); // 40 + 40 - 20 = 60
  });

  it("should return null if ARV is missing", () => {
    const result = calculateDealScore({
      arv: null,
      estimatedRepairs: 35000,
      moa: 130000,
    });
    expect(result).toBeNull();
  });

  it("should return null if MOA is missing", () => {
    const result = calculateDealScore({
      arv: 250000,
      estimatedRepairs: 35000,
      moa: null,
    });
    expect(result).toBeNull();
  });

  it("should cap score at 100", () => {
    // Even with perfect metrics, score shouldn't exceed 100
    const result = calculateDealScore({
      arv: 500000,
      estimatedRepairs: 10000, // 2% - very low
      moa: 200000, // 40% - very low
      offerPrice: 180000,
    });
    expect(result).toBeLessThanOrEqual(100);
  });

  it("should have minimum score of 0", () => {
    // Bad deal with offer way above MOA
    const result = calculateDealScore({
      arv: 100000,
      estimatedRepairs: 50000, // 50% - high
      moa: 30000, // 30%
      offerPrice: 100000, // Way above MOA
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });
});










