import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Archive,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleSlash2,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Grid2X2,
  Heart,
  ImagePlus,
  LayoutDashboard,
  List,
  LockKeyhole,
  MessageCircle,
  LogOut,
  Menu,
  Minus,
  MoreHorizontal,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { ResilientImage } from "@/app/components/media/ResilientImage";
import cozyCraftLogo from "@/imports/COZy.png";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  isStaffRole,
  safeFileName,
  supabase,
  type DbCustomerProfile,
  type DbOrder,
  type DbCustomerNotification,
  type DbProduct,
  type DbRole,
  type DbSupportTicket,
} from "@/lib/supabase";
import type { PublicStoreSettings } from "@/lib/store-settings";
import { functionErrorMessage } from "@/lib/function-error";
import { matchesCatalogSearch } from "@/lib/catalog-discovery";


export type Product = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  rating: string;
  reviews: number;
  stock: string;
  stockQuantity?: number;
  status?: "draft" | "active" | "inactive";
  color: string;
  material?: string;
  dimensions: string;
  description: string;
  images: string[];
  mainImageIndex?: number;
  createdAt?: string;
};

export const fallbackProducts: Product[] = [
  {
    id: "mara",
    name: "Mara Lounge Chair",
    category: "Living room",
    price: 18900,
    rating: "4.9",
    reviews: 32,
    stock: "In stock",
    color: "Oat bouclé",
    dimensions: "76W × 78D × 74H cm",
    description:
      "A deeply comfortable lounge chair in a textured, soft oat bouclé. Its low, generous silhouette invites you to stay a little longer.",
    images: [
      "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=88",
    ],
  },
  {
    id: "lino",
    name: "Lino Oak Console",
    category: "Living room",
    price: 24500,
    rating: "4.8",
    reviews: 18,
    stock: "Low stock",
    color: "Natural oak",
    dimensions: "140W × 40D × 76H cm",
    description:
      "A quietly architectural oak console designed to anchor an entryway, dining room, or living space with room for the things that matter.",
    images: [
      "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=88",
    ],
  },
  {
    id: "noma",
    name: "Noma Dining Chair",
    category: "Dining room",
    price: 9800,
    rating: "4.9",
    reviews: 47,
    stock: "In stock",
    color: "Warm sand",
    dimensions: "52W × 55D × 82H cm",
    description:
      "Sculpted for the long lunch. Noma pairs a welcoming upholstered seat with an elegantly pared-back profile.",
    images: [
      "https://images.unsplash.com/photo-1612372606404-0ab33e7187ee?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=1200&q=88",
    ],
  },
  {
    id: "santo",
    name: "Santo Bed Frame",
    category: "Bedroom",
    price: 38000,
    rating: "5.0",
    reviews: 15,
    stock: "In stock",
    color: "Walnut",
    dimensions: "196W × 210D × 108H cm",
    description:
      "A grounded frame in warm walnut, softened by a generous upholstered headboard and built for effortless, unhurried mornings.",
    images: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88",
    ],
  },
  {
    id: "hugo",
    name: "Hugo Sectional Sofa",
    category: "Living room",
    price: 56900,
    rating: "4.9",
    reviews: 21,
    stock: "In stock",
    color: "Stone linen",
    dimensions: "286W × 168D × 76H cm",
    description:
      "A generous, low-profile sectional for rooms that favor lingering.",
    images: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=1000&q=85",
    ],
  },
  {
    id: "nilo",
    name: "Nilo Coffee Table",
    category: "Living room",
    price: 16400,
    rating: "4.8",
    reviews: 16,
    stock: "In stock",
    color: "Travertine",
    dimensions: "110W × 70D × 34H cm",
    description: "A grounded stone table with softly eased edges.",
    images: [
      "https://images.unsplash.com/photo-1532372576444-dda954194ad0?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=85",
    ],
  },
  {
    id: "sola",
    name: "Sola Wardrobe",
    category: "Bedroom",
    price: 42800,
    rating: "4.8",
    reviews: 12,
    stock: "Low stock",
    color: "Smoked oak",
    dimensions: "120W × 55D × 205H cm",
    description: "A quietly capacious wardrobe in smoked oak.",
    images: [
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=85",
    ],
  },
  {
    id: "milo",
    name: "Milo Nightstand",
    category: "Bedroom",
    price: 11900,
    rating: "4.9",
    reviews: 28,
    stock: "In stock",
    color: "Natural ash",
    dimensions: "48W × 42D × 54H cm",
    description: "A small bedside essential with a softly rounded profile.",
    images: [
      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=85",
    ],
  },
  {
    id: "arco",
    name: "Arco Dining Table",
    category: "Dining room",
    price: 46800,
    rating: "4.9",
    reviews: 19,
    stock: "In stock",
    color: "European oak",
    dimensions: "220W × 98D × 75H cm",
    description: "An expansive oak table made for everyday gatherings.",
    images: [
      "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1602872029708-84d970d3382b?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1723750290151-164cb19ebab7?auto=format&fit=crop&w=1000&q=85",
    ],
  },
  {
    id: "vera",
    name: "Vera Dining Storage",
    category: "Dining room",
    price: 33700,
    rating: "4.7",
    reviews: 9,
    stock: "In stock",
    color: "Walnut veneer",
    dimensions: "160W × 45D × 80H cm",
    description: "Closed storage for the generous rituals of dining.",
    images: [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1602872029708-84d970d3382b?auto=format&fit=crop&w=1000&q=85",
    ],
  },
];

