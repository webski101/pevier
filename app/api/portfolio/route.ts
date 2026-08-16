import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view the portfolio." }, { status: 401 });
  const connections = await db.platformConnection.findMany({ where: { userId: user.id, status: "CONNECTED" } });
  const channelIds = connections.flatMap((connection) => connection.channelId ? [connection.channelId] : []);
  const [channels, agents] = await Promise.all([
    db.channel.findMany({ where: { id: { in: channelIds } }, include: { agent: { select: { name: true, state: true } }, posts: { where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 } } }),
    db.agent.findMany({ where: { channels: { some: { id: { in: channelIds } } } }, include: { channels: { where: { id: { in: channelIds } } } } }),
  ]);
  return NextResponse.json({ channels, agents });
}
