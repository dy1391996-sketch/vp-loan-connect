import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/constants";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login" || pathname === "/api/auth/login") return NextResponse.next();
  if (pathname.startsWith("/api/webhooks/")) return NextResponse.next();
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();
  if (pathname.startsWith("/go/wa/")) return NextResponse.next();

  const isProtectedApi = pathname.startsWith("/api/admin/") || pathname.startsWith("/api/tools/") || pathname.startsWith("/api/auth/logout");
  const isProtectedPage = !pathname.startsWith("/api/") && pathname !== "/login" && !pathname.startsWith("/go/wa/");

  if (!isProtectedApi && !isProtectedPage) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!token || !secret) return unauthorized(request, isProtectedApi);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    if (payload.purpose !== "admin_session") throw new Error("Invalid purpose");
    return NextResponse.next();
  } catch {
    const response = unauthorized(request, isProtectedApi);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

function unauthorized(request: NextRequest, isApi: boolean) {
  if (isApi) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
