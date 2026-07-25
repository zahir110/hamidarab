import { NextResponse } from "next/server";
import { readStore } from "@/lib/serverStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Order id is required." }, { status: 400 });

  const store = await readStore();
  const order = store.orders.find((candidate) => candidate.id === id);
  if (!order || order.status === "deleted") {
    return NextResponse.json({ error: "We could not find this order. Please call the restaurant." }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    total: order.total,
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
  });
}
