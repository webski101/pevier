import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluatePublishRequest } from "@/lib/gateway";
import { authorizeAgentRequest } from "@/lib/agent-auth";
import { getInstagramStatus } from "@/lib/instagram";

const publishSchema = z.object({
  agentId: z.string().min(1), channelId: z.string().min(1), platform: z.enum(["instagram", "mock"]),
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
    if (parsed.data.platform !== "instagram") return NextResponse.json({ error: "Production account keys currently support Instagram requests only." }, { status: 400 });
    const instagram = await getInstagramStatus(authorization.userId);
    if (!instagram.connected || !instagram.agentId || !instagram.channelId) return NextResponse.json({ error: "Connect Instagram before sending agent requests." }, { status: 409 });
    if (parsed.data.agentId !== instagram.agentId || parsed.data.channelId !== instagram.channelId) {
      return NextResponse.json({ error: "Use the agent and channel IDs shown in your Pevier Settings." }, { status: 403 });
    }
    return NextResponse.json(await evaluatePublishRequest(parsed.data, { delivery: { instagram: { userId: authorization.userId, publicConfirmation: false, shareToFeed: true } } }));
  }
  return NextResponse.json(await evaluatePublishRequest(parsed.data));
}
