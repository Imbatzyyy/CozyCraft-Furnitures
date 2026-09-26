import { localStore } from "@/lib/shared/browser-storage";
import { createRefreshScheduler } from "@/lib/admin/refresh-scheduler";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";
import { CareChatPanel } from "@/features/storefront/assistant/CareChatPanel";
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
import { createPortal } from "react-dom";
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useLocation,
  useNavigate,
  useParams,
  useViewTransitionState,
} from "react-router-dom";
import {
  Activity,
  ArrowUp,
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
  CircleAlert,
  CircleDollarSign,
  CircleSlash2,
  Clock,
  Facebook,
  House,
  Info,
  Instagram,
  MapPin,
  Sparkles,
  Truck,
  Youtube,
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
  Scale,
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
  type LucideIcon,
} from "lucide-react";
import { ResilientImage } from "@/components/media/ResilientImage";
import { ProductCardPreview } from "@/components/catalog/ProductCardPreview";
import { MiniCart } from "@/components/storefront/MiniCart";
import { QuickView } from "@/components/storefront/QuickView";
import { StarRating } from "@/components/storefront/StarRating";
import { RevealObserver, usePresence } from "@/components/storefront/motion";
import { navigationRooms, roomCollections } from "@/lib/catalog/room-collections";
import { subscribeToNewsletter } from "@/services/content/newsletter.service";
import cozyCraftLogo from "@/assets/branding/cozycraft-logo.png";
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
} from "@/services/supabase/client";
import type { PublicStoreSettings } from "@/lib/settings/store-settings";
import { functionErrorMessage } from "@/lib/shared/function-error";
import { rankCatalogSearch } from "@/lib/catalog/discovery";
import {
  primaryProductImage,
  productMainImageIndex,
} from "@/lib/catalog/product-images";
import {
  COMPARE_CHANGE_EVENT,
  readComparedProductIds,
  toggleComparedProduct,
} from "@/lib/catalog/compare";
import { stockBadge } from "@/lib/catalog/stock-availability";
import {
  authenticatorChallengeRequired,
  shouldRecheckAuthenticator,
} from "@/lib/auth/account-security";
import {
  isRecoverablePendingPayment,
  pendingPaymentRecoveryEvent,
  pendingPaymentOrderUrl,
  readPendingPaymentRecovery,
} from "@/lib/commerce/payment-recovery";


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
  updatedAt?: string;
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
  catalogReady?: boolean;
  /** True while the first live catalog read is still pending (show skeletons). */
  catalogPending?: boolean;
  miniCartOpen?: boolean;
  miniCartHighlight?: string | null;
  openMiniCart?: (highlight?: string | null) => void;
  closeMiniCart?: () => void;
  adminProducts: Product[];
  cart: CartLine[];
  saved: string[];
  userId: string | null;
  user: string | null;
  userEmail: string | null;
  profilePhone: string;
  profilePhoneVerifiedAt: string | null;
  profileUsername: string;
  profileGender: string;
  profileBirth: string;
  profilePaymentMethod: "cod" | "card" | "gcash";
  savePaymentPreference: (method: "cod" | "card" | "gcash") => Promise<string | null>;
  hasPassword: boolean | null;
  role: DbRole | null;
  authReady: boolean;
  avatar: string | null;
  addresses: Address[];
  orders: DbOrder[];
  customerOrderPagination?: {
    page: number; status: string; ids: string[]; total: number; counts: Record<string, number>;
    busy: boolean; error: string; setPage: (page: number) => void; setStatus: (status: string) => void;
  };
  ticketPagination?: { page: number; total: number; busy: boolean; error: string; setPage: (page: number) => void };
  ordersRealtimeConnected: boolean;
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
  refreshOrders: () => Promise<string | null>;
  refreshCustomers: () => Promise<string | null>;
  refreshTickets: () => Promise<string | null>;
  placeOrder: (
    addressId: string,
    paymentMethod: string,
    productIds?: string[],
    redemptionId?: string | null,
    onPaymentAuthorized?: () => void,
  ) => Promise<{
    id: string | null;
    orderNumber: string | null;
    checkoutUrl: string | null;
    expiresAt: string | null;
    error: string | null;
    total?: number;
  }>;
  updateOrderStatus: (
    id: string,
    status: DbOrder["status"],
    expectedStatus?: DbOrder["status"],
  ) => Promise<string | null>;
  cancelOrder: (id: string, reason: string) => Promise<string | null>;
  saveProduct: (
    product: ManagedProduct,
    options?: { create?: boolean },
  ) => Promise<string | null>;
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
    username: string;
    gender: string;
    birth: string;
  }) => Promise<string | null>;
  requestPhoneVerification: (phone: string) => Promise<{
    challengeId: string | null;
    expiresAt: string | null;
    maskedPhone: string | null;
    alreadyVerified: boolean;
    retryAfter: number;
    error: string | null;
  }>;
  confirmPhoneVerification: (challengeId: string, code: string) => Promise<{
    phone: string | null;
    phoneVerifiedAt: string | null;
    error: string | null;
  }>;
  requestEmailChange: (email: string) => Promise<string | null>;
  confirmEmailChange: (
    expectedEmail: string,
  ) => Promise<{ confirmed: boolean; error: string | null }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<string | null>;
  requestPasswordSetup: () => Promise<string | null>;
  refreshPasswordStatus: () => Promise<string | null>;
};

export const StoreContext = createContext<Store | null>(null);

export type AdminRole = "Super Administrator" | "Administrator" | "Staff";

export type AdminSession = {
  role: AdminRole;
  databaseRole: DbRole | null;
  authReady: boolean;
  workspaceReady: boolean;
  workspaceLoading: boolean;
  workspaceError: string | null;
  userId: string | null;
  user: string | null;
  userEmail: string | null;
  avatar: string | null;
  refreshWorkspace: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error("Admin session unavailable");
  return session;
}

let activeCurrency = "PHP";

