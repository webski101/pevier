import { db } from "./db";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_AUTH_SCOPES = ["openid", "email", "profile"] as const;

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function credentials() {
  return {
    clientId: process.env.GOOGLE_AUTH_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET?.trim() ?? "",
  };
}

function redirectUri(origin: string) {
  return process.env.GOOGLE_AUTH_REDIRECT_URI?.trim() || `${origin}/api/auth/google/callback`;
}

export function isGoogleAuthConfigured() {
  const { clientId, clientSecret } = credentials();
  return Boolean(clientId && clientSecret);
}

export function createGoogleAuthorizationUrl(origin: string, state: string) {
  const { clientId } = credentials();
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_AUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url;
}

async function readJson<T>(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({})) as T & { error_description?: string; error?: string };
  if (!response.ok) throw new Error(payload.error_description || payload.error || fallback);
  return payload;
}

export async function exchangeGoogleAuthorizationCode(code: string, origin: string) {
  const { clientId, clientSecret } = credentials();
  const token = await readJson<GoogleTokenResponse>(await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  }), "Google rejected the authorization code.");

  if (!token.access_token) throw new Error("Google did not return an access token.");
  const profile = await readJson<GoogleProfile>(await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  }), "Google could not return the account profile.");

  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    throw new Error("A verified Google email address is required.");
  }

  return db.user.upsert({
    where: { googleSubject: profile.sub },
    update: {
      email: profile.email.toLowerCase(),
      name: profile.name?.trim() || profile.email.split("@")[0],
      avatarUrl: profile.picture ?? null,
    },
    create: {
      googleSubject: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name?.trim() || profile.email.split("@")[0],
      avatarUrl: profile.picture ?? null,
    },
  });
}
