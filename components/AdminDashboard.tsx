"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, Clock, Copy, Eye, Lock, LogOut, MessageCircle, Plus, RotateCcw, Save, Send, Trash2, Upload, X } from "lucide-react";
import { categories, defaultMenu, defaultSiteSettings, type MenuItem, type SiteSettings } from "@/lib/menu";
import type { Order, OrderStatus } from "@/lib/orders";

type OrderTab = "new" | "accepted" | "ready" | "dispatched" | "completed" | "rejected" | "trash";
type ConfirmAction =
  | { kind: "menu-delete" }
  | { kind: "menu-permanent"; id: string }
  | { kind: "order-trash"; id: string }
  | { kind: "order-permanent"; id: string }
  | null;

type CatalogState = { items: MenuItem[]; trashItems: MenuItem[]; settings: SiteSettings };

function normalizeYoutube(url: string) {
  const value = url.trim();
  if (!value) return "";
  if (value.includes("youtube.com/embed/")) return value;
  if (value.includes("watch?v=")) return value.replace("watch?v=", "embed/").split("&")[0];
  if (value.includes("youtu.be/")) return value.replace("youtu.be/", "youtube.com/embed/").split("?")[0];
  return value;
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const maxSide = 1100;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#fff6e8";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

const ALERTS_PREF_KEY = "kebabest_admin_alerts_enabled";

function playAlertSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
    oscillator.onended = () => void ctx.close();
  } catch {
    // audio not available; ignore
  }
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, pin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login failed.");
      onLogin();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="admin-login-screen">
    <section className="admin-login-card">
      <div className="login-badge"><Lock /></div>
      <span className="eyebrow">Owner access</span>
      <h1>Kebabest Admin</h1>
      <p>Sign in to manage orders, menu availability, prices, photos and restaurant information.</p>
      <input type="password" autoComplete="current-password" placeholder="Owner password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <input inputMode="numeric" autoComplete="one-time-code" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      {error && <p className="login-error">{error}</p>}
      <button disabled={loading || !password || !pin} onClick={submit}>{loading ? "Signing in..." : "Unlock dashboard"}</button>
    </section>
  </main>;
}

