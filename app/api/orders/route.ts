import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { updateStore } from "@/lib/serverStore";
import type { CustomerInfo, Order, OrderItem } from "@/lib/orders";

export const dynamic = "force-dynamic";

type OrderRequest = {
  customer?: Partial<CustomerInfo>;
  items?: Array<{ id?: string; qty?: number }>;
};

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  let body: OrderRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid order data." }, { status: 400 });
  }

  const customer: CustomerInfo = {
    name: clean(body.customer?.name, 80),
    phone: clean(body.customer?.phone, 30),
    address: clean(body.customer?.address, 300),
    note: clean(body.customer?.note, 300),
  };

  if (!customer.name || !customer.phone || !customer.address) {
    return NextResponse.json({ error: "Name, mobile number and delivery address are required." }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return NextResponse.json({ error: "Add at least one valid menu item." }, { status: 400 });
  }

  try {
    let createdOrder: Order | null = null;
    await updateStore((store) => {
      const requested = new Map<string, number>();
      for (const row of body.items || []) {
        const id = clean(row.id, 100);
        const qty = Math.max(0, Math.min(20, Math.floor(Number(row.qty) || 0)));
        if (id && qty) requested.set(id, Math.min(20, (requested.get(id) || 0) + qty));
      }

      const orderItems: OrderItem[] = [];
      for (const [id, qty] of requested) {
        const item = store.menu.find((candidate) => candidate.id === id);
        if (!item || !item.available || (item.stock ?? 1) < qty) continue;
        orderItems.push({ id: item.id, name: item.name, price: item.price, qty, type: item.type });
      }
      if (orderItems.length === 0) throw new Error("NO_VALID_ITEMS");

      const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);
      const gst = Math.round((subtotal * Math.max(0, Number(store.settings.gstPercent) || 0)) / 100);
      const deliveryFee = Math.max(0, Number(store.settings.deliveryFee) || 0);
      const createdAt = new Date().toISOString();
      createdOrder = {
        id: `KB-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`,
        createdAt,
        customer,
        items: orderItems,
        subtotal,
        gst,
        deliveryFee,
        total: subtotal + gst + deliveryFee,
        orderChannel: "WhatsApp",
        status: "pending",
        whatsappOpenedAt: createdAt,
        stockCommitted: false,
      };
      return { ...store, orders: [createdOrder, ...store.orders].slice(0, 5000) };
    });

    return NextResponse.json({ ok: true, order: createdOrder }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_VALID_ITEMS") {
      return NextResponse.json({ error: "Selected items are unavailable or exceed current stock." }, { status: 409 });
    }
    console.error("Order creation failed", error);
    return NextResponse.json({ error: "The order could not be created. Please call the restaurant." }, { status: 500 });
  }
}
