import { prisma } from "../db/prisma";

export async function ensureUserProvisioned(userId: string, email: string) {
  // upsert user
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: { email },
    create: { id: userId, email },
  });

  // find any membership
  let membership = await prisma.userOrgMembership.findFirst({ where: { userId } });

  // if none, create org + membership
  if (!membership) {
    const org = await prisma.organization.create({
      data: { timezone: "America/New_York", marketProfile: "metro_sfr" },
    });
    membership = await prisma.userOrgMembership.create({
      data: { userId: user.id, orgId: org.id, role: "owner" },
    });
  }

  return { userId: user.id, orgId: membership.orgId };
}
