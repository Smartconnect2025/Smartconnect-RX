import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@core/supabase";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://app.aimrx.com",
  "https://aimrx-dev.onrender.com",
  "https://aimrx.onrender.com",
];

// In development, also allow localhost
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
];

function getCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");

  if (!origin) return null;

  // Check if origin is in allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // In development, also allow localhost origins
  if (process.env.NODE_ENV === "development" && DEV_ORIGINS.includes(origin)) {
    return origin;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    const corsOrigin = getCorsOrigin(request);
    const preflightResponse = new NextResponse(null, { status: 204 });

    if (corsOrigin) {
      preflightResponse.headers.set("Access-Control-Allow-Origin", corsOrigin);
      preflightResponse.headers.set("Access-Control-Allow-Credentials", "true");
    }
    preflightResponse.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    preflightResponse.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
    );
    preflightResponse.headers.set("Access-Control-Max-Age", "86400");

    return preflightResponse;
  }

  const response = await updateSession(request);

  // Clone the response to modify headers
  const res = response || NextResponse.next();

  // Add dynamic CORS origin header
  const corsOrigin = getCorsOrigin(request);
  if (corsOrigin) {
    res.headers.set("Access-Control-Allow-Origin", corsOrigin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
