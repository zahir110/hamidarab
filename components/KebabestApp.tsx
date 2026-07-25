"use client";

import { useEffect, useMemo, useState } from "react";
import { Bike, CheckCircle2, ChevronRight, Clock, Instagram, MapPin, Menu as MenuIcon, MessageCircle, Minus, Phone, Plus, Search, ShoppingBag, Utensils, X } from "lucide-react";
import { categories, defaultMenu, defaultSiteSettings, type MenuItem, type SiteSettings } from "@/lib/menu";
import type { Order, OrderStatus } from "@/lib/orders";

const TRACKED_ORDER_KEY = "kebabest_last_order_id";

type OrderStatusResponse = { id: string; status: OrderStatus; createdAt: string; total: number; itemCount: number };

const STATUS_COPY: Record<OrderStatus, { label: string; detail: string }> = {
  pending: { label: "Waiting for confirmation", detail: "The restaurant is reviewing your order. This will update once they confirm availability and the final total." },
  accepted: { label: "Order confirmed", detail: "Good news — the restaurant accepted your order and is preparing it now." },
  ready: { label: "Ready", detail: "Your order is ready at the restaurant." },
  "sent-to-rider": { label: "Out for delivery", detail: "Your order is on its way to you." },
  completed: { label: "Completed", detail: "This order is complete. Thank you for ordering with us!" },
  rejected: { label: "Not accepted", detail: "The restaurant was unable to accept this order. Please call them for details." },
  deleted: { label: "Unavailable", detail: "We could not find this order. Please call the restaurant." },
};

function Indicator({ type }: { type: "veg" | "nonveg" }) {
  return <span className={`food-mark ${type}`} aria-label={type === "veg" ? "Veg" : "Non veg"}><span /></span>;
}

const menuCategoryHotspots = [
  { label: "Rolls", cls: "cat-1" }, { label: "Burgers", cls: "cat-2" }, { label: "Fries", cls: "cat-3" }, { label: "Shawarma", cls: "cat-4" },
  { label: "Hot Beverages", cls: "cat-5" }, { label: "Cold Beverages", cls: "cat-6" }, { label: "Desserts", cls: "cat-7" }, { label: "Others", cls: "cat-8" },
];

const mobileCategoryItems = [
  { label: "Rolls", img: "/images/cat-rolls-icon.png" }, { label: "Burgers", img: "/images/cat-burgers-icon.png" }, { label: "Fries", img: "/images/cat-fries-icon.png" }, { label: "Shawarma", img: "/images/cat-shawarma-icon.png" },
  { label: "Hot Beverages", img: "/images/cat-hot-icon.png" }, { label: "Cold Beverages", img: "/images/cat-cold-icon.png" }, { label: "Desserts", img: "/images/cat-desserts-icon.png" }, { label: "Others", img: "/images/cat-others-icon.png" },
];

function whatsappNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

function orderMessage(order: Order, restaurantName: string): string {
  const itemLines = order.items.map((item) => `• ${item.qty} × ${item.name} — ₹${item.price * item.qty}`).join("\n");
  return [
    `New order for ${restaurantName}`,
    `Order: ${order.id}`,
    "",
    `Name: ${order.customer.name}`,
    `Mobile: ${order.customer.phone}`,
    `Address: ${order.customer.address}`,
    order.customer.note ? `Note: ${order.customer.note}` : "",
    "",
    "Items:",
    itemLines,
    "",
    `Subtotal: ₹${order.subtotal}`,
    `GST: ₹${order.gst}`,
    `Delivery: ₹${order.deliveryFee}`,
    `Estimated total: ₹${order.total}`,
    "",
    "Please confirm availability, final total and delivery time.",
  ].filter(Boolean).join("\n");
}

