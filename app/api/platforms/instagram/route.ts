import { NextResponse } from "next/server";
import { getInstagramStatus } from "@/lib/instagram";

export async function GET() {
  return NextResponse.json(await getInstagramStatus(), {
    headers: { "cache-control": "no-store" },
  });
}
