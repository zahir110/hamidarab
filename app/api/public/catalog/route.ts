import { NextResponse } from "next/server";
import { readStore } from "@/lib/serverStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  return NextResponse.json(
    { menu: store.menu, settings: store.settings, updatedAt: store.updatedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
