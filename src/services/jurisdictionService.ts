/**
 * Jurisdiction Service
 * Handles jurisdiction profile loading and validation
 * Pure functions where possible, read-only DB access
 */

import prisma from "../lib/prisma";
import { LegalStage } from "@prisma/client";

export interface JurisdictionProfileData {
  requiredFields: Record<string, string[]>;
  timingRules?: Record<string, any>;
  featureFlags?: Record<string, boolean>;
}

export interface ValidationResult {
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

/**
 * Get jurisdiction profile from database
 * Returns null if no profile exists (allows transition with warnings)
 */
export async function getJurisdictionProfile(
  state: string,
  county?: string
): Promise<JurisdictionProfileData | null> {
  // Try county-specific profile first
  if (county) {
    const countyProfile = await prisma.jurisdictionProfile.findUnique({
      where: {
        state_county_profileVersion: {
          state: state.toUpperCase(),
          county: county,
          profileVersion: "1.0",
        },
      },
    });

    if (countyProfile) {
      return {
        requiredFields: countyProfile.requiredFields as Record<string, string[]>,
        timingRules: countyProfile.timingRules as Record<string, any> | undefined,
        featureFlags: countyProfile.featureFlags as Record<string, boolean> | undefined,
      };
    }
  }

  // Fall back to state-level profile
  const stateProfile = await prisma.jurisdictionProfile.findFirst({
    where: {
      state: state.toUpperCase(),
      county: null,
      profileVersion: "1.0",
    },
  });

  if (stateProfile) {
    return {
      requiredFields: stateProfile.requiredFields as Record<string, string[]>,
      timingRules: stateProfile.timingRules as Record<string, any> | undefined,
      featureFlags: stateProfile.featureFlags as Record<string, boolean> | undefined,
    };
  }

  // No profile found - return null (allows transition)
  return null;
}

/**
 * Get required fields for a specific legal stage
 * Pure function - extracts from profile
 */
export function getRequiredFields(
  stage: LegalStage,
  profile: JurisdictionProfileData | null
): string[] {
  if (!profile || !profile.requiredFields) {
    return [];
  }

  return profile.requiredFields[stage] || [];
}

/**
 * Validate that all required fields are present in metadata
 * Pure function - deterministic validation
 */
export function validateRequiredFields(
  stage: LegalStage,
  metadata: {
    contract?: any;
    assignment?: any;
    title?: any;
  },
  profile: JurisdictionProfileData | null
): ValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // If no profile exists, allow transition (no blockers)
  if (!profile) {
    warnings.push(
      `No jurisdiction profile found for this location. Proceeding with transition, but some required fields may be missing.`
    );
    return { valid: true, blockers, warnings };
  }

  const requiredFields = getRequiredFields(stage, profile);

  if (requiredFields.length === 0) {
    // No requirements for this stage
    return { valid: true, blockers, warnings };
  }

  // Check each required field against metadata
  for (const field of requiredFields) {
    const [category, fieldName] = field.split(".");

    let value: any = null;

    // Extract value from appropriate metadata category
    if (category === "contract" && metadata.contract) {
      value = metadata.contract[fieldName];
    } else if (category === "assignment" && metadata.assignment) {
      value = metadata.assignment[fieldName];
    } else if (category === "title" && metadata.title) {
      value = metadata.title[fieldName];
    }

    // Check if field is missing or empty
    if (value === null || value === undefined || value === "") {
      blockers.push(`Required field missing: ${field}`);
    }
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
}

/**
 * Get warnings for a stage based on metadata and profile
 * Pure function - returns non-blocking issues
 */
export function getWarnings(
  stage: LegalStage,
  metadata: {
    contract?: any;
    assignment?: any;
    title?: any;
  },
  profile: JurisdictionProfileData | null
): string[] {
  const warnings: string[] = [];

  // If no profile, warn about missing jurisdiction rules
  if (!profile) {
    warnings.push(
      `No jurisdiction profile configured. Some validation rules may not apply.`
    );
    return warnings;
  }

  // Check timing rules if available
  if (profile.timingRules && profile.timingRules[stage]) {
    const timingRule = profile.timingRules[stage];
    
    // Example: Check if expected dates are reasonable
    if (timingRule.expectedDays) {
      // This would check against actual dates in metadata
      // For now, just note that timing rules exist
      warnings.push(
        `Timing rules apply for ${stage}. Ensure deadlines are met.`
      );
    }
  }

  // Check for recommended (but not required) fields
  const requiredFields = getRequiredFields(stage, profile);
  const allFields = [
    ...Object.keys(metadata.contract || {}),
    ...Object.keys(metadata.assignment || {}),
    ...Object.keys(metadata.title || {}),
  ];

  // Warn if external URLs are missing (recommended but not required)
  if (stage === "UNDER_CONTRACT" && !metadata.contract?.externalUrl) {
    warnings.push("Consider adding an external URL for the contract document.");
  }

  if (stage === "ASSIGNED" && !metadata.assignment?.externalUrl) {
    warnings.push("Consider adding an external URL for the assignment document.");
  }

  if (stage === "TITLE_CLEARING" && !metadata.title?.externalUrl) {
    warnings.push("Consider adding an external URL for title documents.");
  }

  return warnings;
}

/**
 * Check if a feature flag is enabled for a jurisdiction
 * Pure function
 */
export function checkFeatureFlag(
  flag: string,
  profile: JurisdictionProfileData | null
): boolean {
  if (!profile || !profile.featureFlags) {
    return true; // Default to enabled if no profile
  }

  return profile.featureFlags[flag] ?? true;
}

/**
 * Get timing rules for a stage
 * Pure function
 */
export function getTimingRules(
  stage: LegalStage,
  profile: JurisdictionProfileData | null
): Record<string, any> | null {
  if (!profile || !profile.timingRules) {
    return null;
  }

  return profile.timingRules[stage] || null;
}



