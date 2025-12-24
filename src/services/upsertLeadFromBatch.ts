import { prisma } from "../db/prisma";
import { normalizeAddress } from "../lib/normalizeAddress";
import { classifyLeadType } from "../lib/classifyLeadType";
import { createHash } from "crypto";

type RawLead = {
  address: string;
  city: string;
  state: string;
  zip: string | number;
  building_sqft?: number | null;
  improvement_value?: number | null;
  zoning?: string | null;
  units?: number | null;
  // your advanced RawLead may have more fields — that’s fine
};

// Safely build a canonical address string no matter what normalizeAddress returns
function getCanonicalFromNormalize(norm: any, fallback: RawLead) {
  if (typeof norm?.canonical === "string" && norm.canonical.trim()) return norm.canonical;
  const line1 = (norm?.line1 ?? fallback.address ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");
  const city  = (norm?.city  ?? fallback.city   ?? "").toString().trim().toUpperCase();
  const state = (norm?.state ?? fallback.state  ?? "").toString().trim().toUpperCase();
  const zip   = (norm?.zip   ?? fallback.zip    ?? "").toString().trim();
  return `${line1}, ${city}, ${state} ${zip}`;
}

// Make an org-scoped address hash (dedupe per org)
function makeOrgScopedHash(orgId: string, norm: any, canonical: string) {
  // If your advanced normalizer already returns a stable hash, use it as the base.
  const base = typeof norm?.addressHash === "string" ? norm.addressHash
            : typeof norm?.hash === "string"        ? norm.hash
            : canonical;
  return createHash("sha256").update(`${orgId}|${base}`).digest("hex");
}

// Adapt to advanced classifyLeadType that may return { type, signals } or a plain string
function getTypeAndSignals(result: any) {
  if (typeof result === "string") return { type: result, signals: undefined };
  if (result && typeof result.type === "string") return { type: result.type, signals: result.signals };
  return { type: "sfr", signals: undefined }; // safe default
}

export async function upsertLeadFromBatch(orgId: string, r: RawLead) {
  // 1) Normalize
  const norm = normalizeAddress({
    address: r.address, city: r.city, state: r.state, zip: r.zip
  });

  const canonical = getCanonicalFromNormalize(norm, r);
  const addressHash = makeOrgScopedHash(orgId, norm, canonical);

  // 2) Classify
  const { type, signals } = getTypeAndSignals(classifyLeadType(r as any));

  // 3) Upsert (compound unique on orgId+addressHash)
  const res = await prisma.lead.upsert({
    where: { orgId_addressHash: { orgId, addressHash } },
    create: {
      orgId,
      type,
      address: norm.line1 ?? r.address,
      city:    norm.city  ?? r.city,
      state:   norm.state ?? r.state,
      zip:     (norm.zip ?? r.zip).toString(),
      addressHash,
      landSignals: signals ? signals : undefined,
    },
    update: {
      // MVP: keep it simple—update type/signals if we re-see the same address
      type,
      landSignals: signals ? signals : undefined,
    },
  });

  return { id: res.id, created: res.createdAt.getTime() === res.updatedAt?.getTime() ? 1 : 0, updated: 1 };
}