export type CartLine = {
  id: string;
  quantity: number;
  selectedForCheckout: boolean;
};

export type Address = {
  id: string;
  label: string;
  name: string;
  mobile: string;
  email: string;
  line: string;
  barangay: string;
  city: string;
  province: string;
  postal: string;
  note: string;
  primary: boolean;
};

export type Store = {
  storeSettings: PublicStoreSettings;
  products: Product[];
  adminProducts: Product[];
  cart: CartLine[];
  saved: string[];
  userId: string | null;
  user: string | null;
  userEmail: string | null;
  profilePhone: string;
  profileUsername: string;
  profileGender: string;
  profileBirth: string;
  profilePaymentMethod: "cod";
  hasPassword: boolean;
  role: DbRole | null;
  authReady: boolean;
  avatar: string | null;
  addresses: Address[];
  orders: DbOrder[];
  customerProfiles: DbCustomerProfile[];
  supportTickets: DbSupportTicket[];
  saveAddress: (address: Address) => Promise<string | null>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  add: (id: string, amount?: number) => void;
  remove: (id: string) => void;
  qty: (id: string, value: number) => void;
  setCartSelection: (id: string, selected: boolean) => void;
  setAllCartSelection: (selected: boolean) => void;
  toggle: (id: string) => void;
  signOut: () => Promise<void>;
  setAvatar: (value: string | null) => void;
  clearCart: () => void;
  refreshOrders: () => Promise<void>;
  refreshCustomers: () => Promise<void>;
  refreshTickets: () => Promise<void>;
  placeOrder: (
    addressId: string,
    paymentMethod: string,
    productIds?: string[],
  ) => Promise<{
    id: string | null;
    orderNumber: string | null;
    checkoutUrl: string | null;
    error: string | null;
  }>;
  updateOrderStatus: (
    id: string,
    status: DbOrder["status"],
  ) => Promise<string | null>;
  cancelOrder: (id: string, reason: string) => Promise<string | null>;
  saveProduct: (product: ManagedProduct) => Promise<string | null>;
  deleteProduct: (id: string) => Promise<string | null>;
  uploadProductImages: (files: File[]) => Promise<string[]>;
  uploadAvatar: (file: File) => Promise<{
    url: string | null;
    error: string | null;
  }>;
  submitTicket: (details: { message:string; category:DbSupportTicket["category"]; priority:DbSupportTicket["priority"]; orderId?:string; files?:File[] }) => Promise<string | null>;
  replyToTicket: (
    id: string,
    reply: string,
    status?: DbSupportTicket["status"],
  ) => Promise<string | null>;
  updateTicketStatus: (
    id: string,
    status: DbSupportTicket["status"],
  ) => Promise<string | null>;
  saveProfile: (details: {
    fullName: string;
    phone: string;
    username: string;
    gender: string;
    birth: string;
  }) => Promise<string | null>;
  requestEmailChange: (email: string) => Promise<string | null>;
  confirmEmailChange: (
    expectedEmail: string,
  ) => Promise<{ confirmed: boolean; error: string | null }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<string | null>;
  requestPasswordSetup: () => Promise<string | null>;
};

export const StoreContext = createContext<Store | null>(null);

export type AdminRole = "Super Administrator" | "Administrator" | "Staff";

export type AdminSession = {
  role: AdminRole;
  databaseRole: DbRole | null;
  authReady: boolean;
  userId: string | null;
  user: string | null;
  userEmail: string | null;
  signOut: () => Promise<void>;
};

export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error("Admin session unavailable");
  return session;
}

export const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

export const materialFor = (id: string) =>
  ({
    mara: "Bouclé upholstery · solid ash frame",
    lino: "Natural oak veneer · brushed brass",
    noma: "Textured weave · powder-coated steel",
    santo: "Walnut veneer · woven upholstery",
    hugo: "Linen blend · kiln-dried hardwood",
    nilo: "Travertine stone · oak base",
    sola: "Smoked oak veneer · soft-close hardware",
    milo: "Natural ash · brushed brass",
    arco: "European oak · matte protective finish",
    vera: "Walnut veneer · fluted glass",
  })[id] ?? "Thoughtfully selected premium materials";

export const subcategoryFor = (id: string) =>
  ({
    mara: "2-Seater Fabric Sofa",
    lino: "Modern TV Stand",
    noma: "Luxury Velvet Dining Chairs",
    santo: "Queen Size Bed",
    hugo: "Sectional Sofa",
    nilo: "Marble Coffee Table",
    sola: "2-Door Wardrobe",
    milo: "Modern Nightstand",
    arco: "Extendable Dining Table",
    vera: "Buffet Cabinet",
  })[id] ?? "Collection piece";

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("Store unavailable");
  return context;
}

