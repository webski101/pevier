import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const schema = z.object({ id: z.string(), enabled: z.boolean().optional(), warnAt: z.number().min(0).max(1).nullable().optional(), holdAt: z.number().min(0).max(1).nullable().optional(), blockAt: z.number().min(0).max(1).nullable().optional() });

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(user ? await db.policySetting.findMany({ where: { userId: user.id } }) : []);
}
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before changing policy settings." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Policy setting failed validation." }, { status: 400 });
  const { id: policyId, ...data } = parsed.data;
  return NextResponse.json(await db.policySetting.upsert({
    where: { userId_policyId: { userId: user.id, policyId } },
    update: data,
    create: { userId: user.id, policyId, ...data },
  }));
}
