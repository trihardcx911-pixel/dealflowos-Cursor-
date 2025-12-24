// src/lib/formulas.ts

export function calculateMOA(
  arv: number | null,
  multiplier: number,
  repairs: number | null,
  assignmentFee: number
): number | null {
  if (!arv || !repairs) return null;
  return arv * multiplier - repairs - assignmentFee;
}

export function calculateDealScore(params: {
  arv?: number | null;
  estimatedRepairs?: number | null;
  moa?: number | null;
  offerPrice?: number | null;
}): number | null {
  const { arv, estimatedRepairs, moa, offerPrice } = params;

  if (!arv || !estimatedRepairs || !moa) return null;

  let score = 0;

  const repairRatio = estimatedRepairs / arv;
  const moaRatio = moa / arv;

  // Reward deals with low repair ratios
  if (repairRatio < 0.15) score += 40;
  else if (repairRatio < 0.30) score += 25;
  else score += 10;

  // Reward large spread between ARV and MOA
  if (moaRatio < 0.50) score += 40;
  else if (moaRatio < 0.60) score += 25;
  else score += 10;

  // Penalize if offer is above MOA
  if (offerPrice && offerPrice > moa) score -= 20;

  return Math.min(100, Math.max(0, score));
}










