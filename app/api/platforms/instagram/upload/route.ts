import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  INSTAGRAM_VIDEO_TYPES,
  MAX_INSTAGRAM_VIDEO_BYTES,
  instagramUploadPrefix,
  isOwnedInstagramBlobUrl,
} from "@/lib/instagram-media";
import { getInstagramStatus } from "@/lib/instagram";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = await request.json() as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "The temporary video upload request was malformed." }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user) throw new Error("Sign in before uploading an Instagram Reel.");
        const instagram = await getInstagramStatus(user.id);
        if (!instagram.connected || !instagram.accountId) throw new Error("Connect Instagram before uploading a Reel.");
        if (instagram.mode !== "LIVE") throw new Error("Enable Instagram Live public mode before uploading a Reel.");
        if (!pathname.startsWith(instagramUploadPrefix(instagram.accountId))) throw new Error("The upload path does not belong to this Instagram account.");

        return {
          allowedContentTypes: [...INSTAGRAM_VIDEO_TYPES],
          maximumSizeInBytes: MAX_INSTAGRAM_VIDEO_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60,
          tokenPayload: JSON.stringify({ accountId: instagram.accountId }),
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pevier could not prepare the temporary video upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before removing temporary media." }, { status: 401 });
  const instagram = await getInstagramStatus(user.id);
  if (!instagram.accountId) return NextResponse.json({ error: "No Instagram account is connected." }, { status: 409 });

  const payload = await request.json().catch(() => null) as { url?: unknown } | null;
  const url = typeof payload?.url === "string" ? payload.url : "";
  if (!isOwnedInstagramBlobUrl(url, instagram.accountId)) {
    return NextResponse.json({ error: "That temporary video does not belong to this Instagram account." }, { status: 403 });
  }

  await del(url);
  return NextResponse.json({ deleted: true });
}
