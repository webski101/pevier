import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluatePublishRequest } from "@/lib/gateway";
import { authorizeAgentRequest } from "@/lib/agent-auth";
import { getInstagramStatus } from "@/lib/instagram";
import { getBlueskyStatus } from "@/lib/bluesky";

const publishSchema = z.object({
  agentId: z.string().min(1), channelId: z.string().min(1), platform: z.enum(["instagram", "bluesky", "mock"]),
  title: z.string().min(3), description: z.string().optional(), contentText: z.string().min(3),
  syntheticMedia: z.boolean().optional(), targetRegions: z.array(z.string()).optional(), publicInterestTopic: z.boolean().optional(),
  humanEditorialReview: z.boolean().optional(), platformDisclosureEnabled: z.boolean().optional(), customDisclosureAttached: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const authorization = await authorizeAgentRequest(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const body = await request.json().catch(() => null);
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Publish request failed validation.", details: parsed.error.flatten() }, { status: 400 });
  if (authorization.userId) {
    if (parsed.data.platform === "mock") return NextResponse.json({ error: "Production account keys require a connected live platform." }, { status: 400 });
    const platform = parsed.data.platform === "instagram"
      ? await getInstagramStatus(authorization.userId)
      : await getBlueskyStatus(authorization.userId);
    if (!platform.connected || !platform.agentId || !platform.channelId) return NextResponse.json({ error: `Connect ${parsed.data.platform === "instagram" ? "Instagram" : "Bluesky"} before sending agent requests.` }, { status: 409 });
    if (parsed.data.agentId !== platform.agentId || parsed.data.channelId !== platform.channelId) {
      return NextResponse.json({ error: "Use the agent and channel IDs shown in your Pevier Settings." }, { status: 403 });
    }
    const delivery = parsed.data.platform === "instagram"
      ? { instagram: { userId: authorization.userId, publicConfirmation: false, shareToFeed: true } }
      : { bluesky: { userId: authorization.userId, publicConfirmation: false } };
    return NextResponse.json(await evaluatePublishRequest(parsed.data, { delivery }));
  }
  return NextResponse.json(await evaluatePublishRequest(parsed.data));
}
