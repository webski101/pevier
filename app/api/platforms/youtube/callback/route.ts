import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeYouTubeCode } from "@/lib/youtube";
import { createUserSession, sessionCookie } from "@/lib/session";

function matchesState(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function settingsRedirect(request: NextRequest, result: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("view", "Settings");
  url.searchParams.set("youtube", result);
  const response = NextResponse.redirect(url);
  response.cookies.delete("pevier_youtube_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return settingsRedirect(request, "denied");
  if (!matchesState(request.cookies.get("pevier_youtube_oauth_state")?.value, params.get("state"))) {
    return settingsRedirect(request, "invalid-state");
  }

  const code = params.get("code");
  if (!code) return settingsRedirect(request, "missing-code");

  try {
    const user = await exchangeYouTubeCode(code, request.nextUrl.origin);
    const token = await createUserSession(user.id);
    const response = settingsRedirect(request, "connected");
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch {
    return settingsRedirect(request, "connection-failed");
  }
}
