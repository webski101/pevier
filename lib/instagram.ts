export type InstagramStatus = {
  configured: boolean;
  connected: boolean;
  status: "NOT_CONFIGURED" | "CONNECTED" | "ERROR";
  mode: "DRY_RUN" | "LIVE";
  requestedMode: "DRY_RUN" | "LIVE";
  accountId: string | null;
  username: string | null;
  accountType: string | null;
  tokenStoredServerSide: true;
  publishingImplemented: true;
  publicOnly: true;
  safetyLock: "DRY_RUN_MODE" | "PUBLIC_CONFIRMATION_REQUIRED";
  lastError: string | null;
};

type InstagramMe = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
};

function apiVersion() {
  const configured = process.env.INSTAGRAM_API_VERSION?.trim();
  return configured && /^v\d+\.\d+$/.test(configured) ? configured : "v23.0";
}

export function resolveInstagramMode(): "DRY_RUN" | "LIVE" {
  return process.env.INSTAGRAM_PUBLISH_MODE === "LIVE" ? "LIVE" : "DRY_RUN";
}

export function isInstagramConfigured() {
  return Boolean(process.env.INSTAGRAM_APP_ID?.trim() && process.env.INSTAGRAM_ACCESS_TOKEN?.trim());
}

function baseStatus(): InstagramStatus {
  return {
    configured: isInstagramConfigured(),
    connected: false,
    status: "NOT_CONFIGURED",
    mode: "DRY_RUN",
    requestedMode: resolveInstagramMode(),
    accountId: null,
    username: null,
    accountType: null,
    tokenStoredServerSide: true,
    publishingImplemented: true,
    publicOnly: true,
    safetyLock: "DRY_RUN_MODE",
    lastError: null,
  };
}

export async function getInstagramStatus(): Promise<InstagramStatus> {
  const status = baseStatus();
  if (!status.configured) return status;

  try {
    const response = await fetch(
      `https://graph.instagram.com/${apiVersion()}/me?fields=id,user_id,username,account_type`,
      {
        cache: "no-store",
        headers: { authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}` },
      },
    );

    if (!response.ok) {
      return {
        ...status,
        status: "ERROR",
        lastError: response.status === 401 || response.status === 403
          ? "Instagram rejected the access token. Generate a new tester token and restart Pevier."
          : `Instagram identity check failed with HTTP ${response.status}.`,
      };
    }

    const account = await response.json() as InstagramMe;
    const accountId = account.user_id ?? account.id ?? null;
    if (!accountId) {
      return { ...status, status: "ERROR", lastError: "Instagram returned no professional account identity." };
    }

    return {
      ...status,
      connected: true,
      status: "CONNECTED",
      mode: status.requestedMode,
      safetyLock: status.requestedMode === "LIVE" ? "PUBLIC_CONFIRMATION_REQUIRED" : "DRY_RUN_MODE",
      accountId,
      username: account.username ?? null,
      accountType: account.account_type ?? null,
    };
  } catch {
    return { ...status, status: "ERROR", lastError: "Pevier could not reach Instagram to verify the account." };
  }
}

type InstagramApiError = { error?: { message?: string } };

async function instagramApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as InstagramApiError | null;
  const message = payload?.error?.message?.replace(/access_token=[^&\s]+/gi, "access_token=[redacted]");
  return message ? `${fallback}: ${message.slice(0, 280)}` : `${fallback} (HTTP ${response.status}).`;
}

async function waitForContainer(containerId: string, token: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(
      `https://graph.instagram.com/${apiVersion()}/${containerId}?fields=status_code,status`,
      { cache: "no-store", headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(await instagramApiError(response, "Instagram could not read the Reel processing status"));
    const payload = await response.json() as { status_code?: string; status?: string };
    if (payload.status_code === "FINISHED") return;
    if (payload.status_code === "ERROR" || payload.status_code === "EXPIRED") {
      throw new Error(`Instagram could not process the Reel: ${payload.status ?? payload.status_code}.`);
    }
    if (attempt < 11) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Instagram Reel processing did not finish within the local request window.");
}

export async function publishInstagramReel(videoUrl: string, options: { caption: string; shareToFeed: boolean }) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Instagram access token is not configured.");
  const source = new URL(videoUrl);
  if (source.protocol !== "https:") throw new Error("Instagram requires a public HTTPS video URL.");
  const status = await getInstagramStatus();
  if (!status.connected || !status.accountId) throw new Error(status.lastError ?? "Instagram account identity could not be verified.");

  const containerUrl = new URL(
    `https://graph.instagram.com/${apiVersion()}/${status.accountId}/media`,
  );
  containerUrl.searchParams.set("media_type", "REELS");
  containerUrl.searchParams.set("video_url", source.toString());
  containerUrl.searchParams.set("caption", options.caption);
  containerUrl.searchParams.set("share_to_feed", options.shareToFeed ? "true" : "false");
  const containerResponse = await fetch(
    containerUrl,
    { method: "POST", headers: { authorization: `Bearer ${token}` } },
  );
  if (!containerResponse.ok) throw new Error(await instagramApiError(containerResponse, "Instagram could not create the Reel container"));
  const container = await containerResponse.json() as { id?: string };
  if (!container.id) throw new Error("Instagram returned no Reel container ID.");

  await waitForContainer(container.id, token);

  const publishUrl = new URL(
    `https://graph.instagram.com/${apiVersion()}/${status.accountId}/media_publish`,
  );
  publishUrl.searchParams.set("creation_id", container.id);
  const publishResponse = await fetch(
    publishUrl,
    { method: "POST", headers: { authorization: `Bearer ${token}` } },
  );
  if (!publishResponse.ok) throw new Error(await instagramApiError(publishResponse, "Instagram could not publish the Reel"));
  const published = await publishResponse.json() as { id?: string };
  if (!published.id) throw new Error("Instagram returned no published media ID.");
  return { id: published.id, containerId: container.id };
}
