import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createBlueskyAuthorizationUrl, isBlueskyConfigured } from "@/lib/bluesky";
import { getCurrentUser } from "@/lib/session";

function settingsRedirect(request: NextRequest, result: string) {
  const url = new URL("/control-room", request.url);
  url.searchParams.set("view", "Settings");
  url.searchParams.set("bluesky", result);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/?auth=required", request.url));
  if (!isBlueskyConfigured()) return settingsRedirect(request, "missing-config");
  // Most Bluesky users are hosted behind the bsky.social entryway. Starting
  // OAuth from the server lets Bluesky show its own login/account selector,
  // so Pevier does not need to ask for a handle first. A different AT Protocol
  // issuer can still be supplied later through the optional `issuer` query.
  const issuer = request.nextUrl.searchParams.get("issuer")?.trim() || "https://bsky.social";

  const state = randomBytes(32).toString("base64url");
  try {
    const authorizationUrl = await createBlueskyAuthorizationUrl(issuer, state, request.nextUrl.origin);
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("pevier_bluesky_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 10 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("[bluesky-oauth] authorization failed", error instanceof Error ? error.message : "Unknown error");
    return settingsRedirect(request, "authorization-failed");
  }
}
