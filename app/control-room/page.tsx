import type { Metadata } from "next";
import { ControlRoom } from "@/components/control-room";

export const metadata: Metadata = {
  title: "Control Room — Pevier",
  description: "Manage YouTube connections, publishing policies, incidents, and tamper-evident audit evidence.",
};

export default function ControlRoomPage() {
  return <ControlRoom />;
}
