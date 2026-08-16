import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createGoogleAuthorizationUrl, isGoogleAuthConfigured } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(new URL("/?auth=missing-config", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(createGoogleAuthorizationUrl(request.nextUrl.origin, state));
  response.cookies.set("pevier_google_auth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
