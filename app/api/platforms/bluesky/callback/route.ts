import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { callbackBlueskyAuthorization, finalizeBlueskyConnection } from "@/lib/bluesky";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

function matchesState(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function settingsRedirect(request: NextRequest, result: string) {
  const url = new URL("/control-room", request.url);
  url.searchParams.set("view", "Settings");
  url.searchParams.set("bluesky", result);
  const response = NextResponse.redirect(url);
  response.cookies.delete("pevier_bluesky_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/?auth=required", request.url));
  try {
    const result = await callbackBlueskyAuthorization(request.nextUrl.searchParams, request.nextUrl.origin);
    if (!matchesState(request.cookies.get("pevier_bluesky_oauth_state")?.value, result.state)) {
      await result.session.signOut().catch(() => undefined);
      return settingsRedirect(request, "invalid-state");
    }
    await finalizeBlueskyConnection(user.id, result.session);
    return settingsRedirect(request, "connected");
  } catch (error) {
    console.error("[bluesky-oauth] connection failed", error instanceof Error ? error.message : "Unknown error");
    return settingsRedirect(request, "connection-failed");
  }
}
