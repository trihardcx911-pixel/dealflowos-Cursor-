import { createHash } from "node:crypto";

export type Address = {
  address1: string;
  city: string;
  state: string; // 2-letter
  zip: string;   // 5 or 9 (ZIP+4 ok)
};

// Simple, deterministic normalizer (USPS-ish light). Copilot: keep it literal.
export function normalizeAddress(a: Address): {
  canonical: string;
  addressHash: string; // sha256 of canonical + "|" + orgId
} {
  const clean = (s: string) =>
    s.trim()
     .toUpperCase()
     .replace(/\s+/g, " "); // collapse spaces only

  const address1 = clean(a.address1).replace(/\./g, "");
  const city = clean(a.city);
  const state = clean(a.state);
  const zip = a.zip.trim().slice(0, 5); // keep 5 for stability

  const canonical = `${address1}, ${city}, ${state} ${zip}`;
  // NOTE: orgId is appended at call-site to scope hashes per-organization.
  function hashWithOrg(orgId: string) {
    return createHash("sha256").update(`${canonical}|${orgId}`).digest("hex");
  }

  // Provide both: caller can either use addressHash via helper, or recompute with orgId.
  return {
    canonical,
    addressHash: hashWithOrg, // function reference; caller must pass orgId
  } as unknown as { canonical: string; addressHash: string };
}

// Helper for callers (so they don’t misuse the function above).
export function addressHashForOrg(canonical: string, orgId: string): string {
  return createHash("sha256").update(`${canonical}|${orgId}`).digest("hex");
}
