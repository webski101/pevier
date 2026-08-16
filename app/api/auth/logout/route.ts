import { NextResponse } from "next/server";
import { destroyCurrentSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  await destroyCurrentSession();
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