export function Logo({
  light = false,
  splash = false,
}: {
  light?: boolean;
  splash?: boolean;
}) {
  const art = (
    <ResilientImage
      src={cozyCraftLogo}
      alt="CozyCraft Furniture official logo"
      className={`h-full w-full origin-center object-contain ${splash ? "scale-[1.25]" : "scale-[1.34]"} ${light ? "brightness-0 invert" : ""}`}
    />
  );
  const className = splash
    ? "block h-36 w-72 overflow-hidden sm:h-44 sm:w-80"
    : "block h-12 w-32 overflow-hidden sm:h-14 sm:w-40";
  return splash ? (
    <div className={className}>{art}</div>
  ) : (
    <Link to="/home" aria-label="CozyCraft home" className={className}>
      {art}
    </Link>
  );
}

export function Header({ immersive = false }: { immersive?: boolean }) {
  const { cart, saved, userId, user, avatar, products, profileUsername, storeSettings } = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [customerNotifications, setCustomerNotifications] = useState<DbCustomerNotification[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const cartQty = cart.reduce((n, x) => n + x.quantity, 0);
  const profileDisplayName =
    profileUsername.trim() || user?.trim().split(/\s+/)[0] || "Member";
  useEffect(() => {
    if (!immersive) return;
    const update = () => setScrolled(window.scrollY > 80);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [immersive]);
  useEffect(() => {
    setNotificationOpen(false);
    setMenu(false);
    setSearchOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!userId) {
      setCustomerNotifications([]);
      return;
    }
    const refresh = async () => {
      const { data, error } = await supabase.from("customer_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (!error) setCustomerNotifications((data ?? []) as DbCustomerNotification[]);
    };
    void refresh();
    const channel = supabase.channel(`storefront-notifications-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "customer_notifications", filter: `user_id=eq.${userId}` }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);
  const unreadNotifications = customerNotifications.filter((item) => !item.read_at).length;
  const openNotification = async (notification: DbCustomerNotification) => {
    if (!notification.read_at) {
      await supabase.from("customer_notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id);
      setCustomerNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    }
    if (notification.entity_type === "orders") nav("/profile?tab=orders");
    if (notification.entity_type === "support_tickets") nav("/profile?tab=support");
    setNotificationOpen(false);
  };
  const matches = products
    .filter((product) => matchesCatalogSearch(product, query))
    .slice(0, 5);
  const announcementVisible =
    storeSettings.announcement_enabled &&
    Boolean(storeSettings.announcement_text.trim());
  const overHero = immersive && !scrolled;
  const navClass = immersive
    ? `fixed inset-x-0 top-0 z-30 transition-colors duration-300 ${overHero ? "border-b border-white/35 bg-transparent text-white" : "border-b border-border bg-background/95 text-foreground backdrop-blur"}`
    : "sticky top-0 z-30 border-b border-border/90 bg-background/95 text-foreground backdrop-blur";
  return (
    <>
      <header className={navClass}>
        {announcementVisible && (
          <div
            role="status"
            aria-label="Store announcement"
            className="flex h-9 items-center justify-center gap-2 overflow-hidden bg-[#292622] px-3 text-center text-[11px] font-semibold text-white"
          >
            <span className="min-w-0 truncate">
              {storeSettings.announcement_text}
            </span>
            {storeSettings.announcement_link && (
              <Link
                className="shrink-0 underline underline-offset-4"
                to={storeSettings.announcement_link}
              >
                Learn more
              </Link>
            )}
          </div>
        )}
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-3 sm:px-5 lg:px-10">
          <Logo light={overHero} />
          <nav className="hidden items-center gap-7 text-[12px] font-semibold tracking-[0.035em] md:flex">
            <Link to="/home">Home</Link>
            <Link to="/living-room">Living room</Link>
            <Link to="/bedroom">Bedroom</Link>
            <Link to="/dining-room">Dining room</Link>
            <Link to="/new-arrivals">New arrivals</Link>
            <Link to="/about">About</Link>
          </nav>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search products"
              className={`hidden h-9 w-9 place-items-center rounded-full sm:grid ${overHero ? "hover:bg-white/15" : "hover:bg-secondary"}`}
            >
              <Search size={18} />
            </button>
            <Link
              id="wishlist-nav-target"
              to="/wishlist"
              aria-label={`Wishlist${saved.length ? `, ${saved.length} saved` : ""}`}
              className={`relative grid h-9 w-9 place-items-center rounded-full ${overHero ? "hover:bg-white/15" : "hover:bg-secondary"}`}
            >
              <Heart size={18} fill={saved.length ? "currentColor" : "none"} />
              {saved.length > 0 && (
                <b
                  className={`absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full text-[9px] ${overHero ? "bg-white text-foreground" : "bg-foreground text-background"}`}
                >
                  {saved.length}
                </b>
              )}
            </Link>
            <Link
              id="cart-nav-target"
              to="/cart"
              aria-label={`Shopping bag${cartQty ? `, ${cartQty} item${cartQty === 1 ? "" : "s"}` : ""}`}
              className={`relative grid h-9 w-9 place-items-center rounded-full ${overHero ? "hover:bg-white/15" : "hover:bg-secondary"}`}
            >
              <ShoppingBag size={18} />
              {cartQty > 0 && (
                <b
                  className={`absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full text-[9px] ${overHero ? "bg-white text-foreground" : "bg-foreground text-background"}`}
                >
                  {cartQty}
                </b>
              )}
            </Link>
            {user && (
              <div className="relative">
                <button type="button" onClick={() => setNotificationOpen((value) => !value)} aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`} className={`relative grid h-9 w-9 place-items-center rounded-full ${overHero ? "hover:bg-white/15" : "hover:bg-secondary"}`}>
                  <Bell size={18} />
                  {unreadNotifications > 0 && <b className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#a45f45] px-1 text-[9px] text-white">{Math.min(unreadNotifications, 9)}{unreadNotifications > 9 ? "+" : ""}</b>}
                </button>
                {notificationOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() => setNotificationOpen(false)}
                      className={`fixed inset-x-0 bottom-0 z-40 bg-black/20 sm:bg-transparent ${announcementVisible ? "top-[112px]" : "top-[76px]"}`}
                    />
                    <section
                      aria-label="Customer notifications"
                      className={`fixed inset-x-3 bottom-3 z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:h-auto sm:max-h-[min(32rem,calc(100dvh-6rem))] sm:w-[360px] ${announcementVisible ? "top-[120px]" : "top-[84px]"}`}
                    >
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                      <div className="min-w-0"><b className="block text-sm">Notifications</b><span className="block text-[10px] text-muted-foreground">{unreadNotifications} unread</span></div>
                      <button type="button" aria-label="Close notifications" onClick={() => setNotificationOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-secondary"><X size={16} /></button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                      {customerNotifications.length ? customerNotifications.map((notification) => (
                        <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`w-full rounded-xl p-3 text-left hover:bg-secondary ${notification.read_at ? "opacity-70" : "bg-secondary/60"}`}>
                          <span className="flex min-w-0 items-start gap-2"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? "bg-transparent" : "bg-[#a45f45]"}`} /><span className="min-w-0 flex-1"><b className="block break-words text-xs">{notification.title}</b><span className="mt-1 block break-words text-[11px] leading-4 text-muted-foreground">{notification.message}</span><time className="mt-1.5 block text-[9px] text-muted-foreground" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time></span></span>
                        </button>
                      )) : <p className="p-6 text-center text-xs text-muted-foreground">No notifications yet.</p>}
                    </div>
                    </section>
                  </>
                )}
              </div>
            )}
            {user ? (
              <Link
                to="/profile"
                className={`hidden h-9 min-w-9 items-center justify-center gap-2 rounded-full px-1 sm:flex ${overHero ? "hover:bg-white/15" : "hover:bg-secondary"}`}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Profile"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${overHero ? "bg-white text-foreground" : "bg-[#b8a58d] text-foreground"}`}
                  >
                    {user.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden text-xs font-semibold xl:block">
                  {profileDisplayName}
                </span>
              </Link>
            ) : (
              <Link
                to="/login"
                className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold sm:flex ${overHero ? "border border-white/50 hover:bg-white hover:text-foreground" : "border border-border bg-card hover:bg-secondary"}`}
              >
                <UserRound size={15} />
                Sign in
              </Link>
            )}
            <button
              onClick={() => setMenu(!menu)}
              aria-label={menu ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menu}
              className={`grid h-9 w-9 place-items-center rounded-full md:hidden ${overHero ? "hover:bg-white/15" : "hover:bg-secondary"}`}
            >
              {menu ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav
            className={`grid px-5 py-3 md:hidden ${overHero ? "border-t border-white/20 bg-[#1f1e1b]/95 text-white" : "border-t border-border bg-background"}`}
          >
            {[
              ["Home", "/home"],
              ["Living room", "/living-room"],
              ["Bedroom", "/bedroom"],
              ["Dining room", "/dining-room"],
              ["New arrivals", "/new-arrivals"],
            ].map(([label, path]) => (
              <Link
                to={path}
                className="px-3 py-2.5 text-[12px] font-semibold tracking-[0.03em]"
                key={path}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/about"
              className="px-3 py-2.5 text-[12px] font-semibold tracking-[0.03em]"
            >
              About
            </Link>
            <Link
              to={user ? "/profile" : "/login"}
              className="px-3 py-2.5 text-[12px] font-semibold tracking-[0.03em]"
            >
              {user ? "My profile" : "Sign in"}
            </Link>
          </nav>
        )}
      </header>
      {searchOpen && (
        <div className={`fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-5 backdrop-blur-sm ${announcementVisible ? "pt-36" : "pt-24"}`} role="dialog" aria-modal="true" aria-label="Search CozyCraft products">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-5">
              <Search size={18} className="text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sofas, tables, bedroom pieces..."
                className="h-16 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                aria-label="Close product search"
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
              >
                <X size={17} />
              </button>
            </div>
            <div className="p-3">
              {query ? (
                <>
                  {matches.length ? (
                    matches.map((product) => (
                      <button
                        onClick={() => {
                          nav(`/products/${product.id}`);
                          setSearchOpen(false);
                          setQuery("");
                        }}
                        key={product.id}
                        className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-secondary"
                      >
                        <ResilientImage
                          src={product.images[0]}
                          alt={product.name}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                        <span className="flex-1">
                          <b className="block text-sm">{product.name}</b>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {product.category} · {money(product.price)}
                          </span>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))
                  ) : (
                    <p className="p-5 text-center text-sm text-muted-foreground">
                      No pieces found for “{query}”.
                    </p>
                  )}
                </>
              ) : (
                <div className="p-5">
                  <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                    START WITH A ROOM
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Living room", "Bedroom", "Dining room"].map((room) => (
                      <button
                        onClick={() => setQuery(room)}
                        key={room}
                        className="rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Layout({
  children,
  immersive = false,
}: {
  children: ReactNode;
  immersive?: boolean;
}) {
  const { storeSettings, role } = useStore();
  const staffBypass = role === "staff" || role === "admin" || role === "superadmin";
  if (storeSettings.maintenance_mode && !staffBypass) {
    return <main className="grid min-h-dvh place-items-center bg-[#e9e5de] p-5"><section className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_22px_70px_rgba(35,31,27,.12)]"><Logo /><p className="mt-8 text-[10px] font-bold tracking-[.18em] text-muted-foreground">A LITTLE CARE BEHIND THE SCENES</p><h1 className="mt-3 font-serif text-4xl">We’ll be right back.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">CozyCraft is receiving a thoughtful update. Please return shortly, or contact {storeSettings.contact_email} if you need help with an existing order.</p></section></main>;
  }
  return (
    <>
      <a href="#page-content" className="skip-link">Skip to main content</a>
      <Header immersive={immersive} />
      <div id="page-content" tabIndex={-1} className={`${immersive ? "bg-background" : "bg-[#e9e5de] p-3 sm:p-5"} pb-20 md:pb-0`}>
        <div
          className={
            immersive
              ? "bg-background"
              : "overflow-hidden rounded-[1.75rem] bg-background shadow-[0_18px_60px_rgba(49,41,31,0.10)]"
          }
        >
          {children}
          <StorefrontServiceStrip />
          <footer className="bg-[#211f1d] text-[#f4f2ee]">
            <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_repeat(3,1fr)] lg:px-10">
              <div>
                <Logo light />
                <p className="mt-3 max-w-xs text-sm leading-6 text-[#f4f2ee]/65">
                  {storeSettings.store_description}
                </p>
                <div className="mt-4 grid gap-1 text-xs leading-5 text-[#f4f2ee]/55">
                  {storeSettings.business_address && <span>{storeSettings.business_address}</span>}
                  {storeSettings.support_phone && <a className="hover:text-white" href={`tel:${storeSettings.support_phone.replace(/\s/g, "")}`}>{storeSettings.support_phone}</a>}
                  <a className="hover:text-white" href={`mailto:${storeSettings.contact_email}`}>{storeSettings.contact_email}</a>
                  {storeSettings.delivery_area && <span>Delivery area: {storeSettings.delivery_area}</span>}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-bold tracking-[.12em] text-white/60">
                  {Object.entries(storeSettings.social_links).filter(([, url]) => Boolean(url)).map(([network, url]) => <a key={network} href={url} target="_blank" rel="noreferrer" className="uppercase hover:text-white">{network}</a>)}
                </div>
              </div>
              {[
                ["SHOP", [["Living room", "/living-room"], ["Bedroom", "/bedroom"], ["Dining room", "/dining-room"], ["New arrivals", "/new-arrivals"]]],
                ["ACCOUNT", [["Profile", "/profile"], ["Orders", "/orders"], ["Wishlist", "/wishlist"], ["Bag", "/cart"]]],
                ["COZYCRAFT", [["Our story", "/about"], ["Customer care", "/profile?tab=support"], ["Delivery addresses", "/profile?tab=addresses"], ["Secure checkout", "/cart"]]],
              ].map(([heading, links]) => (
                <div key={heading as string}>
                  <p className="text-[10px] font-bold tracking-[.18em] text-white/45">{heading as string}</p>
                  <nav className="mt-4 grid gap-3 text-sm text-[#f4f2ee]/70">
                    {(links as string[][]).map(([label, to]) => <Link className="transition hover:text-white" key={label} to={to}>{label}</Link>)}
                  </nav>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] tracking-[.12em] text-white/40">© 2026 {storeSettings.store_name.toUpperCase()} · {storeSettings.contact_email}</div>
          </footer>
        </div>
      </div>
      <CareChat />
      <MobileStoreNav />
    </>
  );
}

function StorefrontServiceStrip() {
  const { storeSettings } = useStore();
  const paymentLabels = [
    storeSettings.checkout_settings.cod_enabled && "COD",
    storeSettings.checkout_settings.card_enabled && "card",
    storeSettings.checkout_settings.gcash_enabled && "GCash",
  ].filter(Boolean).join(", ");
  const services = [
    [Package, "Careful delivery", `${storeSettings.fulfillment_settings.estimated_delivery_days_min}–${storeSettings.fulfillment_settings.estimated_delivery_days_max} day estimate`],
    [ShieldCheck, "Secure shopping", "Protected account and checkout"],
    [CreditCard, "Flexible payment", paymentLabels || "Temporarily unavailable"],
    [MessageCircle, "CozyCraft Care", "Support when you need it"],
  ] as const;
  return (
    <section aria-label="CozyCraft shopping services" className="border-t border-border bg-[#f1ede6]">
      <div className="mx-auto grid max-w-[1440px] divide-y divide-border px-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 lg:px-10">
        {services.map(([Icon, title, note]) => (
          <div className="flex items-center gap-3 py-5 sm:px-5" key={title}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card"><Icon size={17} /></span>
            <span><b className="block text-xs">{title}</b><span className="mt-1 block text-[11px] text-muted-foreground">{note}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MobileStoreNav() {
  const location = useLocation();
  const { cart, saved, user } = useStore();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const entries = [
    [LayoutDashboard, "Home", "/home", 0],
    [Grid2X2, "Shop", "/living-room", 0],
    [Heart, "Saved", "/wishlist", saved.length],
    [ShoppingBag, "Bag", "/cart", cartCount],
    [UserRound, "Account", user ? "/profile" : "/login", 0],
  ] as const;
  return (
    <nav aria-label="Mobile shopping navigation" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(35,31,27,.08)] backdrop-blur md:hidden">
      {entries.map(([Icon, label, to, count]) => {
        const active = location.pathname === to || (label === "Shop" && ["/living-room", "/bedroom", "/dining-room", "/new-arrivals"].includes(location.pathname));
        return <Link key={label} to={to} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-1 text-[9px] font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}><span className={`grid h-8 w-10 place-items-center rounded-full ${active ? "bg-secondary" : ""}`}><Icon size={17} />{count > 0 && <b className="absolute right-[20%] top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#9a6047] px-1 text-[8px] text-white">{count > 99 ? "99+" : count}</b>}</span>{label}</Link>;
      })}
    </nav>
  );
}

type CareChatMessage = {
  from: "care" | "you";
  text: string;
};

export function CareChat() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<CareChatMessage[]>([
    {
      from: "care",
      text: "Hello — I’m Cozy, your CozyCraft care assistant. How can I help today?",
    },
  ]);
  const quickHelp = [
    "Track an order",
    "Delivery concern",
    "Payment help",
    "Start a support ticket",
  ];

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  const reply = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.slice(-10).map((item) => ({
      role: item.from === "you" ? "user" : "assistant",
      content: item.text,
    }));

    setDraft("");
    setError("");
    setSending(true);
    setMessages((current) => [...current, { from: "you", text: message }]);

    try {
      const invokeAssistant = () =>
        supabase.functions.invoke("cozycraft-assistant", {
          body: { message, history },
        });

      let response = await invokeAssistant();
      if (response.error) {
        const status =
          response.error.context instanceof Response
            ? response.error.context.status
            : 0;
        const canRetry = status === 0 || status === 429 || status >= 500;
        if (canRetry) {
          await new Promise((resolve) => window.setTimeout(resolve, 650));
          response = await invokeAssistant();
        }
      }

      const { data, error: invokeError } = response;

      if (invokeError) {
        throw invokeError;
      }

      if (!data?.reply || typeof data.reply !== "string") {
        throw new Error(data?.error || "The assistant returned no response.");
      }

      setMessages((current) => [
        ...current,
        { from: "care", text: data.reply },
      ]);
    } catch (requestError) {
      console.error("CozyCraft assistant error", requestError);
      setError(await functionErrorMessage(
        requestError,
        "CozyCraft Care is temporarily unavailable. Please try again in a moment.",
      ));
    } finally {
      setSending(false);
    }
  };

  const send = () => void reply(draft);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open CozyCraft chat"
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#292a26] text-[#f7f3eb] shadow-[0_14px_30px_rgba(35,31,27,.28)] transition hover:-translate-y-0.5 hover:bg-[#3d3b36] md:bottom-7 md:right-7 md:z-40"
        >
          <MessageCircle size={23} />
          <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-background bg-[#b89b78]" />
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="CozyCraft customer care chat"
          className="fixed bottom-[4.75rem] right-3 z-50 flex h-[min(580px,calc(100dvh-6rem))] w-[calc(100vw-24px)] max-w-[390px] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-2xl md:bottom-7 md:right-7 md:h-[min(620px,calc(100dvh-56px))] md:w-[calc(100vw-56px)]"
        >
          <header className="flex items-center justify-between bg-[#292a26] px-5 py-4 text-[#f7f3eb]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d8c7b0] text-foreground">
                <MessageCircle size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold">CozyCraft Care</p>
                <p className="mt-0.5 text-[10px] text-white/60">
                  AI shopping & customer care
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"
            >
              <X size={17} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto bg-[#faf8f4] p-4">
            <p className="mb-4 text-center text-[10px] font-bold tracking-[.14em] text-muted-foreground">
              COZYCRAFT CUSTOMER CARE
            </p>
            <div className="grid gap-3" aria-live="polite">
              {messages.map((message, index) => (
                <div
                  key={`${message.text}-${index}`}
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-5 ${
                    message.from === "you"
                      ? "ml-auto rounded-br-md bg-foreground text-background"
                      : "rounded-bl-md bg-card text-foreground shadow-sm"
                  }`}
                >
                  {message.text}
                </div>
              ))}
              {sending && (
                <div className="w-fit rounded-2xl rounded-bl-md bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <span className="inline-flex gap-1" aria-label="Cozy is typing">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse [animation-delay:150ms]">●</span>
                    <span className="animate-pulse [animation-delay:300ms]">●</span>
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {error && (
              <div
                role="alert"
                className="mt-3 rounded-xl bg-[#f3e3d5] px-3 py-2 text-xs font-semibold text-[#83583f]"
              >
                {error}
              </div>
            )}
            <div className="mt-5">
              <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                QUICK HELP
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickHelp.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => void reply(item)}
                    disabled={sending}
                    className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold transition hover:bg-secondary"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="flex gap-2 border-t border-border bg-card p-3"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl bg-secondary px-3 text-sm outline-none focus:ring-2 focus:ring-[#cbb8a1]"
              placeholder="Type your concern..."
              aria-label="Chat message"
              maxLength={2000}
              disabled={sending}
            />
            <button
              disabled={sending || !draft.trim()}
              className="h-11 rounded-xl bg-foreground px-4 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-45"
            >
              {sending ? "Sending" : "Send"}
            </button>
          </form>
        </section>
      )}
    </>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { add, toggle, saved } = useStore();
  const savedNow = saved.includes(product.id);
  const [hovered, setHovered] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const outOfStock = product.stockQuantity === 0;
  useEffect(() => {
    if (!hovered) {
      setImageIndex(0);
      return;
    }
    if (product.images.length < 2) return;
    const timer = window.setInterval(
      () => setImageIndex((current) => (current + 1) % product.images.length),
      1100,
    );
    return () => window.clearInterval(timer);
  }, [hovered, product.images.length]);
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group rounded-2xl bg-card p-2 shadow-[0_12px_35px_rgba(33,31,29,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(33,31,29,0.10)]"
    >
      <Link
        to={`/products/${product.id}`}
        className="relative block aspect-[.82] overflow-hidden rounded-xl bg-secondary"
      >
        <div
          className="flex h-full w-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${imageIndex * 100}%)` }}
        >
          {product.images.map((image, index) => (
            <ResilientImage
              key={image}
              src={image}
              alt={`${product.name}, view ${index + 1}`}
              className="h-full min-w-full object-cover"
            />
          ))}
        </div>
        <span className="absolute bottom-3 left-3 rounded-full bg-background/95 px-2.5 py-1 text-[10px] font-semibold shadow-sm">
          {product.stock}
        </span>
        {product.images.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-1">
            {product.images.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all ${index === imageIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        )}
      </Link>
      <div className="flex justify-between gap-2 px-1 pb-1 pt-4">
        <div>
          <p className="text-[11px] text-muted-foreground">
            {product.category} <span className="px-1">/</span>{" "}
            {product.subcategory || subcategoryFor(product.id)}
          </p>
          <Link
            to={`/products/${product.id}`}
            className="mt-1 block text-sm font-semibold"
          >
            {product.name}
          </Link>
          <p className="mt-1 text-sm">{money(product.price)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => toggle(product.id)}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card transition hover:bg-secondary"
            aria-label="Save product"
          >
            <Heart size={15} fill={savedNow ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => add(product.id)}
            disabled={outOfStock}
            className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
            aria-label={outOfStock ? `${product.name} is out of stock` : `Add ${product.name} to bag`}
            title={outOfStock ? "Out of stock — product details are still available" : "Add to bag"}
          >
            {outOfStock ? <CircleSlash2 size={15} /> : <Plus size={15} />}
          </button>
        </div>
      </div>
    </article>
  );
}

