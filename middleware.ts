import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/login", "/signup", "/home", "/forgot-password"];
const publicApiRoutes = ["/api/auth", "/api/webhooks"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Check if it's a public route
  const isPublicRoute = publicRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  // Check if it's a public API route
  const isPublicApiRoute = publicApiRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  // Check if it's an API route
  const isApiRoute = nextUrl.pathname.startsWith("/api");

  // Allow public routes
  if (isPublicRoute) {
    // Redirect logged in users away from login/signup to dashboard
    if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Allow public API routes
  if (isPublicApiRoute) {
    return NextResponse.next();
  }

  // For API routes, return 401 if not authenticated
  if (isApiRoute && !isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For protected pages, redirect to login if not authenticated
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|home).*)",
  ],
};