export default function KebabestApp() {
  const [active, setActive] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [menu, setMenu] = useState<MenuItem[]>(defaultMenu);
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", note: "" });
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3600); };

  useEffect(() => {
    const stored = window.localStorage.getItem(TRACKED_ORDER_KEY);
    if (stored) setTrackedOrderId(stored);
  }, []);

  const fetchOrderStatus = async (id: string) => {
    setStatusLoading(true);
    setStatusError("");
    try {
      const response = await fetch(`/api/public/order-status?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Order status is unavailable right now.");
      setOrderStatus(result as OrderStatusResponse);
    } catch (error) {
      setOrderStatus(null);
      setStatusError(error instanceof Error ? error.message : "Order status is unavailable right now.");
    } finally {
      setStatusLoading(false);
    }
  };

  const openStatusModal = () => {
    if (!trackedOrderId) return;
    setStatusModalOpen(true);
    void fetchOrderStatus(trackedOrderId);
  };

  useEffect(() => {
    if (!statusModalOpen || !trackedOrderId) return;
    const timer = window.setInterval(() => void fetchOrderStatus(trackedOrderId), 15_000);
    return () => window.clearInterval(timer);
  }, [statusModalOpen, trackedOrderId]);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    if (!isMobile || !menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/catalog", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json();
      })
      .then((data: { menu?: MenuItem[]; settings?: SiteSettings }) => {
        if (Array.isArray(data.menu) && data.menu.length) setMenu(data.menu);
        if (data.settings) setSettings({ ...defaultSiteSettings, ...data.settings });
      })
      .catch((error) => {
        if (error?.name !== "AbortError") showToast("Menu loaded from the restaurant backup. You can still order on WhatsApp.");
      });
    return () => controller.abort();
  }, []);

  const visibleMenu = useMemo(() => menu.map((item) => ({ ...item, available: item.available && (item.stock ?? 1) > 0 })), [menu]);
  const items = useMemo(() => visibleMenu.filter((item) => {
    const cat = active === "All" || item.category === active;
    const q = !query || item.name.toLowerCase().includes(query.toLowerCase()) || item.description.toLowerCase().includes(query.toLowerCase());
    return cat && q;
  }), [active, query, visibleMenu]);

  const cartRows = visibleMenu.filter((item) => cart[item.id]);
  const subtotal = cartRows.reduce((sum, item) => sum + item.price * (cart[item.id] || 0), 0);
  const gst = subtotal ? Math.round((subtotal * (settings.gstPercent || 0)) / 100) : 0;
  const deliveryFee = subtotal ? Number(settings.deliveryFee || 0) : 0;
  const total = subtotal + gst + deliveryFee;

  const add = (id: string) => {
    const item = visibleMenu.find((row) => row.id === id);
    if (!item?.available) { showToast("This item is currently unavailable."); return; }
    setCart((old) => {
      const nextQty = (old[id] || 0) + 1;
      if (item.stock && nextQty > item.stock) { showToast("Stock limit reached for this item."); return old; }
      return { ...old, [id]: nextQty };
    });
  };
  const remove = (id: string) => setCart((old) => ({ ...old, [id]: Math.max(0, (old[id] || 0) - 1) }));

  const openFullMenu = () => {
    setActive("All");
    setMenuOpen(true);
    if (window.matchMedia("(min-width: 761px)").matches) {
      window.setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  };

  const openCart = () => {
    setMenuOpen(true);
    window.setTimeout(() => document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  const handleCompleteOrder = () => {
    if (trackedOrderId) { openStatusModal(); return; }
    showToast("Please add your dishes and place your order first.");
    openCart();
  };

  const openCategory = (category: string) => {
    setActive(category);
    setMenuOpen(true);
    window.setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const placeOrder = async () => {
    if (!subtotal) { showToast("Add at least one item first."); return; }
    if (!customer.name || !customer.phone || !customer.address) { showToast("Enter your name, mobile number and delivery address."); return; }
    const waNumber = whatsappNumber(settings.whatsappNumber || settings.phone);
    if (!waNumber) { showToast("WhatsApp ordering is not configured. Please call the restaurant."); return; }

    setSubmitting(true);
    const whatsappWindow = window.open("about:blank", "_blank");
    const requestItems = cartRows.map((item) => ({ id: item.id, qty: cart[item.id] || 0 }));
    let order: Order;
    let savedToDashboard = true;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, items: requestItems }),
      });
      const result = await response.json();
      if (!response.ok || !result.order) throw new Error(result.error || "Order could not be saved");
      order = result.order as Order;
    } catch {
      savedToDashboard = false;
      order = {
        id: `KB-${Date.now().toString(36).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        customer,
        items: cartRows.map((item) => ({ id: item.id, name: item.name, price: item.price, qty: cart[item.id] || 0, type: item.type })),
        subtotal,
        gst,
        deliveryFee,
        total,
        orderChannel: "WhatsApp",
        status: "pending",
        whatsappOpenedAt: new Date().toISOString(),
      };
    }

    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(orderMessage(order, settings.restaurantName))}`;
    if (whatsappWindow) whatsappWindow.location.href = url;
    else window.location.href = url;

    setLastOrder(order);
    setCart({});
    setCustomer({ name: "", phone: "", address: "", note: "" });
    setSubmitting(false);
    window.localStorage.setItem(TRACKED_ORDER_KEY, order.id);
    setTrackedOrderId(order.id);
    showToast(savedToDashboard ? "WhatsApp opened. Review the order and tap Send." : "WhatsApp opened. The restaurant will receive the order when you tap Send.");
  };

  const tel = settings.phone.replace(/\D/g, "");
  const directWhatsApp = whatsappNumber(settings.whatsappNumber || settings.phone);
  const videoLinks = settings.youtubeLinks.map((link) => link.trim()).filter(Boolean);
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  return (
    <main className={`${menuOpen ? "site-shell menu-is-open" : "site-shell"}${navOpen ? " nav-is-open" : ""}`}>
      <section className="hero-shell" id="home">
        <picture className="hero-picture">
          <source media="(max-width: 760px)" srcSet="/images/hero-mobile-composite.jpg" />
          <img className="hero-img-layer" src="/images/hero1-kababest.png" alt="Iranian kabab with saffron rice and grilled vegetables" />
        </picture>
        <nav className="navbar">
          <a className="brand-mini" href="#home">{settings.restaurantName.toUpperCase()}</a>
          <div className="nav-links"><a href="#home">Home</a><a href="#menu">Menu</a><a href="#order">Order</a><a href="#offers">Offers</a><a href="#about">About Us</a><a href="#contact">Contact</a></div>
          <a className="phone-pill" href={`tel:${tel}`}><Phone size={18} /> {settings.phone}</a>
          <a className="instagram-link" href="https://www.instagram.com/kebabest.in?igsh=ejN2Y2VhcDlpaGEz" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
          <button className="round-menu" aria-label="Open site menu" aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}><MenuIcon size={22} /></button>
          <div className={`site-drawer ${navOpen ? "open" : ""}`}>
            <a onClick={() => setNavOpen(false)} href="#home">Home</a><a onClick={(event) => { event.preventDefault(); setNavOpen(false); openFullMenu(); }} href="#menu">Menu</a><a onClick={() => setNavOpen(false)} href="#order">Order</a><a onClick={() => setNavOpen(false)} href="#offers">Offers</a><a onClick={() => setNavOpen(false)} href="#about">About Us</a><a onClick={() => setNavOpen(false)} href="#contact">Contact</a><a onClick={() => setNavOpen(false)} href="https://www.instagram.com/kebabest.in?igsh=ejN2Y2VhcDlpaGEz" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={16} /> Instagram</a>
          </div>
        </nav>
        <div className="authentic-badge" aria-label="Authentic Iranian flavors"><span>AUTHENTIC</span><strong>IRANIAN</strong><span>FLAVORS</span></div>
        <div className="hero-overlay-actions"><a className="gold-btn" href="#order"><MessageCircle size={19} /> Order on WhatsApp <ChevronRight size={18}/></a><a className="ghost-btn" href="#menu" onClick={() => setMenuOpen(true)}>View Menu <ChevronRight size={18}/></a></div>
        <div className="mobile-hero-copy"><span>Iranian–Indian Restaurant</span><h1>Fresh kabab, made for your table.</h1><p>Choose your dishes and send the complete order directly to the restaurant on WhatsApp.</p></div>
      </section>

      <section className="under-hero-built" id="contact" aria-label="Restaurant information and food categories">
        <button className="mobile-door-card" onClick={openFullMenu} aria-label="Open the menu from the Persian door card">
          <div className="mobile-door-copy">
            <span className="eyebrow">Our menu awaits you</span>
            <h2>Open the Persian door</h2>
            <p>Tap the door to explore current dishes, prices and availability.</p>
          </div>
          <div className="mobile-door-visual">
            <img src="/images/persian-door-classic.png" alt="Traditional Persian doorway leading to the restaurant menu" />
            <span className="door-overlay-pill"><strong>Open Menu</strong><small>Tap the door</small></span>
          </div>
        </button>
        <div className="contact-ribbon"><div className="ribbon-item"><MapPin /><p>{settings.address}</p></div><a className="ribbon-item phone" href={`tel:${tel}`} aria-label="Call restaurant"><Phone /><strong>{settings.phone}</strong></a><div className="ribbon-item"><Clock /><p><strong>{settings.hours}</strong><br/>{settings.openLabel}</p></div></div>
        <section className="mobile-favorites" aria-label="Handpicked favorites">
          <div className="mobile-favorites-head"><span>Handpicked favorites</span><h2>From Our Menu</h2></div>
          <div className="mobile-favorites-row">{visibleMenu.filter((item) => item.popular).slice(0, 3).map((item) => <article key={`favorite-${item.id}`}><img src={item.image || "/images/promo-chelo-clean.jpg"} alt={item.name}/><div><strong>{item.name}</strong><span>₹{item.price}</span></div><button type="button" onClick={() => add(item.id)} aria-label={`Add ${item.name}`}><Plus size={15}/></button></article>)}</div>
        </section>
        <div className="category-art-strip" aria-label="Food categories"><img src="/images/category-strip-clean.jpg" alt="Food categories" />{menuCategoryHotspots.map(({ label, cls }) => <button key={label} className={`category-hotspot ${cls}`} onClick={() => openCategory(label)} aria-label={`Open ${label} menu`} />)}</div>
        <div className="mobile-category-grid" aria-label="Food categories">{mobileCategoryItems.map(({ label, img }) => <button key={label} onClick={() => openCategory(label)} aria-label={`Open ${label} menu`}><img src={img} alt="" /><span>{label}</span></button>)}</div>
        <div className="promo-art-grid" id="offers"><button className="promo-art-card promo-chelo" onClick={() => openCategory("Kebabs")} aria-label="Open Chelo Kebab menu" /><a className="promo-art-card promo-delivery" href="#order" aria-label="Order from Kebabest" /><div className="promo-art-card promo-hours" aria-label="Restaurant opening hours" /></div>
      </section>

      <section className={`content-grid polished-menu-zone ${menuOpen ? "open" : "closed"}`} id="menu">
        <div className="mobile-menu-bar"><div><span>Our Menu</span><small>Choose dishes and add them to your order</small></div><button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={24}/></button></div>
        <div className={`menu-panel ${menuOpen ? "is-open" : "is-closed"}`}>
          <div className="persian-door-stage">
            <div className="door-copy"><span className="eyebrow">Restaurant menu</span><h2>Choose from {settings.restaurantName}</h2><p>Open the Persian gate to browse current dishes, prices and availability.</p></div>
            <button className={`css-persian-door ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="menu-drawer"><span className="door-scene" aria-hidden="true" /><span className="door-leaf left" aria-hidden="true" /><span className="door-leaf right" aria-hidden="true" /><span className="door-label"><strong>{menuOpen ? "Menu Open" : "Open Menu"}</strong><small>Tap the door</small></span></button>
          </div>

          <div id="menu-drawer" className={`menu-reveal ${menuOpen ? "show" : ""}`} aria-hidden={!menuOpen}>
            <div className="section-head compact-menu-head"><div><span className="eyebrow">Choose dishes</span><h2>Food menu</h2></div><div className="search"><Search size={18}/><input aria-label="Search menu" placeholder="Search kabab, roll, rice..." value={query} onChange={(e)=>setQuery(e.target.value)} /></div></div>
            <label className="mobile-category-select">Category<select value={active} onChange={(event) => setActive(event.target.value)}>{categories.map((cat) => <option key={cat}>{cat}</option>)}</select></label>
            <div className="tabs">{categories.map((cat) => <button key={cat} className={active === cat ? "active" : ""} onClick={() => setActive(cat)}>{cat}</button>)}</div>
            <div className="menu-grid">
              {items.map((item) => <article className={!item.available ? "card disabled" : "card"} key={item.id}>
                {item.image && <div className="dish-image"><img src={item.image} alt={item.name} /></div>}
                <div className="card-top"><Indicator type={item.type}/>{item.popular && <span className="tag">Popular</span>}</div>
                <h3>{item.name}</h3><p>{item.description}</p>
                <div className="stock-line">{item.available ? "Available today" : "Currently unavailable"}</div>
                <div className="card-bottom"><strong>₹{item.price}</strong>{item.available ? <button onClick={() => add(item.id)}><Plus size={16}/> Add</button> : <em>Unavailable</em>}</div>
              </article>)}
            </div>
          </div>
        </div>

        <aside className="order-panel" id="order">
          <div className="order-title"><Utensils /><div><span className="eyebrow">WhatsApp order</span><h2>Your order</h2></div></div>
          <p className="checkout-intro">Add dishes and your contact details. The complete order will open in WhatsApp for confirmation with the restaurant.</p>
          {cartRows.length === 0 ? <p className="empty">Add dishes to start an order.</p> : cartRows.map((item) => <div className="cart-row" key={item.id}><span>{item.name}<small>₹{item.price} × {cart[item.id]}</small></span><div><button aria-label={`Remove ${item.name}`} onClick={()=>remove(item.id)}><Minus size={14}/></button><b>{cart[item.id]}</b><button aria-label={`Add ${item.name}`} onClick={()=>add(item.id)}><Plus size={14}/></button></div></div>)}
          <div className="bill-lines"><p><span>Subtotal</span><strong>₹{subtotal}</strong></p><p><span>GST {settings.gstPercent}%</span><strong>₹{gst}</strong></p><p><span>Delivery estimate</span><strong>₹{deliveryFee}</strong></p></div>
          <div className="total"><span>Estimated total</span><strong>₹{total}</strong></div>
          <div className="customer-form"><input autoComplete="name" placeholder="Customer name" value={customer.name} onChange={(e)=>setCustomer({...customer, name:e.target.value})}/><input autoComplete="tel" inputMode="tel" placeholder="Mobile number" value={customer.phone} onChange={(e)=>setCustomer({...customer, phone:e.target.value})}/><textarea autoComplete="street-address" placeholder="Delivery address" value={customer.address} onChange={(e)=>setCustomer({...customer, address:e.target.value})}/><textarea placeholder="Order note: less spicy, extra sauce, pickup instruction..." value={customer.note} onChange={(e)=>setCustomer({...customer, note:e.target.value})}/></div>
          <div className="qr-box whatsapp-order-note"><MessageCircle size={22}/><span>No online payment</span><small>{settings.orderNote}</small></div>
          <button className="checkout whatsapp-checkout" disabled={!subtotal || !customer.name || !customer.phone || !customer.address || submitting} onClick={placeOrder}><MessageCircle size={18}/>{submitting ? "Preparing order..." : "Send order on WhatsApp"}</button>
          {lastOrder && <p className="success"><CheckCircle2 size={16}/> Order {lastOrder.id} is ready in WhatsApp. Tap Send there to contact the restaurant.</p>}
          {trackedOrderId && <div className="order-status-track"><p>{lastOrder ? "Waiting for the restaurant to confirm your order." : "Already placed an order? Check where it stands."}</p><button type="button" className="see-status-btn" onClick={openStatusModal}><Clock size={16}/> See order status</button></div>}
          <p className="delivery-note"><Bike size={16}/> {settings.deliveryNote}<br/><small>{settings.deliveryMode}</small></p>
        </aside>
      </section>

      {videoLinks.length > 0 && <section className="video-section" id="videos" aria-label="Restaurant video highlights"><div className="video-head"><span className="eyebrow">Video highlights</span><h2>{settings.restaurantName} stories</h2><p>Food, restaurant ambience and updates from the restaurant.</p></div><div className="video-grid">{videoLinks.map((link, idx) => <article className="video-card" key={`${link}-${idx}`}><iframe src={link.replace("watch?v=", "embed/")} title={`${settings.restaurantName} video ${idx+1}`} allowFullScreen /><h3>{["Grill Story", "Restaurant Ambience", "Our Food"][idx] || "Restaurant Video"}</h3></article>)}</div></section>}

      <section className="about" id="about"><div><span className="eyebrow">About {settings.restaurantName}</span><h2>Iranian flavors in Pune</h2><p>Browse the menu, choose your dishes and send the complete order directly to the restaurant. The team confirms availability, price and delivery time on WhatsApp.</p></div><img src="/images/kebabest-signage.jpeg" alt="Kebabest restaurant signage" /></section>

      <nav className="mobile-bottom-dock" aria-label="Quick mobile actions">
        <a href={`tel:${tel}`} aria-label="Call restaurant"><Phone size={20}/><span>Call</span></a>
        <button type="button" onClick={openCart} aria-label="Go to cart"><ShoppingBag size={20}/><span>Cart</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
        <button type="button" className="dock-whatsapp" onClick={handleCompleteOrder} aria-label="Complete the order"><MessageCircle size={24}/><span>Complete the order</span></button>
      </nav>

      {directWhatsApp && <a className="floating-whatsapp" href={`https://wa.me/${directWhatsApp}`} target="_blank" rel="noreferrer" aria-label="Chat with the restaurant on WhatsApp"><MessageCircle size={23}/></a>}
      {toast && <div className="toast-pop customer-toast">{toast}</div>}

      {statusModalOpen && <div className="confirm-backdrop order-status-backdrop" role="dialog" aria-modal="true" onClick={() => setStatusModalOpen(false)}>
        <div className="confirm-modal order-status-modal" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="status-modal-close" aria-label="Close" onClick={() => setStatusModalOpen(false)}><X size={18}/></button>
          <h3>Order status</h3>
          {trackedOrderId && <p className="status-order-id">Order {trackedOrderId}</p>}
          {statusError && <p className="status-error">{statusError}</p>}
          {orderStatus && !statusError && <>
            <div className={`status-badge-big status-${orderStatus.status}`}>{STATUS_COPY[orderStatus.status].label}</div>
            <p>{STATUS_COPY[orderStatus.status].detail}</p>
          </>}
          {statusLoading && !orderStatus && !statusError && <p>Checking with the restaurant...</p>}
          <button type="button" className="status-refresh" disabled={statusLoading} onClick={() => trackedOrderId && fetchOrderStatus(trackedOrderId)}>{statusLoading ? "Checking..." : "Refresh status"}</button>
        </div>
      </div>}
    </main>
  );
}
