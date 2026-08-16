import { NextRequest, NextResponse } from "next/server";
import { getBlueskyClientMetadata } from "@/lib/bluesky";

export async function GET(request: NextRequest) {
  return NextResponse.json(getBlueskyClientMetadata(request.nextUrl.origin), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
