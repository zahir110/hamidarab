import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { defaultSiteSettings, type MenuItem, type SiteSettings } from "@/lib/menu";
import { readStore, updateStore } from "@/lib/serverStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = await readStore();
  return NextResponse.json({ menu: store.menu, menuTrash: store.menuTrash, settings: store.settings }, { headers: { "Cache-Control": "no-store" } });
}

function validMenu(items: unknown): items is MenuItem[] {
  return Array.isArray(items) && items.length <= 250 && items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Partial<MenuItem>;
    return typeof row.id === "string" && row.id.length <= 100 && typeof row.name === "string" && row.name.length <= 120 && typeof row.category === "string" && typeof row.price === "number" && Number.isFinite(row.price) && row.price >= 0 && (row.type === "veg" || row.type === "nonveg") && typeof row.available === "boolean" && typeof row.description === "string";
  });
}

export async function PUT(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const text = await request.text();
  if (text.length > 8_000_000) return NextResponse.json({ error: "Catalog data is too large." }, { status: 413 });

  let body: { menu?: unknown; menuTrash?: unknown; settings?: Partial<SiteSettings> };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid catalog data." }, { status: 400 });
  }
  if (!validMenu(body.menu) || !validMenu(body.menuTrash)) {
    return NextResponse.json({ error: "Invalid menu data." }, { status: 400 });
  }

  const settings: SiteSettings = { ...defaultSiteSettings, ...(body.settings || {}) };
  settings.restaurantName = String(settings.restaurantName).slice(0, 100);
  settings.phone = String(settings.phone).slice(0, 40);
  settings.whatsappNumber = String(settings.whatsappNumber).replace(/[^0-9+]/g, "").slice(0, 20);
  settings.address = String(settings.address).slice(0, 300);
  settings.hours = String(settings.hours).slice(0, 100);
  settings.openLabel = String(settings.openLabel).slice(0, 100);
  settings.orderNote = String(settings.orderNote).slice(0, 500);
  settings.deliveryNote = String(settings.deliveryNote).slice(0, 500);
  settings.deliveryMode = String(settings.deliveryMode).slice(0, 200);
  settings.gstPercent = Math.max(0, Math.min(100, Number(settings.gstPercent) || 0));
  settings.deliveryFee = Math.max(0, Number(settings.deliveryFee) || 0);
  settings.youtubeLinks = Array.isArray(settings.youtubeLinks) ? settings.youtubeLinks.slice(0, 10).map((value) => String(value).slice(0, 500)) : [];

  const saved = await updateStore((store) => ({ ...store, menu: body.menu as MenuItem[], menuTrash: (body.menuTrash as MenuItem[]).slice(0, 20), settings }));
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
}
