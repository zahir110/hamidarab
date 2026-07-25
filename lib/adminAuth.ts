import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "kebabest_admin_session";
const SESSION_MS = 24 * 60 * 60 * 1000;

type SessionPayload = { exp: number };

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "change-this-secret-before-launch";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createAdminSession(): { token: string; expires: Date } {
  const expires = new Date(Date.now() + SESSION_MS);
  const payload = Buffer.from(JSON.stringify({ exp: expires.getTime() } satisfies SessionPayload)).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expires };
}

export function verifyAdminToken(token?: string): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    return Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

export function isAdminRequest(request: NextRequest): boolean {
  return verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);
}