export default function AdminDashboard() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [items, setItems] = useState<MenuItem[]>(defaultMenu);
  const [trashItems, setTrashItems] = useState<MenuItem[]>([]);
  const [active, setActive] = useState<MenuItem>(defaultMenu[0]);
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderTab, setOrderTab] = useState<OrderTab>("new");
  const [notifStatus, setNotifStatus] = useState<string>("Not enabled");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [imageNote, setImageNote] = useState<string>("");
  const [saveState, setSaveState] = useState<string>("Saved");
  const [toast, setToast] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogRef = useRef<CatalogState>({ items: defaultMenu, trashItems: [], settings: defaultSiteSettings });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const loadOrders = useCallback(async (notify = false) => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    if (response.status === 401) { setAuthorized(false); return; }
    if (!response.ok) throw new Error("Orders could not be loaded.");
    const data = await response.json() as { orders?: Order[] };
    const nextOrders = Array.isArray(data.orders) ? data.orders : [];
    if (notify && alertsEnabled && knownOrderIds.current.size) {
      const newOrders = nextOrders.filter((order) => order.status === "pending" && !knownOrderIds.current.has(order.id));
      if (newOrders.length) {
        setOrderTab("new");
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const first = newOrders[0];
          new Notification("New restaurant order", { body: `${first.id} • ₹${first.total} • ${first.customer.name}` });
        }
        playAlertSound();
        showToast(`${newOrders.length} new WhatsApp order${newOrders.length > 1 ? "s" : ""}.`);
      }
    }
    knownOrderIds.current = new Set(nextOrders.map((order) => order.id));
    setOrders(nextOrders);
  }, [alertsEnabled]);

  const loadDashboard = useCallback(async () => {
    const [catalogResponse] = await Promise.all([
      fetch("/api/admin/catalog", { cache: "no-store" }),
      loadOrders(false),
    ]);
    if (catalogResponse.status === 401) { setAuthorized(false); return; }
    if (!catalogResponse.ok) throw new Error("Restaurant settings could not be loaded.");
    const catalog = await catalogResponse.json() as { menu?: MenuItem[]; menuTrash?: MenuItem[]; settings?: SiteSettings };
    const loadedItems = Array.isArray(catalog.menu) && catalog.menu.length ? catalog.menu : defaultMenu;
    const loadedTrash = Array.isArray(catalog.menuTrash) ? catalog.menuTrash : [];
    const loadedSettings = { ...defaultSiteSettings, ...(catalog.settings || {}) };
    catalogRef.current = { items: loadedItems, trashItems: loadedTrash, settings: loadedSettings };
    setItems(loadedItems);
    setTrashItems(loadedTrash);
    setSettings(loadedSettings);
    setActive(loadedItems[0] || defaultMenu[0]);
  }, [loadOrders]);

  useEffect(() => {
    setAlertsEnabled(window.localStorage.getItem(ALERTS_PREF_KEY) === "1");
  }, []);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setAuthorized(Boolean(data.authorized)))
      .catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadDashboard().catch((error) => showToast(error instanceof Error ? error.message : "Dashboard could not be loaded."));
    setNotifStatus(typeof Notification !== "undefined" ? Notification.permission : "Unsupported");
    const timer = window.setInterval(() => loadOrders(true).catch(() => undefined), 10_000);
    return () => window.clearInterval(timer);
  }, [authorized, loadDashboard, loadOrders]);

  const scheduleCatalogSave = (next: CatalogState) => {
    catalogRef.current = next;
    setItems(next.items);
    setTrashItems(next.trashItems);
    setSettings(next.settings);
    setSaveState("Saving...");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ menu: next.items, menuTrash: next.trashItems, settings: next.settings }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Changes could not be saved.");
        setSaveState("Saved");
      } catch (error) {
        setSaveState("Save failed");
        showToast(error instanceof Error ? error.message : "Changes could not be saved.");
      }
    }, 450);
  };

  const commitCatalog = (patch: Partial<CatalogState>) => scheduleCatalogSave({ ...catalogRef.current, ...patch });

  const stats = useMemo(() => ({
    newOrders: orders.filter((order) => order.status === "pending").length,
    total: orders.filter((order) => ["accepted", "ready", "sent-to-rider", "completed"].includes(order.status)).reduce((sum, order) => sum + order.total, 0),
    lowStock: items.filter((item) => (item.stock ?? 0) <= 3 || !item.available).length,
    trash: orders.filter((order) => order.status === "deleted").length + trashItems.length,
  }), [orders, items, trashItems]);

  const orderTabs = useMemo(() => ([
    { key: "new" as OrderTab, label: "New", count: orders.filter((order) => order.status === "pending").length },
    { key: "accepted" as OrderTab, label: "Accepted", count: orders.filter((order) => order.status === "accepted").length },
    { key: "ready" as OrderTab, label: "Ready", count: orders.filter((order) => order.status === "ready").length },
    { key: "dispatched" as OrderTab, label: "Dispatched", count: orders.filter((order) => order.status === "sent-to-rider").length },
    { key: "completed" as OrderTab, label: "Completed", count: orders.filter((order) => order.status === "completed").length },
    { key: "rejected" as OrderTab, label: "Rejected", count: orders.filter((order) => order.status === "rejected").length },
    { key: "trash" as OrderTab, label: "Trash", count: orders.filter((order) => order.status === "deleted").length },
  ]), [orders]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (orderTab === "new") return order.status === "pending";
    if (orderTab === "dispatched") return order.status === "sent-to-rider";
    if (orderTab === "trash") return order.status === "deleted";
    return order.status === orderTab;
  }), [orders, orderTab]);

  if (authorized === null) return <main className="admin-login-screen"><section className="admin-login-card"><div className="login-badge"><Lock /></div><h1>Loading dashboard</h1></section></main>;
  if (!authorized) return <AdminLogin onLogin={() => setAuthorized(true)} />;

  const updateActive = (patch: Partial<MenuItem>) => {
    const nextItem = { ...active, ...patch };
    setActive(nextItem);
    commitCatalog({ items: catalogRef.current.items.map((item) => item.id === nextItem.id ? nextItem : item) });
  };

  const addNew = () => {
    const item: MenuItem = { id: `item-${Date.now()}`, name: "New menu item", category: "Kebabs", price: 100, type: "nonveg", available: true, stock: 10, description: "", image: "" };
    setActive(item);
    setPhotoPreview("");
    commitCatalog({ items: [item, ...catalogRef.current.items] });
    showToast("Menu item added.");
  };

  const duplicateItem = () => {
    const item: MenuItem = { ...active, id: `item-${Date.now()}`, name: `${active.name} Copy` };
    setActive(item);
    commitCatalog({ items: [item, ...catalogRef.current.items] });
    showToast("Menu item duplicated.");
  };

  const moveItemToTrash = () => {
    const nextItems = catalogRef.current.items.filter((item) => item.id !== active.id);
    const nextTrash = [active, ...catalogRef.current.trashItems].slice(0, 20);
    setActive(nextItems[0] || defaultMenu[0]);
    setPhotoPreview("");
    commitCatalog({ items: nextItems, trashItems: nextTrash });
    showToast("Menu item moved to Trash.");
  };

  const restoreMenuItem = (id: string) => {
    const found = catalogRef.current.trashItems.find((item) => item.id === id);
    if (!found) return;
    const restored = { ...found, id: `item-${Date.now()}` };
    setActive(restored);
    commitCatalog({ items: [restored, ...catalogRef.current.items], trashItems: catalogRef.current.trashItems.filter((item) => item.id !== id) });
    showToast("Menu item restored.");
  };

  const deleteMenuPermanently = (id: string) => {
    commitCatalog({ trashItems: catalogRef.current.trashItems.filter((item) => item.id !== id) });
    showToast("Menu item permanently deleted.");
  };

  const saveSettings = (patch: Partial<SiteSettings>) => commitCatalog({ settings: { ...catalogRef.current.settings, ...patch } });

  const updateVideoLink = (index: number, value: string) => {
    const next = [...settings.youtubeLinks];
    next[index] = normalizeYoutube(value);
    saveSettings({ youtubeLinks: next });
  };
  const addVideoLink = () => saveSettings({ youtubeLinks: [...settings.youtubeLinks, ""] });
  const removeVideoLink = (index: number) => saveSettings({ youtubeLinks: settings.youtubeLinks.filter((_, current) => current !== index) });

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) { showToast("Choose an image smaller than 8 MB."); return; }
    setImageNote("Optimizing image...");
    try {
      const optimized = await compressImage(file);
      setPhotoPreview(optimized);
      setImageNote("Preview ready. Approve it to publish the photo.");
    } catch {
      setImageNote("");
      showToast("The image could not be processed.");
    }
  };

  const approveImage = () => {
    if (!photoPreview) return;
    updateActive({ image: photoPreview });
    setPhotoPreview("");
    setImageNote("Photo saved.");
  };

  const toggleAlerts = async () => {
    if (alertsEnabled) {
      setAlertsEnabled(false);
      window.localStorage.setItem(ALERTS_PREF_KEY, "0");
      showToast("Order alerts disabled.");
      return;
    }
    if (typeof Notification !== "undefined") {
      const result = await Notification.requestPermission();
      setNotifStatus(result);
    } else {
      setNotifStatus("Unsupported");
    }
    setAlertsEnabled(true);
    window.localStorage.setItem(ALERTS_PREF_KEY, "1");
    showToast("Order alerts enabled.");
  };

  const updateOrder = async (id: string, action: "status" | "restore" | "delete" | "undo", status?: OrderStatus, tab?: OrderTab, message?: string) => {
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Order could not be updated.");
      if (Array.isArray(result.orders)) setOrders(result.orders);
      if (Array.isArray(result.menu)) {
        commitCatalog({ items: result.menu });
        const current = result.menu.find((item: MenuItem) => item.id === active.id);
        if (current) setActive(current);
      }
      if (tab) setOrderTab(tab);
      showToast(message || `Order ${id} updated.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Order could not be updated.");
    }
  };

  const statusToTab: Record<OrderStatus, OrderTab> = {
    pending: "new", accepted: "accepted", ready: "ready", "sent-to-rider": "dispatched", completed: "completed", rejected: "rejected", deleted: "trash",
  };
  const undoOrder = (order: Order) => {
    if (!order.previousStatus) return;
    void updateOrder(order.id, "undo", undefined, statusToTab[order.previousStatus], `Order ${order.id} reverted to ${order.previousStatus === "pending" ? "new" : order.previousStatus}.`);
  };

  const runConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.kind === "menu-delete") moveItemToTrash();
    if (confirmAction.kind === "menu-permanent") deleteMenuPermanently(confirmAction.id);
    if (confirmAction.kind === "order-trash") void updateOrder(confirmAction.id, "status", "deleted", "trash");
    if (confirmAction.kind === "order-permanent") void updateOrder(confirmAction.id, "delete", undefined, "trash");
    setConfirmAction(null);
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setAuthorized(false);
  };

  const undoButton = (order: Order) => order.previousStatus ? <button className="soft-danger" onClick={() => undoOrder(order)}><RotateCcw size={15}/>Undo</button> : null;

  const orderActions = (order: Order) => {
    if (order.status === "pending") return <><button onClick={() => void updateOrder(order.id, "status", "accepted", "accepted")}><Check size={15}/>Accept</button><button onClick={() => void updateOrder(order.id, "status", "rejected", "rejected")}><X size={15}/>Reject</button><button className="soft-danger" onClick={() => setConfirmAction({ kind: "order-trash", id: order.id })}><Trash2 size={15}/>Trash</button>{undoButton(order)}</>;
    if (order.status === "accepted") return <><button onClick={() => void updateOrder(order.id, "status", "ready", "ready")}>Mark ready</button><button onClick={() => void updateOrder(order.id, "status", "rejected", "rejected")}><X size={15}/>Reject</button><button className="soft-danger" onClick={() => setConfirmAction({ kind: "order-trash", id: order.id })}><Trash2 size={15}/>Trash</button>{undoButton(order)}</>;
    if (order.status === "ready") return <><button onClick={() => void updateOrder(order.id, "status", "sent-to-rider", "dispatched")}><Send size={15}/>Mark dispatched</button><button onClick={() => void updateOrder(order.id, "status", "completed", "completed")}><Check size={15}/>Completed</button><button className="soft-danger" onClick={() => setConfirmAction({ kind: "order-trash", id: order.id })}><Trash2 size={15}/>Trash</button>{undoButton(order)}</>;
    if (order.status === "sent-to-rider") return <><button onClick={() => void updateOrder(order.id, "status", "completed", "completed")}><Check size={15}/>Completed</button><button className="soft-danger" onClick={() => setConfirmAction({ kind: "order-trash", id: order.id })}><Trash2 size={15}/>Trash</button>{undoButton(order)}</>;
    if (order.status === "deleted") return <><button onClick={() => void updateOrder(order.id, "restore", undefined, "new")}>Restore</button><button className="danger" onClick={() => setConfirmAction({ kind: "order-permanent", id: order.id })}><Trash2 size={15}/>Delete forever</button></>;
    return <><button className="soft-danger" onClick={() => setConfirmAction({ kind: "order-trash", id: order.id })}><Trash2 size={15}/>Trash</button>{undoButton(order)}</>;
  };

  return <main className="admin-page admin-premium admin-flow-v2">
    <header className="admin-header">
      <div><span className="eyebrow">Restaurant dashboard</span><h1>Kebabest owner control panel</h1><p>Manage WhatsApp orders, preparation status, menu, photos, stock and restaurant information.</p></div>
      <div className="admin-header-actions"><span className={`admin-save-state ${saveState === "Save failed" ? "failed" : ""}`}>{saveState}</span><a href="/">View site</a><button onClick={logout}><LogOut size={16}/>Logout</button></div>
    </header>

    <section className="admin-flow-strip" aria-label="Order workflow">
      <div><b>1</b><span>WhatsApp order</span></div><div><b>2</b><span>Accept & prepare</span></div><div><b>3</b><span>Ready</span></div><div><b>4</b><span>Dispatch / complete</span></div>
    </section>

    <section className="admin-stats compact-stats">
      <div><Bell/><span>Notifications</span><strong>{alertsEnabled ? "On" : "Off"}</strong><button onClick={toggleAlerts}>{alertsEnabled ? "Disable alerts" : "Enable alerts"}</button></div>
      <div><Clock/><span>New orders</span><strong>{stats.newOrders}</strong></div>
      <div><Eye/><span>Accepted value</span><strong>₹{stats.total}</strong></div>
      <div><Lock/><span>Low stock / Trash</span><strong>{stats.lowStock} / {stats.trash}</strong></div>
    </section>

    <section className="orders-panel order-workspace">
      <div className="section-head admin-section-head"><div><span className="eyebrow">Orders</span><h2>Order workflow</h2></div><p className="admin-note inline-note"><MessageCircle size={16}/> New orders refresh automatically. Confirm details with the customer in WhatsApp before preparation.</p></div>
      <div className="order-tabs">{orderTabs.map((tab) => <button key={tab.key} className={orderTab === tab.key ? "active" : ""} onClick={() => setOrderTab(tab.key)}>{tab.label}<span>{tab.count}</span></button>)}</div>
      {filteredOrders.length === 0 ? <p className="empty order-empty">No orders in this section.</p> : <div className="order-list-grid">{filteredOrders.map((order) => <article className="order-card" key={order.id}>
        <div className="order-card-head"><div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></div><span className={`status ${order.status}`}>{order.status === "sent-to-rider" ? "dispatched" : order.status}</span></div>
        <p><b>{order.customer.name}</b> · {order.customer.phone}<br/>{order.customer.address}<br/><small>{order.orderChannel} order</small>{order.customer.note && <><br/><small>Note: {order.customer.note}</small></>}</p>
        <ul>{order.items.map((item) => <li key={`${order.id}-${item.id}`}>{item.qty} × {item.name} <span>₹{item.price * item.qty}</span></li>)}</ul>
        <div className="order-total-breakdown"><span>Subtotal ₹{order.subtotal}</span><span>GST ₹{order.gst}</span><span>Delivery ₹{order.deliveryFee}</span></div>
        <div className="order-actions"><strong>₹{order.total}</strong>{orderActions(order)}</div>
      </article>)}</div>}
    </section>

    <section className="admin-master-grid">
      <section className="menu-manager-card">
        <div className="section-head admin-section-head"><div><span className="eyebrow">Menu management</span><h2>Items, photos & stock</h2></div><button className="add-new inline-add" onClick={addNew}><Plus size={16}/> Add item</button></div>
        <div className="menu-manager-layout">
          <aside className="admin-list menu-list-v2">{items.map((item) => <button className={active.id === item.id ? "selected" : ""} key={item.id} onClick={() => { setActive(item); setPhotoPreview(""); setImageNote(""); }}><span>{item.name}</span><small>{item.category} · ₹{item.price} · stock {item.stock ?? 0} · {item.available ? "Available" : "Off"}</small></button>)}</aside>
          <form className="editor item-editor-v2" onSubmit={(event) => event.preventDefault()}>
            <div className="editor-toolbar"><button type="button" onClick={duplicateItem}><Copy size={15}/>Duplicate</button><button type="button" className="danger" onClick={() => setConfirmAction({ kind: "menu-delete" })}><Trash2 size={15}/>Move to Trash</button></div>
            <div className="editor-grid two"><label>Name<input value={active.name} onChange={(event) => updateActive({ name: event.target.value })}/></label><label>Category<select value={active.category} onChange={(event) => updateActive({ category: event.target.value })}>{categories.filter((category) => category !== "All").map((category) => <option key={category}>{category}</option>)}</select></label></div>
            <div className="editor-grid two"><label>Price ₹<input type="number" min="0" value={active.price} onChange={(event) => updateActive({ price: Number(event.target.value) })}/></label><label>Stock / quantity<input type="number" min="0" value={active.stock ?? 0} onChange={(event) => updateActive({ stock: Number(event.target.value), available: Number(event.target.value) > 0 })}/></label></div>
            <label>Description<textarea value={active.description} onChange={(event) => updateActive({ description: event.target.value })}/></label>
            <div className="switch-row"><label><input type="radio" checked={active.type === "veg"} onChange={() => updateActive({ type: "veg" })}/> Veg</label><label><input type="radio" checked={active.type === "nonveg"} onChange={() => updateActive({ type: "nonveg" })}/> Non-veg</label><label><input type="checkbox" checked={active.available} onChange={(event) => updateActive({ available: event.target.checked })}/> Available</label><label><input type="checkbox" checked={Boolean(active.popular)} onChange={(event) => updateActive({ popular: event.target.checked })}/> Popular</label></div>
            <div className="image-uploader"><label className="upload-box"><Upload size={18}/><span>{active.image || photoPreview ? "Change photo" : "Add photo"}</span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload menu photo" onChange={handleImage}/></label>{imageNote && <p className="admin-note">{imageNote}</p>}{photoPreview && <div className="photo-preview"><img src={photoPreview} alt="Preview"/><button type="button" onClick={approveImage}><Save size={15}/>Approve & save image</button></div>}{active.image && !photoPreview && <div className="photo-preview"><img src={active.image} alt={active.name}/><button type="button" onClick={() => updateActive({ image: "" })}>Remove image</button></div>}</div>
            <div className="admin-menu-card-preview"><span>Website card preview</span><article className="card admin-preview-card">{active.image && <div className="dish-image"><img src={active.image} alt="" /></div>}<div className="card-top"><span className={`food-mark ${active.type}`}><span /></span>{active.popular && <span className="tag">Popular</span>}</div><h3>{active.name}</h3><p>{active.description}</p><div className="stock-line">{active.available ? "Available" : "Unavailable"}</div><div className="card-bottom"><strong>₹{active.price}</strong><button type="button">+ Add</button></div></article></div>
          </form>
        </div>
        {trashItems.length > 0 && <div className="trash-bin"><h3>Menu Trash <small>latest 20</small></h3>{trashItems.map((item) => <div className="trash-row" key={item.id}><span>{item.name}</span><div><button onClick={() => restoreMenuItem(item.id)}>Restore</button><button className="danger" onClick={() => setConfirmAction({ kind: "menu-permanent", id: item.id })}>Delete forever</button></div></div>)}</div>}
      </section>

      <section className="settings-panel settings-v2">
        <span className="eyebrow">Website settings</span><h2>Restaurant & ordering</h2>
        <div className="settings-group"><h3>Basic information</h3><label>Restaurant name<input value={settings.restaurantName} onChange={(event) => saveSettings({ restaurantName: event.target.value })}/></label><label>Public phone<input value={settings.phone} onChange={(event) => saveSettings({ phone: event.target.value })}/></label><label>WhatsApp number with country code<input inputMode="tel" value={settings.whatsappNumber} onChange={(event) => saveSettings({ whatsappNumber: event.target.value })}/></label><label>Address<textarea value={settings.address} onChange={(event) => saveSettings({ address: event.target.value })}/></label><div className="editor-grid two"><label>Hours<input value={settings.hours} onChange={(event) => saveSettings({ hours: event.target.value })}/></label><label>Open label<input value={settings.openLabel} onChange={(event) => saveSettings({ openLabel: event.target.value })}/></label></div></div>
        <div className="settings-group"><h3>Order totals</h3><div className="editor-grid two"><label>GST %<input type="number" min="0" value={settings.gstPercent} onChange={(event) => saveSettings({ gstPercent: Number(event.target.value) })}/></label><label>Delivery estimate ₹<input type="number" min="0" value={settings.deliveryFee} onChange={(event) => saveSettings({ deliveryFee: Number(event.target.value) })}/></label></div><label>WhatsApp order note<textarea value={settings.orderNote} onChange={(event) => saveSettings({ orderNote: event.target.value })}/></label></div>
        <div className="settings-group"><h3>Delivery information</h3><label>Delivery mode<input value={settings.deliveryMode} onChange={(event) => saveSettings({ deliveryMode: event.target.value })}/></label><label>Delivery note<textarea value={settings.deliveryNote} onChange={(event) => saveSettings({ deliveryNote: event.target.value })}/></label></div>
        <div className="settings-group"><h3>YouTube / media links</h3><div className="video-link-list">{settings.youtubeLinks.map((link, index) => <div className="video-link-row" key={index}><input placeholder={`YouTube video ${index + 1}`} value={link} onChange={(event) => updateVideoLink(index, event.target.value)}/><button type="button" onClick={() => removeVideoLink(index)}>Remove</button></div>)}</div><button className="add-video" type="button" onClick={addVideoLink}><Plus size={15}/>Add video link</button></div>
      </section>
    </section>

    {confirmAction && <div className="confirm-backdrop" role="dialog" aria-modal="true"><div className="confirm-modal"><h3>Are you sure?</h3><p>{confirmAction.kind.includes("permanent") ? "This permanently deletes the record and cannot be restored." : "This moves the record to Trash. You can restore it later."}</p><div><button onClick={() => setConfirmAction(null)}>Cancel</button><button className="danger" onClick={runConfirm}>Yes, continue</button></div></div></div>}
    {toast && <div className="toast-pop admin-toast">{toast}</div>}
  </main>;
}
