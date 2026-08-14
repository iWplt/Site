import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Local auth is cookie-based via server actions. Supabase proxy gating remains optional.
  if (request.nextUrl.pathname.startsWith("/admin") && !request.cookies.get("warka_admin_session")) {
    // Allow the layout/requireUser to decide exact redirect after reading local DB sessions.
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/admin/:path*"]
};