export function Empty({
  title,
  text,
  cta,
  to,
}: {
  title: string;
  text: string;
  cta: string;
  to: string;
}) {
  return (
    <div className="mt-10 grid min-h-[300px] place-items-center border border-dashed border-border bg-card p-8 text-center">
      <div>
        <Heart className="mx-auto text-muted-foreground" />
        <h2 className="mt-5 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        <Link
          to={to}
          className="mt-6 inline-block bg-foreground px-4 py-3 text-sm font-semibold text-background"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

export function ConfirmSignOut({
  kind,
  onCancel,
  onConfirm,
}: {
  kind: "customer" | "admin";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isAdmin = kind === "admin";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eee8df] text-foreground">
          <LogOut size={20} />
        </span>
        <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
          {isAdmin ? "LEAVE OPERATIONS" : "SIGN OUT"}
        </p>
        <h2 id="signout-title" className="mt-2 font-serif text-3xl">
          {isAdmin ? "Log out of admin?" : "Sign out of CozyCraft?"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isAdmin
            ? "You will leave the operations workspace and return to the storefront."
            : "You will be signed out from this browser. Your saved items and account details will remain available when you return."}
        </p>
        <div className="mt-7 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold"
          >
            Stay signed in
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            {isAdmin ? "Log out" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Status({ children, text }: { children?: ReactNode; text?: string }) {
  const label = String(children ?? text ?? "Unknown");
  const normalized = label.toLowerCase().replaceAll("_", " ");
  const tone = ["complete", "active", "paid", "delivered", "resolved", "approved", "verified"].some((value) => normalized.includes(value))
    ? "bg-[#e3ecdf] text-[#56714f]"
    : ["cancel", "failed", "declined", "rejected", "refund required"].some((value) => normalized.includes(value))
      ? "bg-[#f5dfda] text-[#9a4f46]"
      : ["ship", "packed", "out for delivery", "information"].some((value) => normalized.includes(value))
        ? "bg-[#e1e8ee] text-[#526b7b]"
        : ["low", "pending", "process", "progress", "open", "refund pending"].some((value) => normalized.includes(value))
          ? "bg-[#f3e5d4] text-[#9a6047]"
          : "bg-secondary text-muted-foreground";
  return (
    <span
      className={`inline-flex min-w-[72px] items-center justify-center text-center rounded-full px-2 py-1 text-[10px] font-semibold leading-none ${tone}`}
    >
      {normalized.replace(/\b\w/g, (character) => character.toUpperCase())}
    </span>
  );
}

export type ManagedProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  price: number;
  quantity: number;
  status: "Active" | "Draft" | "Inactive";
  images: string[];
  main: number;
  material: string;
  dimensions: string;
};

export function Toast({ message, close }: { message: string; close: () => void }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const closeRef = useRef(close);

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    setIsLeaving(false);

    const fadeTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, 7200);
    const dismissTimer = window.setTimeout(() => {
      closeRef.current();
    }, 8000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-3 left-3 right-3 z-[70] flex items-start gap-3 rounded-xl bg-[#201f1d] px-4 py-3 text-sm text-white shadow-xl transition-all duration-700 ease-out sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md sm:items-center ${
        isLeaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <Check size={16} />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      <button className="shrink-0" aria-label="Dismiss notification" onClick={close}>
        <X size={16} />
      </button>
    </div>
  );
}

export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(35,31,27,.035)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(35,31,27,.07)]">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p>
      <p className="mt-4 break-words text-2xl font-semibold tracking-[-.04em]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#6c805f]">{note}</p>
    </div>
  );
}

