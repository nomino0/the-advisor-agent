import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/new-analysis", "/settings", "/analysis", "/admin"];
// Routes only for guests (logged-in users get redirected away)
const guestOnlyRoutes = ["/login", "/register"];
// Admin-only routes
const adminRoutes = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read the auth token from cookies (set on login)
  const token = request.cookies.get("access_token")?.value;
  const userRaw = request.cookies.get("user")?.value;

  let userRole: string | null = null;
  if (userRaw) {
    try {
      userRole = JSON.parse(decodeURIComponent(userRaw))?.role ?? null;
    } catch {
      // ignore parse error
    }
  }

  const isLoggedIn = !!token;
  const isAdmin = userRole === "admin";

  // Logged-in user tries to visit /login or /register → redirect to appropriate home
  if (isLoggedIn && guestOnlyRoutes.some((r) => pathname.startsWith(r))) {
    const target = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Unauthenticated user tries to visit a protected route → redirect to /login
  if (!isLoggedIn && protectedRoutes.some((r) => pathname.startsWith(r))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Non-admin visits /admin → redirect to /dashboard
  if (isLoggedIn && !isAdmin && adminRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
