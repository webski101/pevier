import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createInstagramAuthorizationUrl, isInstagramConfigured } from "@/lib/instagram";
import { getCurrentUser } from "@/lib/session";

function settingsRedirect(request: NextRequest, result: string) {
  const url = new URL("/control-room", request.url);
  url.searchParams.set("view", "Settings");
  url.searchParams.set("instagram", result);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/?auth=required", request.url));
  if (!isInstagramConfigured()) return settingsRedirect(request, "missing-config");

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(createInstagramAuthorizationUrl(request.nextUrl.origin, state));
  response.cookies.set("pevier_instagram_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