export function Splash() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f4f2ee]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(207,188,161,.25),transparent_32%)]" />
      <div className="relative flex flex-col items-center text-center motion-safe:animate-[pulse_2.8s_ease-in-out_1]">
        <span className="mb-8 text-[10px] font-bold tracking-[.28em] text-muted-foreground">
          COZYCRAFT FURNITURES
        </span>
        <Logo splash />
        <div className="mt-8 w-36 overflow-hidden rounded-full bg-[#dfd8ce]">
          <span className="block h-px w-full origin-left bg-[#8d7863] motion-safe:animate-[pulse_2.3s_ease-in-out_1]" />
        </div>
        <p className="mt-5 text-[10px] font-bold tracking-[.24em] text-muted-foreground">
          PREPARING YOUR HOME EDIT
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Thoughtful pieces, quietly gathered.
        </p>
      </div>
      <p className="absolute bottom-8 text-[9px] font-semibold tracking-[.16em] text-muted-foreground/60">
        ESTABLISHED 2026 · VISION VENTURES
      </p>
    </div>
  );
}

export function ShopSignInPrompt({ close }: { close: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onHeaderAction = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("header a, header button")) {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onHeaderAction, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onHeaderAction, true);
    };
  }, [close]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-signin-title"
      className="fixed inset-x-0 bottom-0 top-[76px] z-[120] grid place-items-center overflow-y-auto bg-black/45 p-3 backdrop-blur-sm sm:p-5"
    >
      <section className="max-h-[calc(100dvh-6.25rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl">
        <div className="relative bg-[#292a26] p-7 text-[#f7f3eb]">
          <button
            onClick={close}
            aria-label="Close sign-in prompt"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
            <LockKeyhole size={19} />
          </span>
          <p className="mt-5 text-[10px] font-bold tracking-[.18em] text-white/60">
            MEMBERS SHOPPING
          </p>
          <h2 id="shop-signin-title" className="mt-2 font-serif text-3xl">
            Please sign in to shop.
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm leading-6 text-muted-foreground">
            Create an account or sign in to save favorites, add pieces to your
            bag, and track future orders.
          </p>
          <a
            href="/login"
            className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background"
          >
            Sign in to continue
          </a>
          <a
            href="/signup"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold"
          >
            Create an account
          </a>
          <button
            onClick={close}
            className="mt-5 w-full text-xs font-semibold text-muted-foreground underline underline-offset-4"
          >
            Continue browsing
          </button>
        </div>
      </section>
    </div>
  );
}
