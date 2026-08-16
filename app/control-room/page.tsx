import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ControlRoom } from "@/components/control-room";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Room — Pevier",
  description: "Manage Instagram publishing policies, incidents, and tamper-evident audit evidence.",
};

export default async function ControlRoomPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=required");
  return <ControlRoom user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }} />;
}
