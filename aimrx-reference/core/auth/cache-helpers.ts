/**
 * Cache Helpers for Middleware
 *
 * Uses cookies to cache user role and intake status to reduce database queries
 */
import { NextRequest, NextResponse } from "next/server";

const ROLE_COOKIE = "user_role_cache";
const INTAKE_COOKIE = "intake_complete_cache";
const MFA_PENDING_COOKIE = "mfa_pending";
const SESSION_STARTED_COOKIE = "session_started";
const CACHE_MAX_AGE = 60 * 60; // 1 hour
const MFA_PENDING_MAX_AGE = 60 * 10; // 10 minutes (matches MFA code expiry)
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours — forces re-login after this

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET || "fallback-dev-key";
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signTimestamp(timestamp: string): Promise<string> {
  const key = await getHmacKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp));
  return bufferToHex(signature);
}

async function verifySignedToken(token: string): Promise<{ valid: boolean; timestamp: number }> {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return { valid: false, timestamp: 0 };

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const expectedSignature = await signTimestamp(timestamp);
  if (signature !== expectedSignature) return { valid: false, timestamp: 0 };

  return { valid: true, timestamp: parseInt(timestamp, 10) };
}

export interface CachedUserData {
  role: string | null;
  intakeComplete: boolean | null;
  mfaPending: boolean;
  sessionToken: string | null;
}

export function getCachedUserData(request: NextRequest): CachedUserData {
  const roleCookie = request.cookies.get(ROLE_COOKIE)?.value;
  const intakeCookie = request.cookies.get(INTAKE_COOKIE)?.value;
  const mfaPendingCookie = request.cookies.get(MFA_PENDING_COOKIE)?.value;
  const sessionTokenCookie = request.cookies.get(SESSION_STARTED_COOKIE)?.value;

  return {
    role: roleCookie || null,
    intakeComplete:
      intakeCookie === "true" ? true : intakeCookie === "false" ? false : null,
    mfaPending: mfaPendingCookie === "true",
    sessionToken: sessionTokenCookie || null,
  };
}

export function setCachedRole(
  response: NextResponse,
  role: string | null,
): void {
  if (role) {
    response.cookies.set(ROLE_COOKIE, role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
}

export function setCachedIntakeStatus(
  response: NextResponse,
  isComplete: boolean,
): void {
  response.cookies.set(INTAKE_COOKIE, isComplete.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function clearCachedUserData(response: NextResponse): void {
  response.cookies.set(ROLE_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(INTAKE_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(MFA_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(SESSION_STARTED_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function setSessionStarted(response: NextResponse): Promise<void> {
  const timestamp = Date.now().toString();
  const signature = await signTimestamp(timestamp);
  const token = `${timestamp}.${signature}`;
  response.cookies.set(SESSION_STARTED_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function isSessionExpired(sessionToken: string | null): Promise<boolean> {
  if (!sessionToken) return true;

  const { valid, timestamp } = await verifySignedToken(sessionToken);
  if (!valid) return true;

  const elapsed = Date.now() - timestamp;
  return elapsed > SESSION_MAX_AGE * 1000;
}

export { SESSION_STARTED_COOKIE };

export function setMfaPending(response: NextResponse, isPending: boolean): void {
  if (isPending) {
    response.cookies.set(MFA_PENDING_COOKIE, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MFA_PENDING_MAX_AGE,
      path: "/",
    });
  } else {
    response.cookies.set(MFA_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  }
}

export function clearMfaPending(response: NextResponse): void {
  response.cookies.set(MFA_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
}
