import { auth } from "@/lib/auth";

export default auth((request) => {
  const isLoggedIn = Boolean(request.auth);
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");

  if (!isLoggedIn && isDashboardRoute) {
    const loginUrl = new URL("/login", request.nextUrl);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
