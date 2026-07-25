export type FoodType = "veg" | "nonveg";

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  type: FoodType;
  available: boolean;
  popular?: boolean;
  description: string;
  image?: string;
  stock?: number;
};

export type SiteSettings = {
  restaurantName: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  hours: string;
  openLabel: string;
  orderNote: string;
  deliveryNote: string;
  gstPercent: number;
  deliveryFee: number;
  deliveryMode: string;
  youtubeLinks: string[];
};

export const defaultSiteSettings: SiteSettings = {
  restaurantName: "Kebabest",
  phone: "96655 95001",
  whatsappNumber: "919665595001",
  address: "Shanti Kunj society opp Nucleus Mall-Camp, Pune, Maharashtra",
  hours: "12:00 – 23:30",
  openLabel: "Open daily",
  orderNote: "Your order details will open in WhatsApp. Review the message and tap Send to confirm with the restaurant.",
  deliveryNote: "The restaurant confirms availability, final delivery charge and delivery time on WhatsApp.",
  gstPercent: 5,
  deliveryFee: 35,
  deliveryMode: "Restaurant pickup or delivery after confirmation",
  youtubeLinks: ["", "", ""],
};

export const defaultMenu: MenuItem[] = [
  { id: "mut-shish", name: "Mutton Shish Kabab", category: "Kebabs", price: 350, type: "nonveg", available: true, stock: 20, popular: true, image: "/images/promo-chelo-clean.jpg", description: "Juicy mutton pieces grilled over flame." },
  { id: "mut-chelo", name: "Mutton Chelo Kabab", category: "Kebabs", price: 600, type: "nonveg", available: true, stock: 18, popular: true, image: "/images/promo-chelo-clean.jpg", description: "Kabab served with saffron rice and grilled tomato." },
  { id: "chic-juicy", name: "Chicken Juicy Kabab", category: "Kebabs", price: 250, type: "nonveg", available: true, stock: 25, image: "/images/promo-chelo-clean.jpg", description: "Tender chicken kabab with house spices." },
  { id: "chic-tikka", name: "Chicken Tikka", category: "Chicken", price: 250, type: "nonveg", available: true, stock: 24, popular: true, image: "/images/promo-chelo-clean.jpg", description: "Classic chicken tikka, smoky and tender." },
  { id: "mush-tikka", name: "Mushroom Tikka", category: "Veg", price: 150, type: "veg", available: true, stock: 16, image: "/images/cat-others-icon.png", description: "Chargrilled mushroom with Indian-Iranian spices." },
  { id: "paneer-tikka", name: "Paneer Tikka", category: "Veg", price: 250, type: "veg", available: true, stock: 20, image: "/images/cat-others-icon.png", description: "Soft paneer cubes grilled to perfection." },
  { id: "mutton-roll", name: "Mutton Lava Roll", category: "Rolls", price: 300, type: "nonveg", available: true, stock: 30, image: "/images/cat-rolls-icon.png", description: "Loaded mutton roll with sauces and salad." },
  { id: "chicken-roll", name: "Chicken Roll", category: "Rolls", price: 250, type: "nonveg", available: true, stock: 30, image: "/images/cat-rolls-icon.png", description: "Chicken wrap for quick bites." },
  { id: "paneer-roll", name: "Paneer Lava Roll", category: "Rolls", price: 250, type: "veg", available: true, stock: 22, image: "/images/cat-rolls-icon.png", description: "Paneer roll with rich sauce." },
  { id: "fries", name: "French Fries", category: "Fries", price: 150, type: "veg", available: true, stock: 40, image: "/images/cat-fries-icon.png", description: "Crispy fries served hot." },
  { id: "chelo-rice", name: "Chelo Rice", category: "Rice", price: 100, type: "veg", available: true, stock: 45, image: "/images/promo-chelo-clean.jpg", description: "Fluffy rice with saffron aroma." },
  { id: "saffron-rice", name: "Saffron Rice", category: "Rice", price: 150, type: "veg", available: true, stock: 35, image: "/images/promo-chelo-clean.jpg", description: "Premium saffron rice." },
  { id: "shawarma", name: "Chicken Shawarma", category: "Shawarma", price: 150, type: "nonveg", available: true, stock: 32, image: "/images/cat-shawarma-icon.png", description: "Open shawarma with chicken and sauces." },
  { id: "hummus", name: "Hummus", category: "Dips", price: 300, type: "veg", available: true, stock: 15, image: "/images/cat-others-icon.png", description: "Smooth hummus served fresh." },
  { id: "soft-drink", name: "Soft Drink", category: "Cold Beverages", price: 50, type: "veg", available: true, stock: 60, image: "/images/cat-cold-icon.png", description: "Chilled soft drink." },
  { id: "tea", name: "Iranian Tea", category: "Hot Beverages", price: 50, type: "veg", available: true, stock: 50, image: "/images/cat-hot-icon.png", description: "Warm tea for the perfect finish." },
  { id: "cola", name: "Cold Beverage", category: "Cold Beverages", price: 70, type: "veg", available: true, stock: 60, image: "/images/cat-cold-icon.png", description: "Chilled drink served with your meal." },
  { id: "baklava", name: "Baklava", category: "Desserts", price: 180, type: "veg", available: true, stock: 18, image: "/images/cat-desserts-icon.png", description: "Sweet layered pastry with nuts and syrup." },
  { id: "salad", name: "Fresh Salad", category: "Others", price: 100, type: "veg", available: true, stock: 20, image: "/images/cat-others-icon.png", description: "Fresh side salad for kabab plates." },
  { id: "burger", name: "Chicken Burger", category: "Burgers", price: 280, type: "nonveg", available: true, stock: 22, image: "/images/cat-burgers-icon.png", description: "Grilled chicken burger with house sauce." }
];

export const categories = ["All", "Kebabs", "Rolls", "Burgers", "Fries", "Shawarma", "Chicken", "Veg", "Rice", "Dips", "Hot Beverages", "Cold Beverages", "Desserts", "Others"];
