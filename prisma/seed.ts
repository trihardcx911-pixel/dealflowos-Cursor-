import { prisma } from "../src/db/prisma";
import { createHash } from "node:crypto";

async function upsertOrg() {
  const org = await prisma.organization.upsert({
    where: { id: "org_demo" },
    update: {},
    create: { id: "org_demo", name: "Demo Org" },
  });
  return org.id;
}

function addrHash(orgId: string, address: string, city: string, state: string, zip: string) {
  const canonical = `${address.trim()}, ${city.trim()}, ${state.trim()} ${zip.trim()}`.toUpperCase();
  return createHash("sha256").update(`${canonical}|${orgId}`).digest("hex");
}

async function upsertLead(
  orgId: string,
  a: { address: string; city: string; state: string; zip: string; type?: "sfr" | "land" | "multi" | "other" }
) {
  const addressHash = addrHash(orgId, a.address, a.city, a.state, a.zip);
  return prisma.lead.upsert({
    where: { orgId_addressHash: { orgId, addressHash } },
    update: {},
    create: {
      orgId,
      type: a.type ?? "sfr",
      address: a.address,
      city: a.city,
      state: a.state,
      zip: a.zip,
      addressHash,
    },
  });
}

async function ensureContact(leadId: string, type: string, value: string, source?: string) {
  try {
    await prisma.leadContact.create({ data: { leadId, type, value, source } });
  } catch (_) {
    // ignore duplicates
  }
}

async function main() {
  const orgId = await upsertOrg();
  const lead1 = await upsertLead(orgId, { address: "123 Main St", city: "Springfield", state: "IL", zip: "62701" });
  const lead2 = await upsertLead(orgId, { address: "42 Market Ave", city: "Columbus", state: "OH", zip: "43004", type: "land" });
  await ensureContact(lead1.id, "phone", "+15555550101", "seed");
  await ensureContact(lead1.id, "email", "owner@example.com", "seed");
  await ensureContact(lead2.id, "phone", "+15555550102", "seed");
  console.log("Seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
