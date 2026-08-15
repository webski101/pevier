import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createYouTubeAuthorizationUrl, isYouTubeConfigured } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const appUrl = new URL("/", request.url);
  appUrl.searchParams.set("view", "Settings");

  if (!isYouTubeConfigured()) {
    appUrl.searchParams.set("youtube", "missing-config");
    return NextResponse.redirect(appUrl);
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(createYouTubeAuthorizationUrl(new URL(request.url).origin, state));
  response.cookies.set("pevier_youtube_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}

