import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

function parsePolicyResults(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view publications." }, { status: 401 });
  const posts = await db.post.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { channel: { select: { name: true, handle: true } } },
  });
  return NextResponse.json(posts.map((post) => ({ ...post, policyResults: parsePolicyResults(post.policyResultsJson), policyResultsJson: undefined, targetRegionsJson: undefined })), { headers: { "cache-control": "no-store" } });
}
