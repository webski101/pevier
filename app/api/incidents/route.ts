import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view incidents." }, { status: 401 });
  const incidents = await db.incident.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(incidents.map((incident) => ({ ...incident, timeline: JSON.parse(incident.timelineJson) })));
}
