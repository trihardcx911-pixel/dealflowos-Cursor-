import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ["RS256"],
    });
    return payload;
  } catch (err) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
}
