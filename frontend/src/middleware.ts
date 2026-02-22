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

  let userRole: string | null = null;
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      if (base64Url) {
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) base64 += '=';
        const jsonPayload = decodeURIComponent(
          atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        const parsed = JSON.parse(jsonPayload);
        userRole = parsed.role || null;
      }
    } catch {
      // ignore parse error or invalid token
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
