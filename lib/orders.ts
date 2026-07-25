export type OrderStatus = "pending" | "accepted" | "rejected" | "ready" | "sent-to-rider" | "completed" | "deleted";

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  type: "veg" | "nonveg";
};

export type CustomerInfo = {
  name: string;
  phone: string;
  address: string;
  note?: string;
};

export type Order = {
  id: string;
  createdAt: string;
  customer: CustomerInfo;
  items: OrderItem[];
  subtotal: number;
  gst: number;
  deliveryFee: number;
  total: number;
  orderChannel: "WhatsApp";
  status: OrderStatus;
  whatsappOpenedAt?: string;
  stockCommitted?: boolean;
  deletedAt?: string;
  previousStatus?: OrderStatus;
};
