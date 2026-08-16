import { NextRequest, NextResponse } from "next/server";
import { getBlueskyJwks } from "@/lib/bluesky";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getBlueskyJwks(request.nextUrl.origin), {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bluesky JWKS is unavailable." }, { status: 503 });
  }
}
