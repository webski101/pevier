import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleAuthorizationCode } from "@/lib/google-auth";
import { createUserSession, sessionCookie } from "@/lib/session";

function matchesState(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function homeRedirect(request: NextRequest, result: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("auth", result);
  const response = NextResponse.redirect(url);
  response.cookies.delete("pevier_google_auth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return homeRedirect(request, "denied");
  if (!matchesState(request.cookies.get("pevier_google_auth_state")?.value, params.get("state"))) {
    return homeRedirect(request, "invalid-state");
  }

  const code = params.get("code");
  if (!code) return homeRedirect(request, "missing-code");

  try {
    const user = await exchangeGoogleAuthorizationCode(code, request.nextUrl.origin);
    const token = await createUserSession(user.id);
    const response = NextResponse.redirect(new URL("/control-room?view=Settings", request.url));
    response.cookies.delete("pevier_google_auth_state");
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    console.error("[google-auth] sign-in failed", error instanceof Error ? error.message : "Unknown error");
    return homeRedirect(request, "connection-failed");
  }
}
