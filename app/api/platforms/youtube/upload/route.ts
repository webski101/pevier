import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluatePublishRequest } from "@/lib/gateway";
import { getCurrentUser } from "@/lib/session";
import { getYouTubeStatus } from "@/lib/youtube";

const MAX_LOCAL_UPLOAD_BYTES = 128 * 1024 * 1024;
const metadataSchema = z.object({
  agentId: z.string().min(1),
  channelId: z.string().min(1),
  title: z.string().min(3).max(100),
  description: z.string().max(5000).optional(),
  contentText: z.string().min(3).optional(),
  syntheticMedia: z.enum(["true", "false"]).optional(),
  humanEditorialReview: z.enum(["true", "false"]).optional(),
  platformDisclosureEnabled: z.enum(["true", "false"]).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in and connect your own YouTube channel before uploading." }, { status: 401 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Use multipart/form-data with a video file and upload metadata." }, { status: 400 }); }
  const video = form.get("video");
  if (!(video instanceof File)) return NextResponse.json({ error: "A video file is required." }, { status: 400 });
  if (!video.type.startsWith("video/")) return NextResponse.json({ error: "The selected file must be a video." }, { status: 400 });
  if (video.size > MAX_LOCAL_UPLOAD_BYTES) return NextResponse.json({ error: "The local pilot accepts videos up to 128 MB." }, { status: 413 });

  const parsed = metadataSchema.safeParse(Object.fromEntries([...form.entries()].filter(([key]) => key !== "video")));
  if (!parsed.success) return NextResponse.json({ error: "Upload metadata failed validation.", details: parsed.error.flatten() }, { status: 400 });
  const youtube = await getYouTubeStatus(user.id);
  if (!youtube.connected || !youtube.channelId || !youtube.agentId) return NextResponse.json({ error: "Connect your own YouTube channel before uploading." }, { status: 409 });
  if (parsed.data.channelId !== youtube.channelId || parsed.data.agentId !== youtube.agentId) return NextResponse.json({ error: "The selected channel does not belong to the signed-in user." }, { status: 403 });

  const result = await evaluatePublishRequest({
    agentId: parsed.data.agentId,
    channelId: parsed.data.channelId,
    platform: "youtube",
    title: parsed.data.title,
    description: parsed.data.description,
    contentText: parsed.data.contentText ?? `${parsed.data.title}\n${parsed.data.description ?? ""}`,
    syntheticMedia: parsed.data.syntheticMedia === "true",
    humanEditorialReview: parsed.data.humanEditorialReview === "true",
    platformDisclosureEnabled: parsed.data.platformDisclosureEnabled === "true",
  }, {
    delivery: { youtube: { userId: user.id }, video: { bytes: new Uint8Array(await video.arrayBuffer()), mimeType: video.type } },
  });

  const status = result.decision === "ALLOW" && result.publisherMode === "LIVE" && !result.publication.published ? 502 : 200;
  return NextResponse.json(result, { status });
}
