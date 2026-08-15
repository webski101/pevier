import { NextResponse } from "next/server";
import { z } from "zod";
import { disconnectYouTube, getYouTubeStatus, setYouTubeMode } from "@/lib/youtube";
import { getCurrentUser } from "@/lib/session";

const modeSchema = z.object({ mode: z.enum(["DRY_RUN", "LIVE"]) });

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(await getYouTubeStatus(user?.id), { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google before changing YouTube mode." }, { status: 401 });
  const parsed = modeSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Mode must be DRY_RUN or LIVE." }, { status: 400 });

  try {
    await setYouTubeMode(user.id, parsed.data.mode);
    return NextResponse.json(await getYouTubeStatus(user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update YouTube mode." }, { status: 409 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google before disconnecting YouTube." }, { status: 401 });
  await disconnectYouTube(user.id);
  return NextResponse.json(await getYouTubeStatus(user.id));
}
