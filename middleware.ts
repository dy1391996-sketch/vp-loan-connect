import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login" || pathname === "/api/admin/login") return NextResponse.next();
  const isAdminApi = pathname.startsWith("/api/admin/");
  const token = request.cookies.get("vplc_admin")?.value;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!token || !secret) return unauthorized(request, isAdminApi);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    if (payload.purpose !== "admin_session") throw new Error("Invalid purpose");
    return NextResponse.next();
  } catch {
    const response = unauthorized(request, isAdminApi);
    response.cookies.delete("vplc_admin");
    return response;
  }
}

function unauthorized(request: NextRequest, isAdminApi: boolean) {
  if (isAdminApi) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