export const setMoneyCurrency = (currency: string) => {
  activeCurrency = ["PHP", "USD", "EUR", "SGD", "JPY"].includes(currency)
    ? currency
    : "PHP";
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: activeCurrency,
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
  const { cart, saved, userId, user, avatar, products, profileUsername, storeSettings, orders, customerOrderPagination } = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const [customerNotifications, setCustomerNotifications] = useState<DbCustomerNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [headerTucked, setHeaderTucked] = useState(false);
  const [bump, setBump] = useState({ cart: 0, wishlist: 0 });
  const [activeResult, setActiveResult] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(readRecentSearches);
  const menuPresence = usePresence(menu, 320);
  const searchPresence = usePresence(searchOpen, 220);
  const notificationPresence = usePresence(notificationOpen, 160);
  const [paymentClock, setPaymentClock] = useState(() => Date.now());
  const cartQty = cart.reduce((n, x) => n + x.quantity, 0);
  const profileDisplayName =
    profileUsername.trim() || user?.trim().split(/\s+/)[0] || "Member";
  const loadedRecoverablePayment = userId
    ? orders.find((order) =>
        isRecoverablePendingPayment(order, paymentClock),
      )
    : undefined;
  const localRecoverablePayment = userId
    ? readPendingPaymentRecovery(localStore, userId, paymentClock)
    : null;
  const recoverablePaymentId =
    loadedRecoverablePayment?.id ?? localRecoverablePayment?.orderId;
  const recoverablePaymentNumber =
    loadedRecoverablePayment?.order_number ??
    localRecoverablePayment?.orderNumber ??
    "pending order";
  const recoverablePaymentExpiresAt =
    loadedRecoverablePayment?.payment_expires_at ??
    localRecoverablePayment?.expiresAt ??
    null;
  const recoverablePaymentSeconds = recoverablePaymentExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(recoverablePaymentExpiresAt) - paymentClock) /
            1000,
        ),
      )
    : 0;
  const recoverablePaymentTime = `${String(
    Math.floor(recoverablePaymentSeconds / 60),
  ).padStart(2, "0")}:${String(recoverablePaymentSeconds % 60).padStart(2, "0")}`;
  useEffect(() => {
    if (!recoverablePaymentId) return;
    const timer = window.setInterval(() => setPaymentClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [recoverablePaymentId]);
  useEffect(() => {
    const refreshRecoveryMarker = () => setPaymentClock(Date.now());
    window.addEventListener(
      pendingPaymentRecoveryEvent,
      refreshRecoveryMarker,
    );
    window.addEventListener("storage", refreshRecoveryMarker);
    window.addEventListener("pageshow", refreshRecoveryMarker);
    return () => {
      window.removeEventListener(
        pendingPaymentRecoveryEvent,
        refreshRecoveryMarker,
      );
      window.removeEventListener("storage", refreshRecoveryMarker);
      window.removeEventListener("pageshow", refreshRecoveryMarker);
    };
  }, []);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 80);
      if (y < 160) {
        setHeaderTucked(false);
        last = y;
        return;
      }
      if (Math.abs(y - last) < 10) return;
      setHeaderTucked(y > last);
      last = y;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const arrived = (event: Event) => {
      const kind = (event as CustomEvent<"cart" | "wishlist">).detail;
      if (kind === "cart" || kind === "wishlist") setBump((current) => ({ ...current, [kind]: current[kind] + 1 }));
    };
    window.addEventListener("cozycraft:fly-arrived", arrived);
    return () => window.removeEventListener("cozycraft:fly-arrived", arrived);
  }, []);
  const previousCartQty = useRef(cartQty);
  useEffect(() => {
    if (cartQty > previousCartQty.current) setBump((current) => ({ ...current, cart: current.cart + 1 }));
    previousCartQty.current = cartQty;
  }, [cartQty]);
  useEffect(() => {
    setActiveResult(-1);
  }, [query]);
  useEffect(() => {
    setNotificationOpen(false);
    setMenu(false);
    setSearchOpen(false);
  }, [location.key]);
  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 768px)");
    const closeMobileMenu = (event: MediaQueryListEvent) => {
      if (event.matches) setMenu(false);
    };
    desktopViewport.addEventListener("change", closeMobileMenu);
    return () => desktopViewport.removeEventListener("change", closeMobileMenu);
  }, []);
  useEffect(() => {
    if (!menu) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.requestAnimationFrame(() => {
      menuCloseButtonRef.current?.focus();
    });
    const handleMenuKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        menuPanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleMenuKeys);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleMenuKeys);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [menu]);
  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.requestAnimationFrame(() => {
      searchPanelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    });
    const handleSearchKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSearchOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        searchPanelRef.current?.querySelectorAll<HTMLElement>(
          'input, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleSearchKeys);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleSearchKeys);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [searchOpen]);
  useEffect(() => {
    if (!userId) {
      setCustomerNotifications([]);
      setUnreadNotifications(0);
      return;
    }
    let active = true;
    const refresh = async () => {
      const [{ data, error }, unread] = await Promise.all([supabase
        .from("customer_notifications")
        .select("id,user_id,kind,title,message,entity_type,entity_id,read_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20), supabase.from("customer_notifications").select("id",{count:"exact",head:true}).eq("user_id",userId).is("read_at",null)]);
      if (!active) return;
      if (!error) setCustomerNotifications((data ?? []) as DbCustomerNotification[]);
      if (!unread.error) setUnreadNotifications(unread.count ?? 0);
    };
    const scheduler = createRefreshScheduler(refresh,200,1500);
    const recovery = watchVisibleRecovery(scheduler.request);
    scheduler.request();
    const channel = supabase.channel(`storefront-notifications-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "customer_notifications", filter: `user_id=eq.${userId}` }, recovery.invalidate)
      .subscribe(status=>{if(status==="SUBSCRIBED") recovery.invalidate();});
    return () => { active=false;recovery.dispose();scheduler.dispose();void supabase.removeChannel(channel); };
  }, [userId]);
  const openNotification = async (notification: DbCustomerNotification) => {
    if (!notification.read_at) {
      const {error} = await supabase.from("customer_notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id);
      if (!error) {
        setCustomerNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
        setUnreadNotifications(count=>Math.max(0,count-1));
      }
    }
    if (notification.entity_type === "orders") nav(`/profile?tab=orders${notification.entity_id ? `&order=${encodeURIComponent(notification.entity_id)}` : ""}`);
    if (notification.entity_type === "support_tickets") nav("/profile?tab=support");
    setNotificationOpen(false);
  };
  const trimmedQuery = query.trim();
  const matches = trimmedQuery ? rankCatalogSearch(products, trimmedQuery).slice(0, 6) : [];
  const resultCount = matches.length + (trimmedQuery ? 1 : 0);
  const trending = useMemo(
    () => [...products].sort((a, b) => b.reviews - a.reviews || Number(b.rating) - Number(a.rating)).slice(0, 4),
    [products],
  );
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };
  const openProduct = (product: Product) => {
    if (trimmedQuery) setRecentSearches(rememberSearch(trimmedQuery));
    closeSearch();
    nav(`/products/${product.id}`);
  };
  const searchAll = (value = trimmedQuery) => {
    const term = value.trim();
    if (!term) return;
    setRecentSearches(rememberSearch(term));
    closeSearch();
    nav(`/shop?q=${encodeURIComponent(term)}`);
  };
  const announcementVisible =
    storeSettings.announcement_enabled &&
    Boolean(storeSettings.announcement_text.trim());
  const overHero = immersive && !scrolled && !menu;
  const headerLayer = menu ? "z-[90]" : "z-30";
  const tucked = headerTucked && !menu && !searchOpen && !notificationOpen;
  const surface = overHero
    ? "border-b border-white/20 bg-gradient-to-b from-black/40 via-black/15 to-transparent text-white"
    : `border-b border-border/70 bg-[#f7f5f1]/85 text-foreground backdrop-blur-xl backdrop-saturate-150 ${scrolled ? "shadow-[0_10px_30px_rgba(35,31,27,.06)]" : ""}`;
  const navClass = `cc-header ${immersive ? "fixed inset-x-0 top-0" : "sticky top-0"} ${headerLayer} ${surface}`;
  const iconButton = `cc-press relative grid h-11 w-11 place-items-center rounded-full md:h-10 md:w-10 ${overHero ? "hover:bg-white/15" : "hover:bg-black/[.05]"}`;
  const badgeClass = `absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums ${overHero ? "bg-white text-foreground" : "bg-foreground text-background"}`;
  const roomCount = (match: string) => products.filter((product) => product.category.trim().toLowerCase() === match.toLowerCase()).length;
  const isCurrent = (path: string) => location.pathname === path;
  return (
    <>
      <header className={navClass} data-hidden={tucked ? "true" : undefined}>
        {announcementVisible && (
          <div
            role="status"
            aria-label="Store announcement"
            className="flex h-9 items-center justify-center gap-2 overflow-hidden bg-[#292622] px-3 text-center text-[11px] font-semibold tracking-[.02em] text-white"
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
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-10">
          <Logo light={overHero} />
          <nav aria-label="Main navigation" className="hidden h-full items-stretch gap-5 whitespace-nowrap text-[13px] font-medium tracking-[0.01em] md:flex lg:gap-7 xl:gap-9">
            <div className="hidden items-center lg:flex">
              <Link to="/shop" aria-current={isCurrent("/shop") ? "page" : undefined} className="cc-underline">Shop all</Link>
            </div>
            {navigationRooms.map((room) => {
              const collection = roomCollections[room.key];
              const groups = Object.entries(collection.groups as Record<string, readonly string[]>);
              return (
                <div key={room.path} className="group/mega flex items-center">
                  <Link
                    to={room.path}
                    aria-current={isCurrent(room.path) ? "page" : undefined}
                    className="cc-underline inline-flex items-center gap-1"
                  >
                    {room.label}
                    <ChevronDown size={13} aria-hidden="true" className="opacity-60 transition duration-300 group-hover/mega:rotate-180" />
                  </Link>
                  <div className="invisible absolute inset-x-0 top-full -translate-y-1 border-b border-border bg-[#fbfaf7] text-foreground opacity-0 shadow-[0_28px_60px_rgba(35,31,27,.12)] transition-[opacity,transform,visibility] delay-0 duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/mega:visible group-hover/mega:translate-y-0 group-hover/mega:opacity-100 group-hover/mega:delay-100 group-focus-within/mega:visible group-focus-within/mega:translate-y-0 group-focus-within/mega:opacity-100">
                    <div className="mx-auto grid max-w-[1440px] grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.35fr)] gap-8 px-5 py-9 lg:px-10">
                      {groups.map(([group, types]) => (
                        <div key={group}>
                          <Link
                            to={`${room.path}?group=${encodeURIComponent(group)}`}
                            className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground hover:text-foreground"
                          >
                            {group}
                          </Link>
                          <ul className="mt-4 grid gap-2.5 text-sm">
                            {types.map((type) => (
                              <li key={type}>
                                <Link
                                  to={`${room.path}?group=${encodeURIComponent(group)}&type=${encodeURIComponent(type)}`}
                                  className="text-foreground/80 transition hover:text-foreground hover:underline hover:underline-offset-4"
                                >
                                  {type}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <Link to={room.path} className="group/feature relative block min-h-[220px] overflow-hidden rounded-2xl bg-secondary">
                        <ResilientImage
                          src={collection.image.replace("w=1800", "w=900")}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition duration-[1200ms] group-hover/feature:scale-105"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        <span className="absolute inset-x-5 bottom-5 text-white">
                          <span className="block text-[11px] font-bold uppercase tracking-[.18em] text-white/75">{collection.eyebrow}</span>
                          <span className="mt-1.5 flex items-center justify-between gap-3 font-serif text-2xl">
                            Shop all {room.label.toLowerCase()}
                            <ArrowRight size={18} className="transition group-hover/feature:translate-x-1" />
                          </span>
                          <span className="mt-1 block text-xs text-white/75">{roomCount(collection.match)} pieces</span>
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="hidden items-center lg:flex">
              <Link to="/new-arrivals" aria-current={isCurrent("/new-arrivals") ? "page" : undefined} className="cc-underline">New arrivals</Link>
            </div>
            <div className="hidden items-center xl:flex">
              <Link to="/about" aria-current={isCurrent("/about") ? "page" : undefined} className="cc-underline">Our story</Link>
            </div>
          </nav>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                setMenu(false);
                setNotificationOpen(false);
                setSearchOpen(true);
              }}
              aria-label="Search products"
              className={iconButton}
            >
              <Search size={19} />
            </button>
            <Link
              id="wishlist-nav-target"
              data-fly-target="wishlist"
              to="/wishlist"
              aria-label={`Wishlist${saved.length ? `, ${saved.length} saved` : ""}`}
              className={`${iconButton} hidden md:grid`}
            >
              <Heart size={19} fill={saved.length ? "currentColor" : "none"} />
              {saved.length > 0 && (
                <b key={`wishlist-${bump.wishlist}`} className={`${badgeClass} ${bump.wishlist ? "cc-bump" : ""}`}>
                  {saved.length > 99 ? "99+" : saved.length}
                </b>
              )}
            </Link>
            <Link
              id="cart-nav-target"
              data-fly-target="cart"
              to="/cart"
              aria-label={`Shopping bag${cartQty ? `, ${cartQty} item${cartQty === 1 ? "" : "s"}` : ""}`}
              className={iconButton}
            >
              <ShoppingBag size={19} />
              {cartQty > 0 && (
                <b key={`cart-${bump.cart}`} className={`${badgeClass} ${bump.cart ? "cc-bump" : ""}`}>
                  {cartQty > 99 ? "99+" : cartQty}
                </b>
              )}
            </Link>
            {user && (
              <div className="relative">
                <button type="button" onClick={() => setNotificationOpen((value) => !value)} aria-expanded={notificationOpen} aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`} className={`${iconButton} hidden md:grid`}>
                  <Bell size={19} />
                  {unreadNotifications > 0 && <b className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#a45f45] px-1 text-[10px] font-bold text-white">{Math.min(unreadNotifications, 9)}{unreadNotifications > 9 ? "+" : ""}</b>}
                </button>
                {notificationPresence.mounted && (
                  <>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      data-state={notificationPresence.state}
                      onClick={() => setNotificationOpen(false)}
                      className={`cc-backdrop fixed inset-x-0 bottom-0 z-40 bg-black/25 md:bg-transparent ${announcementVisible ? "top-[112px]" : "top-[76px]"}`}
                    />
                    <section
                      aria-label="Customer notifications"
                      data-state={notificationPresence.state}
                      className={`cc-popover fixed inset-x-3 bottom-[calc(var(--mobile-store-nav-height)+.75rem)] z-50 flex min-h-0 origin-top-right flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-[var(--shadow-overlay)] md:absolute md:inset-auto md:right-0 md:top-12 md:h-auto md:max-h-[min(32rem,calc(100dvh-6rem))] md:w-[380px] ${announcementVisible ? "top-[120px]" : "top-[84px]"}`}
                    >
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5">
                      <div className="min-w-0"><b className="block text-sm">Notifications</b><span className="block text-[11px] text-muted-foreground">{unreadNotifications ? `${unreadNotifications} unread` : "You're all caught up"}</span></div>
                      <button type="button" aria-label="Close notifications" onClick={() => setNotificationOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-secondary"><X size={16} /></button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                      {customerNotifications.length ? customerNotifications.map((notification) => (
                        <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`w-full rounded-xl p-3 text-left transition-colors hover:bg-secondary ${notification.read_at ? "opacity-75" : "bg-secondary/60"}`}>
                          <span className="flex min-w-0 items-start gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? "bg-transparent" : "bg-[#a45f45]"}`} /><span className="min-w-0 flex-1"><b className="block break-words text-[13px]">{notification.title}</b><span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">{notification.message}</span><time className="mt-1.5 block text-[11px] text-muted-foreground" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time></span></span>
                        </button>
                      )) : (
                        <div className="grid place-items-center px-6 py-12 text-center">
                          <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary"><Bell size={18} /></span>
                          <p className="mt-3 text-sm font-semibold">No notifications yet</p>
                          <p className="mt-1 text-xs text-muted-foreground">Order and support updates will appear here.</p>
                        </div>
                      )}
                    </div>
                    </section>
                  </>
                )}
              </div>
            )}
            {user ? (
              <Link
                to="/profile"
                aria-label="My account"
                className={`cc-press ml-1 hidden h-10 min-w-10 items-center justify-center gap-2 rounded-full px-1 md:flex xl:pr-3 ${overHero ? "hover:bg-white/15" : "hover:bg-black/[.05]"}`}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white/70"
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
                className={`cc-press ml-1 hidden h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-xs font-semibold md:flex ${overHero ? "border border-white/50 hover:bg-white hover:text-foreground" : "border border-border bg-card hover:bg-secondary"}`}
              >
                <UserRound size={15} />
                Sign in
              </Link>
            )}
            <button
              ref={menuButtonRef}
              onClick={() => {
                setNotificationOpen(false);
                setSearchOpen(false);
                setMenu((open) => !open);
              }}
              aria-label={menu ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menu}
              aria-controls="customer-mobile-navigation"
              className={`${iconButton} md:hidden`}
            >
              <Menu size={21} />
            </button>
          </div>
        </div>
        {recoverablePaymentId && recoverablePaymentExpiresAt && (
          <Link
            to={pendingPaymentOrderUrl(recoverablePaymentId)}
            className="flex min-h-10 items-center justify-center gap-2 border-t border-[#d8cbb9]/25 bg-[#292622] px-3 py-2 text-center text-[11px] font-semibold text-white"
          >
            <span className="relative h-2 w-2 shrink-0 rounded-full bg-[#c9d9c3]"><span className="absolute inset-0 animate-ping rounded-full bg-[#c9d9c3]" /></span>
            <span className="truncate">
              Payment reserved for order {recoverablePaymentNumber}
            </span>
            <time className="shrink-0 rounded-full bg-white/10 px-2 py-1 font-mono text-[10px] tabular-nums" dateTime={recoverablePaymentExpiresAt}>
              {recoverablePaymentTime}
            </time>
            <span className="shrink-0 underline underline-offset-4">Continue</span>
          </Link>
        )}
        {menuPresence.mounted && createPortal(
          <div className="fixed inset-0 z-[100] md:hidden">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close navigation menu"
              data-state={menuPresence.state}
              onClick={() => setMenu(false)}
              className="cc-backdrop absolute inset-0 bg-[#171614]/50 backdrop-blur-[3px]"
            />
            <aside
              ref={menuPanelRef}
              id="customer-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-mobile-navigation-title"
              data-state={menuPresence.state}
              className="cc-drawer absolute inset-y-0 right-0 flex w-[min(92vw,400px)] flex-col overflow-hidden rounded-l-[1.75rem] bg-[#f8f6f2] text-foreground shadow-[var(--shadow-overlay)]"
            >
              <div className="flex min-h-[76px] shrink-0 items-center justify-between border-b border-border px-5 pt-[env(safe-area-inset-top)]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">
                    CozyCraft Furnitures
                  </p>
                  <h2 id="customer-mobile-navigation-title" className="mt-0.5 font-serif text-2xl">
                    Menu
                  </h2>
                </div>
                <button
                  ref={menuCloseButtonRef}
                  type="button"
                  onClick={() => setMenu(false)}
                  aria-label="Close navigation menu"
                  className="cc-press grid h-11 w-11 place-items-center rounded-full border border-border bg-white hover:bg-secondary"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <nav aria-label="Shop by room" className="cc-stagger grid gap-2.5 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                    Shop by room
                  </p>
                  {navigationRooms.map((room) => {
                    const collection = roomCollections[room.key];
                    const current = isCurrent(room.path);
                    return (
                      <Link
                        to={room.path}
                        aria-current={current ? "page" : undefined}
                        className={`group flex items-center gap-3.5 rounded-2xl border p-2 pr-4 transition-colors ${current ? "border-foreground/70 bg-white" : "border-border/80 bg-white/60 hover:bg-white"}`}
                        key={room.path}
                      >
                        <span className="cc-media h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                          <ResilientImage src={collection.image.replace("w=1800", "w=240")} alt="" className="h-full w-full object-cover" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-serif text-xl leading-tight">{room.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{roomCount(collection.match)} pieces</span>
                        </span>
                        <ArrowRight size={16} className="text-muted-foreground transition group-hover:translate-x-0.5" />
                      </Link>
                    );
                  })}
                  <div className="mt-1 grid grid-cols-2 gap-2.5">
                    {[
                      [Grid2X2, "Shop all", "/shop"],
                      [Sparkles, "New arrivals", "/new-arrivals"],
                      [Search, "Find my furniture", "/find-my-furniture"],
                      [Scale, "Compare", "/compare"],
                    ].map(([Icon, label, path]) => {
                      const LinkIcon = Icon as typeof Grid2X2;
                      return (
                        <Link
                          key={path as string}
                          to={path as string}
                          aria-current={isCurrent(path as string) ? "page" : undefined}
                          className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-border/80 bg-white/60 px-3.5 text-[13px] font-semibold transition-colors hover:bg-white aria-[current=page]:border-foreground/70 aria-[current=page]:bg-white"
                        >
                          <LinkIcon size={16} className="shrink-0 text-muted-foreground" />
                          <span className="min-w-0 leading-tight">{label as string}</span>
                        </Link>
                      );
                    })}
                  </div>
                </nav>

                <div className="border-t border-border py-5">
                  {user ? (
                    <details className="group">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white [&::-webkit-details-marker]:hidden">
                        {avatar ? (
                          <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ded2c1] text-sm font-bold">
                            {user.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm">{profileDisplayName}</b>
                          <span className="block text-xs text-muted-foreground">Account & saved items</span>
                        </span>
                        <ChevronDown size={16} className="transition duration-300 group-open:rotate-180" />
                      </summary>
                      <nav aria-label="My account" className="ml-5 mt-2 grid border-l border-border pl-5">
                        <Link to="/profile" className="flex min-h-11 items-center justify-between py-2 text-sm font-medium">
                          My account <ArrowRight size={14} className="text-muted-foreground" />
                        </Link>
                        <Link to="/profile?tab=orders" className="flex min-h-11 items-center justify-between py-2 text-sm font-medium">
                          My orders <span className="text-xs text-muted-foreground">{customerOrderPagination?.counts.all ?? (orders.length || "")}</span>
                        </Link>
                        <Link to="/wishlist" className="flex min-h-11 items-center justify-between py-2 text-sm font-medium">
                          Wishlist <span className="text-xs text-muted-foreground">{saved.length || ""}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMenu(false);
                            setNotificationOpen(true);
                          }}
                          className="flex min-h-11 items-center justify-between py-2 text-left text-sm font-medium"
                        >
                          Notifications
                          <span className={`rounded-full px-2 py-0.5 text-[11px] ${unreadNotifications ? "bg-[#a45f45] text-white" : "text-muted-foreground"}`}>
                            {unreadNotifications ? `${unreadNotifications} new` : "None new"}
                          </span>
                        </button>
                      </nav>
                    </details>
                  ) : (
                    <section aria-labelledby="customer-mobile-account-title" className="rounded-2xl border border-border bg-white p-4">
                      <p id="customer-mobile-account-title" className="text-sm font-semibold">Your CozyCraft account</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">See orders, saved pieces, addresses, and support in one place.</p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Link to="/login" className="cc-press grid min-h-11 place-items-center whitespace-nowrap rounded-xl bg-foreground px-2 text-xs font-semibold text-background">Sign in</Link>
                        <Link to="/signup" className="cc-press grid min-h-11 place-items-center whitespace-nowrap rounded-xl border border-border px-2 text-xs font-semibold">Create account</Link>
                      </div>
                    </section>
                  )}
                </div>

                <details className="group border-t border-border py-4">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl px-2 text-sm font-semibold transition hover:bg-white [&::-webkit-details-marker]:hidden">
                    Help & about
                    <ChevronDown size={16} className="transition duration-300 group-open:rotate-180" />
                  </summary>
                  <nav aria-label="Help and about CozyCraft" className="ml-2 mt-1 grid border-l border-border pl-5">
                    {[
                      ["Contact us", "/contact"],
                      ["Frequently asked questions", "/faq"],
                      ["Returns & refunds", "/refunds"],
                      ["About CozyCraft", "/about"],
                    ].map(([label, path]) => (
                      <Link key={path} to={path} className="flex min-h-11 items-center justify-between py-2 text-sm font-medium">
                        {label} <ArrowRight size={14} className="text-muted-foreground" />
                      </Link>
                    ))}
                  </nav>
                </details>

                <div className="flex items-center gap-5 border-t border-border pt-5 text-xs font-medium text-muted-foreground">
                  <Link to="/terms" className="underline-offset-4 hover:underline">Terms</Link>
                  <Link to="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
                  <Link to="/cookies" className="underline-offset-4 hover:underline">Cookies</Link>
                </div>
              </div>
            </aside>
          </div>,
          document.body,
        )}
      </header>
      {searchPresence.mounted && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-3 sm:p-5 sm:pt-24" role="dialog" aria-modal="true" aria-label="Search CozyCraft products">
          <button type="button" tabIndex={-1} aria-label="Close product search" data-state={searchPresence.state} onClick={closeSearch} className="cc-backdrop absolute inset-0 bg-[#171614]/50 backdrop-blur-sm" />
          <div ref={searchPanelRef} data-state={searchPresence.state} className="cc-dialog relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-overlay)] sm:max-h-[calc(100dvh-8rem)]">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const selected = activeResult >= 0 ? matches[activeResult] : undefined;
                if (selected) openProduct(selected);
                else searchAll();
              }}
              className="flex shrink-0 items-center gap-3 border-b border-border px-5"
            >
              <Search size={19} className="shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(event) => {
                  if (!resultCount) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveResult((current) => (current + 1) % resultCount);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveResult((current) => (current <= 0 ? resultCount - 1 : current - 1));
                  }
                }}
                role="combobox"
                aria-expanded={Boolean(trimmedQuery)}
                aria-controls="storefront-search-results"
                aria-activedescendant={activeResult >= 0 ? `search-result-${activeResult}` : undefined}
                aria-autocomplete="list"
                enterKeyHint="search"
                placeholder="Search sofas, tables, bedroom pieces…"
                className="storefront-product-search-input h-16 min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary">
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close product search"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-secondary"
              >
                <X size={18} />
              </button>
            </form>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-3" id="storefront-search-results" role="listbox" aria-label="Search results">
              {trimmedQuery ? (
                <>
                  {matches.length ? (
                    matches.map((product, index) => (
                      <button
                        type="button"
                        id={`search-result-${index}`}
                        role="option"
                        aria-selected={activeResult === index}
                        onMouseEnter={() => setActiveResult(index)}
                        onClick={() => openProduct(product)}
                        key={product.id}
                        className={`flex w-full items-center gap-3.5 rounded-2xl p-2.5 text-left transition-colors ${activeResult === index ? "bg-secondary" : "hover:bg-secondary/70"}`}
                      >
                        <span className="cc-media h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                          <ResilientImage
                            src={primaryProductImage(product)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm font-semibold">{highlightMatch(product.name, trimmedQuery)}</b>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {product.category} · {product.subcategory || "Collection piece"}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{money(product.price)}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <p className="font-serif text-2xl">No pieces found for “{trimmedQuery}”.</p>
                      <p className="mt-2 text-sm text-muted-foreground">Try a room, a material like oak or linen, or a piece like “sofa”.</p>
                    </div>
                  )}
                  <button
                    type="button"
                    id={`search-result-${matches.length}`}
                    role="option"
                    aria-selected={activeResult === matches.length}
                    onMouseEnter={() => setActiveResult(matches.length)}
                    onClick={() => searchAll()}
                    className={`mt-1 flex w-full items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3.5 text-left text-sm font-semibold transition-colors ${activeResult === matches.length ? "bg-secondary" : "hover:bg-secondary/70"}`}
                  >
                    <span className="truncate">See all results for “{trimmedQuery}”</span>
                    <ArrowRight size={16} className="shrink-0" />
                  </button>
                </>
              ) : (
                <div className="grid gap-6 p-3">
                  {recentSearches.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">Recent searches</p>
                        <button type="button" onClick={() => { localStore.removeItem(recentSearchKey); setRecentSearches([]); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {recentSearches.map((term) => (
                          <button key={term} type="button" onClick={() => setQuery(term)} className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-semibold hover:bg-secondary">
                            <Clock size={13} className="text-muted-foreground" /> {term}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  <section>
                    <p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">Start with a room</p>
                    <div className="mt-3 grid grid-cols-3 gap-2.5">
                      {navigationRooms.map((room) => (
                        <Link key={room.path} to={room.path} onClick={closeSearch} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-secondary">
                          <ResilientImage src={roomCollections[room.key].image.replace("w=1800", "w=400")} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <span className="absolute inset-x-2.5 bottom-2 text-xs font-semibold text-white sm:text-sm">{room.label}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                  {trending.length > 0 && (
                    <section>
                      <p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">Customer favourites</p>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {trending.map((product) => (
                          <button key={product.id} type="button" onClick={() => openProduct(product)} className="flex items-center gap-3 rounded-2xl p-2 text-left hover:bg-secondary">
                            <span className="cc-media h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                              <ResilientImage src={primaryProductImage(product)} alt="" className="h-full w-full object-cover" />
                            </span>
                            <span className="min-w-0">
                              <b className="block truncate text-[13px] font-semibold">{product.name}</b>
                              <span className="block text-xs text-muted-foreground tabular-nums">{money(product.price)}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const recentSearchKey = "cozycraft-recent-searches";

function readRecentSearches(): string[] {
  try {
    const value = JSON.parse(localStore.getItem(recentSearchKey) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function rememberSearch(term: string) {
  const next = [term, ...readRecentSearches().filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 5);
  localStore.setItem(recentSearchKey, JSON.stringify(next));
  return next;
}

function highlightMatch(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0 || !query) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-[#efe4d3] px-0.5 text-foreground">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

function CustomerMfaGate() {
  const { authReady, role, userId, signOut } = useStore();
  const [required, setRequired] = useState<boolean | null>(null);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const checkAssurance = useCallback(async () => {
    if (!authReady || role !== "customer" || !userId) {
      setRequired(false);
      setFactorId("");
      return;
    }
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
      setRequired(true);
      setError("We could not verify this session securely. Check your connection and retry.");
      return;
    }
    if (!authenticatorChallengeRequired(assurance.currentLevel, assurance.nextLevel)) {
      setRequired(false);
      setFactorId("");
      setError("");
      return;
    }
    const { data: factors, error: factorError } =
      await supabase.auth.mfa.listFactors();
    const verifiedFactor = factors?.totp.find(
      (factor) => factor.status === "verified",
    );
    if (factorError || !verifiedFactor) {
      setRequired(true);
      setFactorId("");
      setError("Your authenticator could not be loaded. Sign out and try again, or contact CozyCraft Care.");
      return;
    }
    setFactorId(verifiedFactor.id);
    setRequired(true);
    setError("");
  }, [authReady, role, userId]);

  useEffect(() => {
    setRequired(null);
    void checkAssurance();
  }, [checkAssurance]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (shouldRecheckAuthenticator(event)) {
          window.setTimeout(() => void checkAssurance(), 0);
        }
      },
    );
    return () => subscription.unsubscribe();
  }, [checkAssurance]);

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError("");
    const { error: verificationError } =
      await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (verificationError) {
      setError("That authenticator code is invalid or expired. Enter the newest code from your app.");
      return;
    }
    setCode("");
    await checkAssurance();
  };

  if (!authReady || role !== "customer" || !userId || required === false) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-[#211f1d]/70 p-4 backdrop-blur-md">
      {required === null ? (
        <section className="w-full max-w-sm rounded-[2rem] border border-border bg-card p-8 text-center shadow-2xl">
          <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Checking account protection…</p>
        </section>
      ) : (
        <form
          onSubmit={verify}
          className="w-full max-w-md rounded-[2rem] border border-border bg-card p-7 text-center shadow-[0_30px_90px_rgba(20,18,15,.3)] sm:p-8"
          aria-labelledby="customer-mfa-title"
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e9e2d7]">
            <ShieldCheck size={21} />
          </span>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            TWO-STEP VERIFICATION
          </p>
          <h1 id="customer-mfa-title" className="mt-2 font-serif text-4xl">
            Confirm it’s you.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Enter the current six-digit code from your authenticator app to continue to your CozyCraft account.
          </p>
          {factorId && (
            <label className="mt-6 grid gap-2 text-left text-sm font-semibold">
              Authenticator code
              <input
                autoFocus
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-invalid={Boolean(error)}
                className="h-13 rounded-xl border border-border bg-background px-4 text-center font-mono text-xl tracking-[.35em] outline-none focus:border-foreground focus:ring-4 focus:ring-[#d9c9b4]/25"
                placeholder="000000"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-[#e6c9b8] bg-[#f8ebe2] p-3 text-left text-xs font-semibold leading-5 text-[#8b5c46]">
              {error}
            </p>
          )}
          <button
            type={factorId ? "submit" : "button"}
            onClick={factorId ? undefined : () => void checkAssurance()}
            disabled={busy || Boolean(factorId && code.length !== 6)}
            className="mt-5 w-full rounded-xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Verifying…" : factorId ? "Verify and continue" : "Retry secure check"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
            className="mt-4 text-xs font-semibold underline underline-offset-4 disabled:opacity-50"
          >
            Sign out instead
          </button>
        </form>
      )}
    </div>
  );
}

export function Layout({
  children,
  immersive = false,
}: {
  children: ReactNode;
  immersive?: boolean;
}) {
  const store = useStore();
  const { storeSettings, role } = store;
  const staffBypass = role === "staff" || role === "admin" || role === "superadmin";
  if (storeSettings.maintenance_mode && !staffBypass) {
    return <main className="grid min-h-dvh place-items-center bg-[#e9e5de] p-5"><section className="cc-enter-up w-full max-w-xl rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_22px_70px_rgba(35,31,27,.12)] sm:p-12"><div className="flex justify-center"><Logo /></div><p className="mt-8 text-[11px] font-bold tracking-[.18em] text-muted-foreground">A LITTLE CARE BEHIND THE SCENES</p><h1 className="mt-3 font-serif text-4xl sm:text-5xl">We’ll be right back.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">CozyCraft is receiving a thoughtful update. Please return shortly, or contact {storeSettings.contact_email} if you need help with an existing order.</p></section></main>;
  }
  return (
    <>
      <CustomerMfaGate />
      <RevealObserver />
      <a href="#page-content" className="skip-link">Skip to main content</a>
      <Header immersive={immersive} />
      <div id="page-content" tabIndex={-1} className={immersive ? "bg-background" : "bg-[#e9e5de] md:px-5 md:pt-5"}>
        <div
          className={
            immersive
              ? "bg-background"
              : "bg-background md:overflow-clip md:rounded-t-[1.75rem] md:shadow-[0_18px_60px_rgba(49,41,31,0.10)]"
          }
        >
          <ShoppingConnection />
          <div className="cc-page">{children}</div>
          <StorefrontServiceStrip />
          <StorefrontFooter />
        </div>
      </div>
      <MiniCart store={store} money={money} />
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
    [Truck, "Careful delivery", `${storeSettings.fulfillment_settings.estimated_delivery_days_min}–${storeSettings.fulfillment_settings.estimated_delivery_days_max} day estimate`],
    [ShieldCheck, "Secure shopping", "Protected account and checkout"],
    [CreditCard, "Flexible payment", paymentLabels || "Temporarily unavailable"],
    [MessageCircle, "CozyCraft Care", "Support when you need it"],
  ] as const;
  return (
    <section aria-label="CozyCraft shopping services" className="border-t border-border bg-[#f1ede6]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-px px-0 lg:grid-cols-4 lg:px-10">
        {services.map(([Icon, title, note], index) => (
          <div data-reveal style={{ ["--reveal-delay" as string]: index * 70 }} className="flex flex-col items-start gap-3 px-5 py-6 sm:flex-row sm:items-center sm:py-7 lg:px-6" key={title}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-[#6f5d49] shadow-[var(--shadow-soft)]"><Icon size={18} strokeWidth={1.75} /></span>
            <span className="min-w-0"><b className="block text-[13px] font-semibold">{title}</b><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{note}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

const socialIcons: Record<string, typeof Facebook> = { facebook: Facebook, instagram: Instagram, youtube: Youtube };

function StorefrontFooter() {
  const { storeSettings } = useStore();
  const location = useLocation();
  const showNewsletter = !["/", "/home"].includes(location.pathname);
  const socials = Object.entries(storeSettings.social_links).filter(([, url]) => Boolean(url));
  const payments = [
    storeSettings.checkout_settings.cod_enabled && "Cash on delivery",
    storeSettings.checkout_settings.card_enabled && "Card",
    storeSettings.checkout_settings.gcash_enabled && "GCash",
  ].filter(Boolean) as string[];
  const columns: Array<[string, Array<[string, string]>]> = [
    ["Shop", [["Shop all", "/shop"], ["Living room", "/living-room"], ["Bedroom", "/bedroom"], ["Dining room", "/dining-room"], ["New arrivals", "/new-arrivals"], ["Find my furniture", "/find-my-furniture"]]],
    ["Account", [["My account", "/profile"], ["Orders", "/orders"], ["Wishlist", "/wishlist"], ["Bag", "/cart"], ["Compare", "/compare"]]],
    ["CozyCraft", [["Our story", "/about"], ["Contact", "/contact"], ["FAQ", "/faq"], ["Returns & refunds", "/refunds"], ["Terms", "/terms"], ["Privacy", "/privacy"]]],
  ];
  return (
    <footer className="bg-[#1f1d1b] text-[#f4f2ee]">
      {showNewsletter && <FooterNewsletter />}
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-14 lg:grid-cols-[1.25fr_2fr] lg:gap-16 lg:px-10 lg:py-16">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#f4f2ee]/65">
            {storeSettings.store_description}
          </p>
          <div className="mt-5 grid gap-1.5 text-[13px] leading-5 text-[#f4f2ee]/60">
            {storeSettings.business_address && <span className="inline-flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" />{storeSettings.business_address}</span>}
            {storeSettings.support_phone && <a className="w-fit transition hover:text-white" href={`tel:${storeSettings.support_phone.replace(/\s/g, "")}`}>{storeSettings.support_phone}</a>}
            <a className="w-fit break-all transition hover:text-white" href={`mailto:${storeSettings.contact_email}`}>{storeSettings.contact_email}</a>
            {storeSettings.delivery_area && <span>Delivering across {storeSettings.delivery_area}</span>}
          </div>
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map(([network, url]) => {
                const Icon = socialIcons[network.toLowerCase()];
                return (
                  <a key={network} href={url} target="_blank" rel="noreferrer" aria-label={`CozyCraft on ${network}`} className="cc-press grid h-10 min-w-10 place-items-center rounded-full border border-white/15 px-3 text-[11px] font-bold uppercase tracking-[.1em] text-white/75 hover:border-white/40 hover:text-white">
                    {Icon ? <Icon size={16} /> : network}
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {columns.map(([heading, links]) => (
            <div key={heading}>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-white/45">{heading}</p>
              <nav aria-label={`${heading} links`} className="mt-4 grid gap-3 text-sm text-[#f4f2ee]/70">
                {links.map(([label, to]) => <Link className="w-fit transition hover:translate-x-0.5 hover:text-white" key={label} to={to}>{label}</Link>)}
              </nav>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-6 text-xs text-white/55 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>© {new Date().getFullYear()} {storeSettings.store_name} · All rights reserved</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/cookies" className="hover:text-white">Cookie policy</Link>
            <button type="button" className="hover:text-white" onClick={() => window.dispatchEvent(new Event('cozycraft-cookie-settings'))}>Cookie settings</button>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
          </div>
          {payments.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Accepted payment methods">
              {payments.map((label) => <span key={label} className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-white/70">{label}</span>)}
            </div>
          )}
        </div>
        <div className="h-[var(--mobile-store-nav-height)] md:hidden" aria-hidden="true" />
      </div>
    </footer>
  );
}

function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setMessage("");
    const result = await subscribeToNewsletter(email);
    if (!result.ok) {
      setState("error");
      setMessage(result.message);
      return;
    }
    setState("done");
    setMessage(result.status === "already_subscribed" ? "You’re already on the CozyCraft list." : "Almost there — please confirm from the email we just sent.");
  };
  return (
    <div className="border-b border-white/10">
      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-12 lg:grid-cols-[1fr_minmax(0,460px)] lg:items-end lg:px-10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/45">Letters from the studio</p>
          <h2 className="mt-3 max-w-xl font-serif text-3xl leading-tight sm:text-4xl">New pieces and quieter ideas, sent occasionally.</h2>
        </div>
        <form onSubmit={submit} noValidate>
          <div className={`flex items-center gap-2 rounded-full border bg-white/[.04] p-1.5 pl-5 transition-colors focus-within:border-white/50 ${state === "error" ? "border-[#d9a08a]" : "border-white/20"}`}>
            <input
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); if (state !== "submitting") { setState("idle"); setMessage(""); } }}
              aria-label="Email address for CozyCraft updates"
              aria-invalid={state === "error"}
              aria-describedby="footer-newsletter-status"
              autoComplete="email"
              inputMode="email"
              placeholder="Your email address"
              className="storefront-product-search-input h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
            <button type="submit" disabled={state === "submitting"} className="cc-press h-11 shrink-0 rounded-full bg-[#f4f2ee] px-5 text-sm font-semibold text-foreground hover:bg-white disabled:opacity-60">
              {state === "submitting" ? "Joining…" : state === "done" ? "Joined" : "Join"}
            </button>
          </div>
          <p id="footer-newsletter-status" role={state === "error" ? "alert" : "status"} aria-live="polite" className={`mt-2.5 min-h-5 px-2 text-xs ${state === "error" ? "text-[#e7b4a1]" : "text-white/55"}`}>
            {message || <>Unsubscribe anytime. See our <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.</>}
          </p>
        </form>
      </div>
    </div>
  );
}

function useNavBump(cartCount: number) {
  const [bump, setBump] = useState({ cart: 0, wishlist: 0 });
  const previousCart = useRef(cartCount);
  useEffect(() => {
    const arrived = (event: Event) => {
      const kind = (event as CustomEvent<"cart" | "wishlist">).detail;
      if (kind === "cart" || kind === "wishlist") setBump((current) => ({ ...current, [kind]: current[kind] + 1 }));
    };
    window.addEventListener("cozycraft:fly-arrived", arrived);
    return () => window.removeEventListener("cozycraft:fly-arrived", arrived);
  }, []);
  useEffect(() => {
    if (cartCount > previousCart.current) setBump((current) => ({ ...current, cart: current.cart + 1 }));
    previousCart.current = cartCount;
  }, [cartCount]);
  return bump;
}

const shopPaths = ["/shop", "/living-room", "/bedroom", "/dining-room", "/new-arrivals", "/compare", "/find-my-furniture"];

function MobileStoreNav() {
  const location = useLocation();
  const { cart, saved, user } = useStore();
  const [editing, setEditing] = useState(false);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const bump = useNavBump(cartCount);
  const entries = [
    [House, "Home", "/home", 0, null],
    [Grid2X2, "Shop", "/shop", 0, null],
    [Heart, "Saved", "/wishlist", saved.length, "wishlist"],
    [ShoppingBag, "Bag", "/cart", cartCount, "cart"],
    [UserRound, "Account", user ? "/profile" : "/login", 0, null],
  ] as const;
  useEffect(() => {
    const isTextEntry = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const updateEditingState = () => setEditing(isTextEntry(document.activeElement));
    const startEditing = (event: FocusEvent) => {
      if (isTextEntry(event.target)) setEditing(true);
    };
    const finishEditing = () => window.setTimeout(updateEditingState, 0);
    document.addEventListener("focusin", startEditing);
    document.addEventListener("focusout", finishEditing);
    return () => {
      document.removeEventListener("focusin", startEditing);
      document.removeEventListener("focusout", finishEditing);
    };
  }, []);
  return (
    <nav aria-label="Mobile shopping navigation" aria-hidden={editing || undefined} className={`fixed inset-x-0 bottom-0 z-40 grid h-[var(--mobile-store-nav-height)] grid-cols-5 border-t border-border/80 bg-[#f7f5f1]/90 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(35,31,27,.07)] backdrop-blur-xl backdrop-saturate-150 transition duration-300 motion-reduce:transition-none md:hidden ${editing ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
      {entries.map(([Icon, label, to, count, flyKind]) => {
        const active =
          label === "Home" ? ["/", "/home"].includes(location.pathname)
          : label === "Shop" ? shopPaths.includes(location.pathname) || location.pathname.startsWith("/collections/") || location.pathname.startsWith("/products/")
          : label === "Account" ? ["/profile", "/login", "/signup", "/orders"].includes(location.pathname)
          : location.pathname === to;
        const bumpKey = flyKind ? bump[flyKind] : 0;
        return (
          <Link key={label} to={to} tabIndex={editing ? -1 : undefined} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
            <span data-fly-target={flyKind ?? undefined} className={`relative grid h-8 w-12 place-items-center rounded-full transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${active ? "bg-foreground text-background" : ""}`}>
              <Icon size={18} strokeWidth={active ? 2.1 : 1.8} fill={label === "Saved" && saved.length && !active ? "currentColor" : "none"} />
              {count > 0 && <b key={bumpKey} className={`absolute -right-0.5 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#9a6047] px-1 text-[10px] tabular-nums text-white ring-2 ring-[#f7f5f1] ${bumpKey ? "cc-bump" : ""}`}>{count > 99 ? "99+" : count}</b>}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}


export function CareChat() {
  const { userId } = useStore();
  const location = useLocation();
  const [comparedCount, setComparedCount] = useState(() =>
    readComparedProductIds().length,
  );
  const conversationOwner = userId ?? "guest";
  const comparisonTrayVisible =
    comparedCount > 0 &&
    (["/shop", "/living-room", "/bedroom", "/dining-room", "/new-arrivals"].includes(
      location.pathname,
    ) || location.pathname.startsWith("/collections/"));
  // Pages with a sticky mobile action bar lift the chat launcher above it.
  const productActionsVisible = location.pathname.startsWith("/products/") || ["/cart", "/checkout"].includes(location.pathname);

  useEffect(() => {
    const syncComparedCount = () =>
      setComparedCount(readComparedProductIds().length);
    window.addEventListener(COMPARE_CHANGE_EVENT, syncComparedCount);
    window.addEventListener("storage", syncComparedCount);
    return () => {
      window.removeEventListener(COMPARE_CHANGE_EVENT, syncComparedCount);
      window.removeEventListener("storage", syncComparedCount);
    };
  }, []);

  return (
    <CareChatPanel
      key={conversationOwner}
      ownerId={userId ?? null}
      currentPath={`${location.pathname}${location.search}`}
      raisedForComparison={comparisonTrayVisible || productActionsVisible}
    />
  );
}


export function ProductCard({ product }: { product: Product }) {
  const { add, toggle, saved } = useStore();
  const savedNow = saved.includes(product.id);
  const [hovered, setHovered] = useState(false);
  const [quickView, setQuickView] = useState(false);
  const [heartPulse, setHeartPulse] = useState(0);
  const mainImageIndex = productMainImageIndex(product);
  const outOfStock = product.stockQuantity === 0;
  const badge = stockBadge(product.stockQuantity, product.stock);
  const href = `/products/${product.id}`;
  const morphing = useViewTransitionState(href);
  const [compared, setCompared] = useState(() =>
    readComparedProductIds().includes(product.id),
  );
  const [compareNotice, setCompareNotice] = useState("");
  useEffect(() => {
    const sync = () => setCompared(readComparedProductIds().includes(product.id));
    window.addEventListener(COMPARE_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COMPARE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [product.id]);
  useEffect(() => {
    if (!compareNotice) return;
    const timer = window.setTimeout(() => setCompareNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [compareNotice]);
  const toggleSaved = () => {
    if (!savedNow) setHeartPulse((value) => value + 1);
    toggle(product.id);
  };
  return (
    <article
      data-reveal
      data-fly-source
      onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      className="group/card relative flex min-w-0 flex-col"
    >
      <div className="cc-media relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-secondary shadow-[0_1px_0_rgba(35,31,27,.04)]">
        <Link
          to={href}
          viewTransition
          aria-label={product.name}
          className="absolute inset-0 block"
          style={{ viewTransitionName: morphing ? "cc-product-media" : undefined }}
        >
          <span className="absolute inset-0 block transition-transform duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover/card:scale-[1.04]">
            <ProductCardPreview
              images={product.images}
              name={product.name}
              mainIndex={mainImageIndex}
              hovered={hovered}
            />
          </span>
        </Link>
        {badge && (
          <span className={`pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${badge.tone === "warning" ? "bg-[#fbf3e8] text-[#7d5233]" : "bg-white/95 text-muted-foreground"}`}>
            {badge.label}
          </span>
        )}
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={savedNow}
          aria-label={savedNow ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="cc-press absolute right-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition hover:bg-white"
        >
          <Heart key={heartPulse} size={17} fill={savedNow ? "currentColor" : "none"} className={`${savedNow ? "text-[#9a4f46]" : ""} ${heartPulse ? "cc-pop" : ""}`} />
        </button>
        <div className="absolute inset-x-3 bottom-3 hidden translate-y-[calc(100%+1rem)] gap-2 opacity-0 transition duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 [@media(hover:hover)]:flex">
          <button
            type="button"
            onClick={() => setQuickView(true)}
            className="cc-press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/95 text-xs font-semibold text-foreground shadow-md hover:bg-white"
          >
            <Eye size={15} /> Quick view
          </button>
          <button
            type="button"
            onClick={() => add(product.id)}
            disabled={outOfStock}
            title={outOfStock ? "Out of stock — product details are still available" : undefined}
            className="cc-press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground text-xs font-semibold text-background shadow-md hover:bg-[#35322e] disabled:cursor-not-allowed disabled:bg-white/90 disabled:text-muted-foreground"
          >
            {outOfStock ? <><CircleSlash2 size={15} /> Sold out</> : <><Plus size={15} /> Add to bag</>}
          </button>
        </div>
        <button
          type="button"
          onClick={() => add(product.id)}
          disabled={outOfStock}
          className="cc-press absolute bottom-2.5 right-2.5 grid h-11 w-11 place-items-center rounded-full bg-foreground text-background shadow-lg disabled:cursor-not-allowed disabled:bg-white/90 disabled:text-muted-foreground [@media(hover:hover)]:hidden"
          aria-label={outOfStock ? `${product.name} is out of stock` : `Add ${product.name} to bag`}
        >
          {outOfStock ? <CircleSlash2 size={16} /> : <Plus size={18} />}
        </button>
      </div>
      <div className="flex flex-1 flex-col px-0.5 pt-3.5">
        <p className="truncate text-[11px] font-medium uppercase tracking-[.12em] text-muted-foreground">
          {product.subcategory || subcategoryFor(product.id)}
        </p>
        <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">
          <Link to={href} viewTransition className="line-clamp-2 underline-offset-4 hover:underline">
            {product.name}
          </Link>
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-[15px] tabular-nums">{money(product.price)}</p>
          {product.reviews > 0 && <StarRating value={Number(product.rating)} count={product.reviews} size={11} />}
        </div>
        <button
          type="button"
          aria-pressed={compared}
          onClick={() => {
            const result = toggleComparedProduct(product.id);
            setCompared(result.ids.includes(product.id));
            setCompareNotice(
              result.limitReached
                ? "Compare up to four products. Remove one first."
                : result.added
                  ? "Added to comparison"
                  : "Removed from comparison",
            );
          }}
          className="mt-3 inline-flex min-h-8 w-fit items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label={compared ? `Remove ${product.name} from comparison` : `Compare ${product.name}`}
        >
          <span className={`grid h-4 w-4 place-items-center rounded-[5px] border transition-colors ${compared ? "border-foreground bg-foreground text-background" : "border-[#bdb4a7] bg-white"}`}>
            {compared && <Check size={11} strokeWidth={3} />}
          </span>
          {compared ? "Comparing" : "Compare"}
        </button>
        <p className={`text-[11px] font-semibold text-muted-foreground transition-opacity ${compareNotice ? "opacity-100" : "sr-only opacity-0"}`} role="status">
          {compareNotice}
        </p>
      </div>
      {quickView && (
        <QuickView
          product={product}
          open={quickView}
          onClose={() => setQuickView(false)}
          saved={savedNow}
          onToggleSaved={toggleSaved}
          onAdd={(quantity) => add(product.id, quantity)}
          money={money}
        />
      )}
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="cc-skeleton aspect-[4/5] rounded-[1.25rem]" />
      <div className="cc-skeleton mt-4 h-2.5 w-1/3 rounded-full" />
      <div className="cc-skeleton mt-3 h-4 w-3/4 rounded-full" />
      <div className="cc-skeleton mt-2.5 h-3.5 w-1/4 rounded-full" />
    </div>
  );
}

/** Responsive product grid with skeletons while the live catalog loads. */
export function ProductGrid({
  products,
  pending = false,
  skeletons = 8,
  className = "",
  columns = "standard",
}: {
  products: Product[];
  pending?: boolean;
  skeletons?: number;
  className?: string;
  columns?: "standard" | "large";
}) {
  const layout = columns === "large"
    ? "grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16"
    : "grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-14";
  return (
    <div className={`cc-reveal-grid grid ${layout} ${className}`} aria-busy={pending || undefined}>
      {pending
        ? Array.from({ length: skeletons }, (_, index) => <ProductCardSkeleton key={index} />)
        : products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}

export function Empty({
  title,
  text,
  cta,
  to,
  icon: Icon = Sparkles,
  secondary,
}: {
  title: string;
  text: string;
  cta: string;
  to: string;
  icon?: LucideIcon;
  secondary?: { label: string; to: string };
}) {
  return (
    <div className="cc-enter-up mt-10 grid min-h-[340px] place-items-center rounded-[2rem] border border-border bg-card px-6 py-14 text-center shadow-[var(--shadow-soft)]">
      <div className="max-w-md">
        <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-[#8d7863]">
          <Icon size={24} strokeWidth={1.75} />
        </span>
        <h2 className="mt-6 font-serif text-3xl leading-tight sm:text-4xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={to}
            className="cc-press inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background hover:bg-[#35322e]"
          >
            {cta} <ArrowRight size={15} />
          </Link>
          {secondary && (
            <Link to={secondary.to} className="cc-press inline-flex h-12 items-center rounded-full border border-border px-6 text-sm font-semibold hover:bg-secondary">
              {secondary.label}
            </Link>
          )}
        </div>
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
      data-state="open"
      className={`fixed inset-0 z-[100] grid place-items-center bg-black/45 p-5 backdrop-blur-sm ${isAdmin ? "" : "cc-backdrop"}`}
    >
      <div data-state="open" className={`w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl ${isAdmin ? "" : "cc-dialog"}`}>
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
            className={`flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold ${isAdmin ? "" : "cc-press hover:bg-secondary"}`}
          >
            Stay signed in
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background ${isAdmin ? "" : "cc-press"}`}
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
  color?: string;
  updatedAt?: string;
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

const toastErrorPattern = /could ?n[o’']?t|failed|unable|error|invalid|try again|not available|expired|declined|too many/i;

export function Toast({
  message,
  close,
  tone,
  action,
}: {
  message: string;
  close: () => void;
  tone?: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
}) {
  const [isLeaving, setIsLeaving] = useState(false);
  const closeRef = useRef(close);
  // The admin workspace keeps its original notification style and timing.
  const adminSurface = typeof document !== "undefined" && document.documentElement.dataset.surface === "admin";
  const resolvedTone = tone ?? (toastErrorPattern.test(message) ? "error" : "success");
  const lifetime = adminSurface ? 8000 : resolvedTone === "error" ? 8000 : action ? 7000 : 5000;

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    setIsLeaving(false);

    const fadeTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, adminSurface ? 7200 : lifetime - 400);
    const dismissTimer = window.setTimeout(() => {
      closeRef.current();
    }, lifetime);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [message, lifetime, adminSurface]);

  if (adminSurface) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-[calc(var(--mobile-store-nav-height)+.75rem)] left-3 right-3 z-[70] flex items-start gap-3 rounded-xl bg-[#201f1d] px-4 py-3 text-sm text-white shadow-xl transition-all duration-700 ease-out md:bottom-6 md:left-auto md:right-6 md:max-w-md md:items-center ${
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

  const Icon = resolvedTone === "error" ? CircleAlert : resolvedTone === "info" ? Info : Check;
  return (
    <div
      role={resolvedTone === "error" ? "alert" : "status"}
      aria-live={resolvedTone === "error" ? "assertive" : "polite"}
      className={`cc-enter-pop fixed bottom-[calc(var(--mobile-store-nav-height)+.75rem)] left-3 right-3 z-[170] flex items-center gap-3 rounded-2xl bg-[#201f1d] py-3 pl-3 pr-2 text-sm text-white shadow-[var(--shadow-overlay)] transition-all duration-500 ease-out md:bottom-6 md:left-auto md:right-6 md:w-[420px] ${
        isLeaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${resolvedTone === "error" ? "bg-[#6b3a31] text-[#f7d2c6]" : resolvedTone === "info" ? "bg-white/10" : "bg-[#3d4a37] text-[#cfe2c6]"}`}>
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1 break-words leading-5">{message}</span>
      {action && (
        <button type="button" onClick={() => { action.onClick(); close(); }} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold underline-offset-4 hover:bg-white/10 hover:underline">
          {action.label}
        </button>
      )}
      <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" aria-label="Dismiss notification" onClick={close}>
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
    <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#f4f2ee]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(207,188,161,.30),transparent_38%)]" />
      <div className="relative flex flex-col items-center text-center">
        <span className="cc-enter-fade mb-8 text-[10px] font-bold tracking-[.3em] text-muted-foreground">
          COZYCRAFT FURNITURES
        </span>
        <div className="cc-enter-pop">
          <Logo splash />
        </div>
        <div className="mt-8 h-px w-40 overflow-hidden rounded-full bg-[#dfd8ce]">
          <span className="cc-progress block h-px w-full bg-[#8d7863]" style={{ animationDuration: "1.4s" }} />
        </div>
        <p className="cc-enter-fade mt-5 text-[10px] font-bold tracking-[.26em] text-muted-foreground" style={{ animationDelay: "200ms" }}>
          PREPARING YOUR HOME EDIT
        </p>
        <p className="cc-enter-fade mt-2 font-serif text-sm italic text-muted-foreground/80" style={{ animationDelay: "350ms" }}>
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
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-signin-title"
      data-state="open"
      className="cc-backdrop fixed inset-x-0 bottom-0 top-[76px] z-[120] grid place-items-center overflow-y-auto bg-black/45 p-3 backdrop-blur-sm sm:p-5"
    >
      <section data-state="open" className="cc-dialog max-h-[calc(100dvh-6.25rem)] w-full max-w-sm overflow-y-auto rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-overlay)]">
        <div className="relative overflow-hidden bg-[#292a26] p-7 text-[#f7f3eb]">
          <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_80%_30%,rgba(194,162,123,.35),transparent_60%)]" />
          <button
            onClick={close}
            aria-label="Close sign-in prompt"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
          <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
            <LockKeyhole size={19} />
          </span>
          <p className="relative mt-5 text-[11px] font-bold tracking-[.18em] text-white/60">
            MEMBERS SHOPPING
          </p>
          <h2 id="shop-signin-title" className="relative mt-2 font-serif text-3xl">
            Please sign in to shop.
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm leading-6 text-muted-foreground">
            Create an account or sign in to save favorites, add pieces to your
            bag, and track future orders.
          </p>
          <a
            href={`/login?next=${next}`}
            className="cc-press mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background hover:bg-[#35322e]"
          >
            Sign in to continue
          </a>
          <a
            href="/signup"
            className="cc-press mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
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
import { ShoppingConnection } from "@/components/ShoppingConnection";
