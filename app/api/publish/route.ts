import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluatePublishRequest } from "@/lib/gateway";
import { authorizeAgentRequest } from "@/lib/agent-auth";

const publishSchema = z.object({
  agentId: z.string().min(1), channelId: z.string().min(1), platform: z.enum(["youtube", "instagram", "mock"]),
  title: z.string().min(3), description: z.string().optional(), contentText: z.string().min(3),
  syntheticMedia: z.boolean().optional(), targetRegions: z.array(z.string()).optional(), publicInterestTopic: z.boolean().optional(),
  humanEditorialReview: z.boolean().optional(), platformDisclosureEnabled: z.boolean().optional(), customDisclosureAttached: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const authorization = authorizeAgentRequest(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const body = await request.json().catch(() => null);
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Publish request failed validation.", details: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await evaluatePublishRequest(parsed.data));
}
