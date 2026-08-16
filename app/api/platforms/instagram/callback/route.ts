import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeInstagramCode } from "@/lib/instagram";
import { getCurrentUser } from "@/lib/session";

function matchesState(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function settingsRedirect(request: NextRequest, result: string) {
  const url = new URL("/control-room", request.url);
  url.searchParams.set("view", "Settings");
  url.searchParams.set("instagram", result);
  const response = NextResponse.redirect(url);
  response.cookies.delete("pevier_instagram_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/?auth=required", request.url));
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return settingsRedirect(request, "denied");
  if (!matchesState(request.cookies.get("pevier_instagram_oauth_state")?.value, params.get("state"))) {
    return settingsRedirect(request, "invalid-state");
  }
  const code = params.get("code");
  if (!code) return settingsRedirect(request, "missing-code");
  try {
    await exchangeInstagramCode(code, user.id, request.nextUrl.origin);
    return settingsRedirect(request, "connected");
  } catch (error) {
    console.error("[instagram-oauth] connection failed", error instanceof Error ? error.message : "Unknown error");
    return settingsRedirect(request, "connection-failed");
  }
}
