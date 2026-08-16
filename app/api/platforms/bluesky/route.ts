import { NextResponse } from "next/server";
import { z } from "zod";
import { disconnectBluesky, getBlueskyStatus, setBlueskyMode } from "@/lib/bluesky";
import { getCurrentUser } from "@/lib/session";

const modeSchema = z.object({ mode: z.enum(["DRY_RUN", "LIVE"]) });

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(await getBlueskyStatus(user?.id), { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before changing Bluesky publishing mode." }, { status: 401 });
  const parsed = modeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mode must be DRY_RUN or LIVE." }, { status: 400 });
  try {
    await setBlueskyMode(user.id, parsed.data.mode);
    return NextResponse.json(await getBlueskyStatus(user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update Bluesky mode." }, { status: 409 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before disconnecting Bluesky." }, { status: 401 });
  await disconnectBluesky(user.id);
  return NextResponse.json(await getBlueskyStatus(user.id));
}
