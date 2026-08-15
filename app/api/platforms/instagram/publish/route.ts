import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAgentRequest } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { evaluatePublishRequest } from "@/lib/gateway";
import { getInstagramStatus } from "@/lib/instagram";

export const runtime = "nodejs";

const MAX_DRY_RUN_MEDIA_BYTES = 128 * 1024 * 1024;
const metadataSchema = z.object({
  caption: z.string().trim().min(3).max(2200),
  format: z.enum(["FEED", "REEL"]),
  syntheticMedia: z.boolean(),
  humanEditorialReview: z.boolean(),
  platformDisclosureEnabled: z.boolean(),
  confirmPublicPublish: z.boolean(),
  videoUrl: z.string().trim().max(2048).optional(),
});

function formBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

export async function POST(request: Request) {
  const authorization = authorizeAgentRequest(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  const instagram = await getInstagramStatus();
  if (!instagram.connected || !instagram.accountId) {
    return NextResponse.json({
      error: instagram.lastError ?? "Verify an Instagram Professional account before running a publication simulation.",
    }, { status: 409 });
  }

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Use multipart/form-data with an image or video and Instagram metadata." }, { status: 400 }); }

  const rawCaption = form.get("caption");
  const rawFormat = form.get("format");
  const rawVideoUrl = form.get("videoUrl");
  const parsed = metadataSchema.safeParse({
    caption: typeof rawCaption === "string" ? rawCaption : "",
    format: rawFormat === "FEED" || rawFormat === "REEL" ? rawFormat : instagram.mode === "LIVE" ? "REEL" : "FEED",
    syntheticMedia: formBoolean(form.get("syntheticMedia")),
    humanEditorialReview: formBoolean(form.get("humanEditorialReview")),
    platformDisclosureEnabled: formBoolean(form.get("platformDisclosureEnabled")),
    confirmPublicPublish: formBoolean(form.get("confirmPublicPublish")),
    videoUrl: typeof rawVideoUrl === "string" && rawVideoUrl.trim() ? rawVideoUrl : undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join(".") || "metadata";
    return NextResponse.json({ error: `Instagram ${field} failed validation: ${issue.message}`, details: parsed.error.flatten() }, { status: 400 });
  }
  const media = form.get("media");
  const localMedia = media instanceof File && media.size > 0 ? media : null;
  if (instagram.mode !== "LIVE" && !localMedia) return NextResponse.json({ error: "An image or video file is required for a dry run." }, { status: 400 });
  if (localMedia && !localMedia.type.startsWith("image/") && !localMedia.type.startsWith("video/")) return NextResponse.json({ error: "The selected file must be an image or video." }, { status: 400 });
  if (localMedia && localMedia.size > MAX_DRY_RUN_MEDIA_BYTES) return NextResponse.json({ error: "The local dry run accepts media up to 128 MB." }, { status: 413 });
  if (instagram.mode !== "LIVE" && parsed.data.format === "REEL" && !localMedia?.type.startsWith("video/")) return NextResponse.json({ error: "A Reel simulation requires a video file." }, { status: 400 });
  if (instagram.mode === "LIVE" && parsed.data.format !== "REEL") {
    return NextResponse.json({ error: "Live Instagram publishing currently supports Reels only. Use dry run for feed images." }, { status: 400 });
  }
  let publicVideoUrl: string | null = null;
  if (instagram.mode === "LIVE") {
    try {
      const candidate = new URL(parsed.data.videoUrl ?? "");
      if (candidate.protocol !== "https:") throw new Error();
      publicVideoUrl = candidate.toString();
    } catch {
      return NextResponse.json({ error: "Live Instagram publishing requires a direct, publicly accessible HTTPS video URL." }, { status: 400 });
    }
  }
  if (instagram.mode === "LIVE" && !parsed.data.confirmPublicPublish) {
    return NextResponse.json({ error: "Confirm that this Reel may be published publicly before continuing." }, { status: 409 });
  }

  const preferredAgentId = process.env.INSTAGRAM_AGENT_ID?.trim() || "studio-agent-02";
  const agent = await db.agent.findUnique({ where: { id: preferredAgentId } }) ?? await db.agent.findFirst({ orderBy: { createdAt: "asc" } });
  if (!agent) return NextResponse.json({ error: "No Pevier publishing agent is available." }, { status: 409 });

  const channelId = `instagram-${instagram.accountId}`;
  const accountLabel = instagram.username ? `@${instagram.username}` : instagram.accountId;
  await db.channel.upsert({
    where: { id: channelId },
    update: { name: accountLabel, handle: accountLabel, platform: "instagram", agentId: agent.id },
    create: { id: channelId, name: accountLabel, handle: accountLabel, platform: "instagram", agentId: agent.id },
  });

  const title = parsed.data.caption.split(/\r?\n/, 1)[0].slice(0, 100);
  const result = await evaluatePublishRequest({
    agentId: agent.id,
    channelId,
    platform: "instagram",
    title,
    description: parsed.data.caption,
    contentText: parsed.data.caption,
    syntheticMedia: parsed.data.syntheticMedia,
    humanEditorialReview: parsed.data.humanEditorialReview,
    platformDisclosureEnabled: parsed.data.platformDisclosureEnabled,
  }, {
    delivery: instagram.mode === "LIVE" && publicVideoUrl ? {
      instagram: { publicConfirmation: parsed.data.confirmPublicPublish, shareToFeed: true, videoUrl: publicVideoUrl },
    } : undefined,
  });

  const platformRequestSent = result.publisherMode === "LIVE" && result.decision === "ALLOW" && parsed.data.confirmPublicPublish;
  const responseStatus = platformRequestSent && !result.publication.published ? 502 : 200;

  return NextResponse.json({
    ...result,
    simulation: {
      performed: true,
      destination: accountLabel,
      accountId: instagram.accountId,
      format: parsed.data.format,
      media: instagram.mode === "LIVE"
        ? { source: "public_https_url", url: publicVideoUrl }
        : { name: localMedia?.name, type: localMedia?.type, size: localMedia?.size },
      publicWriteAttempted: result.publication.published,
      platformRequestSent,
      safetyLock: instagram.safetyLock,
    },
  }, { status: responseStatus });
}
