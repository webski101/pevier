import { NextResponse } from "next/server";
import { z } from "zod";
import { getBlueskyStatus, validateBlueskyText } from "@/lib/bluesky";
import { db } from "@/lib/db";
import { evaluatePublishRequest } from "@/lib/gateway";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const publishSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  syntheticMedia: z.boolean().default(false),
  humanEditorialReview: z.boolean().default(true),
  confirmPublicPublish: z.boolean().default(false),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before evaluating a Bluesky post." }, { status: 401 });
  const parsed = publishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bluesky post metadata failed validation.", details: parsed.error.flatten() }, { status: 400 });
  try { validateBlueskyText(parsed.data.text); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Bluesky post validation failed." }, { status: 400 }); }

  const bluesky = await getBlueskyStatus(user.id);
  if (!bluesky.connected || !bluesky.did || !bluesky.channelId || !bluesky.agentId) {
    return NextResponse.json({ error: bluesky.lastError ?? "Connect Bluesky before evaluating a post." }, { status: 409 });
  }
  if (bluesky.mode === "LIVE" && !parsed.data.confirmPublicPublish) {
    return NextResponse.json({ error: "Confirm that this post may be published publicly before continuing." }, { status: 409 });
  }

  const [agent, channel] = await Promise.all([
    db.agent.findUnique({ where: { id: bluesky.agentId } }),
    db.channel.findUnique({ where: { id: bluesky.channelId } }),
  ]);
  if (!agent || !channel) return NextResponse.json({ error: "The Bluesky publishing identity is incomplete. Reconnect the account." }, { status: 409 });

  const result = await evaluatePublishRequest({
    agentId: agent.id,
    channelId: channel.id,
    platform: "bluesky",
    title: parsed.data.text.split(/\r?\n/, 1)[0].slice(0, 100),
    description: parsed.data.text,
    contentText: parsed.data.text,
    syntheticMedia: parsed.data.syntheticMedia,
    humanEditorialReview: parsed.data.humanEditorialReview,
  }, {
    delivery: { bluesky: { userId: user.id, publicConfirmation: parsed.data.confirmPublicPublish } },
  });

  const platformRequestSent = result.publisherMode === "LIVE" && result.decision === "ALLOW" && parsed.data.confirmPublicPublish;
  const responseStatus = platformRequestSent && !result.publication.published ? 502 : 200;
  return NextResponse.json({
    ...result,
    execution: {
      evaluated: true,
      destination: bluesky.accountLabel,
      publicWriteAttempted: result.publication.published,
      platformRequestSent,
      safetyLock: bluesky.safetyLock,
    },
  }, { status: responseStatus });
}
