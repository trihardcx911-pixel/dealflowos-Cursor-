import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { env } from "../config/env";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!env.SUPABASE_JWKS_URL) {
    throw new Error("SUPABASE_JWKS_URL is not set");
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));
  }
  return jwks;
}

export async function verifyJwt(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwks(), {
    // You can add issuer/audience checks later if you want to lock this down
  });
  return payload;
}
