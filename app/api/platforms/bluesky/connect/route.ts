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
  const handle = request.nextUrl.searchParams.get("handle")?.trim() ?? "";
  if (!handle) return settingsRedirect(request, "missing-handle");

  const state = randomBytes(32).toString("base64url");
  try {
    const authorizationUrl = await createBlueskyAuthorizationUrl(handle, state, request.nextUrl.origin);
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
