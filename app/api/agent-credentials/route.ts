import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAgentToken } from "@/lib/agent-auth";
import { getCurrentUser } from "@/lib/session";

const createSchema = z.object({ label: z.string().trim().min(2).max(60).default("Production agent") });
const revokeSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage agent keys." }, { status: 401 });
  const credentials = await db.agentCredential.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, tokenPrefix: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json(credentials, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create an agent key." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Agent key label failed validation." }, { status: 400 });
  const issued = createAgentToken();
  const credential = await db.agentCredential.create({
    data: { userId: user.id, label: parsed.data.label, tokenHash: issued.tokenHash, tokenPrefix: issued.tokenPrefix },
    select: { id: true, label: true, tokenPrefix: true, createdAt: true },
  });
  return NextResponse.json({ ...credential, token: issued.token }, { status: 201, headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to revoke an agent key." }, { status: 401 });
  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Agent key request failed validation." }, { status: 400 });
  const result = await db.agentCredential.updateMany({ where: { id: parsed.data.id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) return NextResponse.json({ error: "Agent key was not found." }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
