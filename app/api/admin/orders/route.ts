import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { readStore, updateStore } from "@/lib/serverStore";
import type { OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["accepted", "rejected", "deleted"],
  accepted: ["ready", "rejected", "deleted"],
  ready: ["sent-to-rider", "completed", "rejected", "deleted"],
  "sent-to-rider": ["completed", "deleted"],
  completed: ["deleted"],
  rejected: ["deleted"],
  deleted: [],
};

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = await readStore();
  return NextResponse.json({ orders: store.orders }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { id?: string; action?: "status" | "restore" | "delete" | "undo"; status?: OrderStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
  }
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Order id is required." }, { status: 400 });

  try {
    const saved = await updateStore((store) => {
      const index = store.orders.findIndex((order) => order.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      const order = store.orders[index];

      if (body.action === "delete") {
        return { ...store, orders: store.orders.filter((candidate) => candidate.id !== id) };
      }

      if (body.action === "undo") {
        if (!order.previousStatus) throw new Error("NO_PREVIOUS_STATUS");
        const targetStatus = order.previousStatus;
        const shouldCommitStock = ["accepted", "ready", "sent-to-rider", "completed"].includes(targetStatus);
        let menu = store.menu;
        let stockCommitted = Boolean(order.stockCommitted);
        if (shouldCommitStock && !stockCommitted) {
          menu = store.menu.map((item) => {
            const ordered = order.items.find((row) => row.id === item.id);
            if (!ordered) return item;
            const nextStock = Math.max(0, (item.stock ?? ordered.qty) - ordered.qty);
            return { ...item, stock: nextStock, available: item.available && nextStock > 0 };
          });
          stockCommitted = true;
        } else if (!shouldCommitStock && stockCommitted) {
          menu = store.menu.map((item) => {
            const ordered = order.items.find((row) => row.id === item.id);
            if (!ordered) return item;
            return { ...item, stock: (item.stock ?? 0) + ordered.qty, available: true };
          });
          stockCommitted = false;
        }
        const orders = [...store.orders];
        orders[index] = { ...order, status: targetStatus, stockCommitted, previousStatus: undefined, deletedAt: targetStatus === "deleted" ? order.deletedAt : undefined };
        return { ...store, menu, orders };
      }

      if (body.action === "restore") {
        if (order.status !== "deleted") throw new Error("INVALID_TRANSITION");
        const restoredStatus = order.previousStatus && order.previousStatus !== "deleted" ? order.previousStatus : "pending";
        const orders = [...store.orders];
        orders[index] = { ...order, status: restoredStatus, previousStatus: undefined, deletedAt: undefined };
        return { ...store, orders };
      }

      const nextStatus = body.status;
      if (!nextStatus || !allowedTransitions[order.status].includes(nextStatus)) throw new Error("INVALID_TRANSITION");
      let menu = store.menu;
      let stockCommitted = Boolean(order.stockCommitted);

      if (nextStatus === "accepted" && !stockCommitted) {
        menu = store.menu.map((item) => {
          const ordered = order.items.find((row) => row.id === item.id);
          if (!ordered) return item;
          const nextStock = Math.max(0, (item.stock ?? ordered.qty) - ordered.qty);
          return { ...item, stock: nextStock, available: item.available && nextStock > 0 };
        });
        stockCommitted = true;
      }
      if (nextStatus === "rejected" && stockCommitted) {
        menu = store.menu.map((item) => {
          const ordered = order.items.find((row) => row.id === item.id);
          if (!ordered) return item;
          return { ...item, stock: (item.stock ?? 0) + ordered.qty, available: true };
        });
        stockCommitted = false;
      }

      const orders = [...store.orders];
      orders[index] = {
        ...order,
        status: nextStatus,
        stockCommitted,
        previousStatus: order.status,
        deletedAt: nextStatus === "deleted" ? new Date().toISOString() : order.deletedAt,
      };
      return { ...store, menu, orders };
    });
    return NextResponse.json({ ok: true, orders: saved.orders, menu: saved.menu });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (error instanceof Error && error.message === "INVALID_TRANSITION") return NextResponse.json({ error: "This order action is not allowed in its current status." }, { status: 409 });
    if (error instanceof Error && error.message === "NO_PREVIOUS_STATUS") return NextResponse.json({ error: "There is nothing to undo for this order." }, { status: 409 });
    console.error("Order update failed", error);
    return NextResponse.json({ error: "Order update failed." }, { status: 500 });
  }
}
