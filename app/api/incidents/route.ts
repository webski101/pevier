import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  const incidents = user ? await db.incident.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [];
  return NextResponse.json(incidents.map((incident) => ({ ...incident, timeline: JSON.parse(incident.timelineJson) })));
}
