import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "gs";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me");

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secret());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
