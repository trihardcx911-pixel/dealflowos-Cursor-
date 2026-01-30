// Shared in-memory leads store for dev mode
// Structure: { [orgId: string]: Lead[] }
// Prisma is gated behind DATABASE_URL check to allow dev mode without DB setup
export const leadsByOrg: Record<string, any[]> = {};

// Lazy initialization helper to ensure org arrays exist
// This centralizes access and prevents direct mutation of leadsByOrg
export function getOrgLeads(orgId: string): any[] {
  if (!leadsByOrg[orgId]) {
    leadsByOrg[orgId] = [];
  }
  return leadsByOrg[orgId];
}

