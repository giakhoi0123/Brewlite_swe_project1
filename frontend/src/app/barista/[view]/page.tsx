import { notFound } from "next/navigation";
import { BaristaBoard } from "@/components/barista-board";

const views = ["orders", "preparing", "ready", "history"] as const;

export default async function BaristaView({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.includes(view as (typeof views)[number])) notFound();
  return <BaristaBoard view={view as (typeof views)[number]} />;
}
