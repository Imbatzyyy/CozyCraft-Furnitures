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
  useRouteError,
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
  type DbProduct,
  type DbRole,
  type DbSupportTicket,
} from "@/lib/supabase";


import {
  AdminSessionContext,
  type AdminRole,
  type Address,
  type CartLine,
  type ManagedProduct,
  type Product,
  ShopSignInPrompt,
  Splash,
  type Store,
  StoreContext,
  useStore,
  fallbackProducts,
} from "./core";
import { checkoutSignature, selectCheckoutLines } from "../lib/checkout";
import {
  defaultStoreSettings,
  normalizeStoreSettings,
  type PublicStoreSettings,
} from "@/lib/store-settings";

const splashSessionKey = "cozycraft-welcome-seen";
const publicAvatarPathMarker = "/storage/v1/object/public/avatars/";

function avatarObjectPath(value: string | null | undefined) {
  if (!value) return null;
  const markerIndex = value.indexOf(publicAvatarPathMarker);
  if (markerIndex >= 0) {
    return decodeURIComponent(
      value.slice(markerIndex + publicAvatarPathMarker.length).split("?")[0],
    );
  }
  return /^https?:\/\//i.test(value) ? null : value;
}

async function privateAvatarUrl(value: string | null | undefined) {
  if (!value) return null;
  const path = avatarObjectPath(value);
  if (!path) return value;
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

function App() {
  const [splash, setSplash] = useState(
    () => window.sessionStorage.getItem(splashSessionKey) !== "1",
  );
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [storeSettings, setStoreSettings] = useState<PublicStoreSettings>(
    defaultStoreSettings,
  );
  useEffect(() => {
    document.title = storeSettings.store_name || "CozyCraft Furnitures";
  }, [storeSettings.store_name]);
  const [adminProducts, setAdminProducts] = useState<Product[]>(fallbackProducts);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileGender, setProfileGender] = useState("");
  const [profileBirth, setProfileBirth] = useState("");
  const [profilePaymentMethod, setProfilePaymentMethod] =
    useState<"cod">("cod");
  const [hasPassword, setHasPassword] = useState(false);
  const [role, setRole] = useState<DbRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<
    DbCustomerProfile[]
  >([]);
  const [supportTickets, setSupportTickets] = useState<DbSupportTicket[]>([]);
  const [adminRole, setAdminRole] = useState<AdminRole>("Staff");
  const [shopPrompt, setShopPrompt] = useState(false);
  const [fly, setFly] = useState<FlyState | null>(null);

  useEffect(() => {
    // A returning session may finish restoring after the customer taps a
    // shopping action. Never leave the guest prompt mounted for a signed-in
    // customer, because its backdrop would otherwise intercept navigation.
    if (userId) setShopPrompt(false);
  }, [userId]);
  const lastPointer = useRef({ x: 0, y: 0 });
  const pendingAccountWrites = useRef(new Set<Promise<unknown>>());

  const queueAccountWrite = useCallback((request: PromiseLike<unknown>) => {
    const pending = Promise.resolve(request);
    pendingAccountWrites.current.add(pending);
    void pending.finally(() => pendingAccountWrites.current.delete(pending));
    return pending;
  }, []);

  useEffect(() => {
    const rememberPointer = (event: PointerEvent) => {
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointerdown", rememberPointer, true);
    return () => window.removeEventListener("pointerdown", rememberPointer, true);
  }, []);

  const triggerFly = (kind: FlyState["kind"]) => {
    setFly({ kind, ...lastPointer.current, id: Date.now() });
  };

  const mapProduct = useCallback((row: DbProduct, lowStockThreshold = 8): Product => ({
    id: row.id,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    price: Number(row.price),
    rating: Number(row.rating).toFixed(1),
    reviews: row.review_count,
    stock: row.stock_quantity === 0 ? "Out of stock" : row.stock_quantity <= lowStockThreshold ? "Low stock" : "In stock",
    stockQuantity: row.stock_quantity,
    status: row.status,
    color: row.color,
    material: row.material,
    dimensions: row.dimensions,
    description: row.description,
    images: row.images ?? [],
    mainImageIndex: row.main_image_index,
  }), []);

  const refreshProducts = useCallback(async () => {
    const [productResult, categoryResult, settingResult] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("name,active"),
      supabase
        .from("store_settings")
        .select("*")
        .eq("id", true)
        .single(),
    ]);
    if (productResult.error || !productResult.data) return;
    const normalizedSettings = normalizeStoreSettings(
      settingResult.data as Partial<PublicStoreSettings> | null,
    );
    setStoreSettings(normalizedSettings);
    const threshold = normalizedSettings.low_stock_threshold;
    const mapped = (productResult.data as DbProduct[]).map((row) =>
      mapProduct(row, threshold),
    );
    const activeCategories = new Set(
      (categoryResult.data ?? [])
        .filter((category) => category.active)
        .map((category) => category.name),
    );
    setAdminProducts(mapped);
    setProducts(
      mapped.filter(
        (item) =>
          item.status === "active" &&
          !(
            normalizedSettings.fulfillment_settings.out_of_stock_behavior ===
              "hide" && item.stockQuantity === 0
          ) &&
          (!activeCategories.size || activeCategories.has(item.category)),
      ),
    );
  }, [mapProduct]);

  const refreshOrders = useCallback(async () => {
    const loadOrders = () => supabase
      .from("orders")
      .select(
        "*, order_items(*), order_status_history(*), profiles!orders_user_id_fkey(full_name,email,phone)",
      )
      .order("created_at", { ascending: false });
    let { data, error } = await loadOrders();
    const pendingOnlineOrderIds = (data ?? [])
      .filter(
        (order) =>
          order.payment_status === "pending" &&
          ["card", "gcash"].includes(order.payment_method),
      )
      .map((order) => order.id);
    if (!error && pendingOnlineOrderIds.length) {
      const { data: syncResult } = await supabase.functions.invoke(
        "sync-paymongo-payments",
        { body: { orderIds: pendingOnlineOrderIds } },
      );
      if (Number(syncResult?.synchronized) > 0) {
        ({ data, error } = await loadOrders());
      }
    }
    if (!error) setOrders((data ?? []) as DbOrder[]);
  }, []);

  const refreshAccountCollections = useCallback(async (id: string) => {
    const [cartResult, wishlistResult] = await Promise.all([
      supabase
        .from("cart_items")
        .select("product_id, quantity, selected_for_checkout")
        .eq("user_id", id),
      supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("user_id", id),
    ]);
    if (!cartResult.error) {
      setCart(
        (cartResult.data ?? []).map((item) => ({
          id: item.product_id,
          quantity: item.quantity,
          selectedForCheckout: item.selected_for_checkout,
        })),
      );
    }
    if (!wishlistResult.error) {
      setSaved(
        (wishlistResult.data ?? []).map((item) => item.product_id),
      );
    }
  }, []);

  const refreshCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,phone,avatar_url,username,gender,date_of_birth,preferred_payment_method,role,created_at,addresses!addresses_user_id_fkey(*),orders!orders_user_id_fkey(id,order_number,status,payment_status,total,created_at),support_tickets!support_tickets_user_id_fkey(id,ticket_number,status,created_at)",
      )
      .eq("role", "customer")
      .order("created_at", { ascending: false });
    if (!error) {
      const protectedProfiles = await Promise.all(
        ((data ?? []) as DbCustomerProfile[]).map(async (profile) => ({
          ...profile,
          avatar_url: await privateAvatarUrl(profile.avatar_url),
        })),
      );
      setCustomerProfiles(protectedProfiles);
    }
  }, []);

  const refreshTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "*, profiles!support_tickets_user_id_fkey(full_name,email)",
      )
      .order("created_at", { ascending: false });
    if (!error) setSupportTickets((data ?? []) as DbSupportTicket[]);
  }, []);

  const loadAccount = useCallback(async (
    id: string,
    email: string | null,
    metadata: Record<string, unknown> = {},
  ) => {
    let profileResult = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    for (const retryDelay of [150, 350]) {
      if (!profileResult.error && profileResult.data?.role) break;
      await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
      profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
    }
    const [cartResult, wishlistResult, addressResult, passwordStatusResult] = await Promise.all([
      supabase
        .from("cart_items")
        .select("product_id, quantity, selected_for_checkout")
        .eq("user_id", id),
      supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("user_id", id),
      supabase
        .from("addresses")
        .select("*")
        .eq("user_id", id)
        .order("is_primary", { ascending: false }),
      supabase.rpc("current_user_has_password"),
    ]);
    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession();
    if (activeSession?.user.id !== id) return;
    const profile = profileResult.data;
    if (profileResult.error || !profile?.role) {
      setUserId(null);
      setUser(null);
      setUserEmail(null);
      setRole(null);
      return;
    }
    const accountRole = (profile.role as DbRole) ?? "customer";
    if (isStaffRole(accountRole) && profile.staff_active === false) {
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    setUserId(id);
    setUserEmail(email);
    setUser(profile?.full_name || email?.split("@")[0] || "Member");
    setRole((profile?.role as DbRole) ?? "customer");
    setAvatarPath(profile?.avatar_url ?? null);
    setAvatar(await privateAvatarUrl(profile?.avatar_url));
    setProfilePhone(profile?.phone ?? "");
    setProfileUsername(profile?.username ?? String(metadata.username ?? ""));
    setProfileGender(profile?.gender ?? String(metadata.gender ?? ""));
    // The profile row is the source of truth for birthdays. Auth metadata can
    // outlive an earlier signup-flow mistake, so never use it as a fallback.
    setProfileBirth(profile?.date_of_birth ?? "");
    setProfilePaymentMethod(profile?.preferred_payment_method ?? "cod");
    setHasPassword(
      !passwordStatusResult.error && passwordStatusResult.data === true,
    );
    setCart((cartResult.data ?? []).map((item) => ({
      id: item.product_id,
      quantity: item.quantity,
      selectedForCheckout: item.selected_for_checkout,
    })));
    setSaved((wishlistResult.data ?? []).map((item) => item.product_id));
    setAddresses((addressResult.data ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      name: item.recipient_name,
      mobile: item.mobile,
      email: item.email,
      line: item.address_line,
      barangay: item.barangay,
      city: item.city,
      province: item.province,
      postal: item.postal_code,
      note: item.delivery_note,
      primary: item.is_primary,
    })));
    await Promise.all([
      refreshOrders(),
      refreshProducts(),
      refreshTickets(),
      ...(accountRole === "admin" || accountRole === "superadmin"
        ? [refreshCustomers()]
        : []),
    ]);
  }, [refreshCustomers, refreshOrders, refreshProducts, refreshTickets]);

  useEffect(() => {
    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadAccount(
          session.user.id,
          session.user.email ?? null,
          session.user.user_metadata ?? {},
        );
      }
      else await refreshProducts();
      setAuthReady(true);
    };
    void hydrate();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" &&
        window.location.pathname !== "/reset-password"
      ) {
        window.location.replace("/reset-password");
        return;
      }
      if (session?.user) setAuthReady(false);
      window.setTimeout(() => {
        if (session?.user) {
          void loadAccount(
            session.user.id,
            session.user.email ?? null,
            session.user.user_metadata ?? {},
          ).finally(() => setAuthReady(true));
        }
        else {
          setUserId(null); setUser(null); setUserEmail(null); setRole(null);
          setAvatar(null); setAvatarPath(null); setProfilePhone(""); setProfileUsername("");
          setProfileGender(""); setProfileBirth(""); setHasPassword(false);
          setProfilePaymentMethod("cod");
          setCart([]); setSaved([]); setAddresses([]); setOrders([]);
          setCustomerProfiles([]); setSupportTickets([]);
          void refreshProducts();
          setAuthReady(true);
        }
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, [loadAccount, refreshProducts]);

  useEffect(() => {
    if (!userId) return;
    const refreshCurrentAccess = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== userId) return;
      await loadAccount(
        currentUser.id,
        currentUser.email ?? null,
        currentUser.user_metadata ?? {},
      );
    };
    const channel = supabase
      .channel(`current-profile-access-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        () => void refreshCurrentAccess(),
      )
      .subscribe();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCurrentAccess();
    }, 10_000);
    const refreshOnFocus = () => void refreshCurrentAccess();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [loadAccount, userId]);

  useEffect(() => {
    setAdminRole(
      role === "superadmin"
        ? "Super Administrator"
        : role === "admin"
          ? "Administrator"
          : "Staff",
    );
  }, [role]);

  useEffect(() => {
    const timer = splash
      ? window.setTimeout(() => {
          window.sessionStorage.setItem(splashSessionKey, "1");
          setSplash(false);
        }, 1500)
      : undefined;
    const channel = supabase
      .channel("cozycraft-live-commerce")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => void refreshProducts())
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => void refreshProducts())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_settings" }, () => void refreshProducts())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "DELETE" && typeof payload.old?.id === "string") {
          setOrders((current) => current.filter((order) => order.id !== payload.old.id));
          return;
        }
        void refreshOrders();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => void refreshOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_status_history" }, () => void refreshOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void refreshCustomers())
      .on("postgres_changes", { event: "*", schema: "public", table: "addresses" }, () => void refreshCustomers())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => { void refreshTickets(); void refreshCustomers(); })
      .subscribe();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [refreshCustomers, refreshOrders, refreshProducts, refreshTickets]);

  useEffect(() => {
    if (!userId) return;

    const syncOrders = () => void refreshOrders();
    const syncVisibleOrders = () => {
      if (document.visibilityState === "visible") syncOrders();
    };
    const interval = window.setInterval(syncVisibleOrders, 15_000);

    window.addEventListener("focus", syncOrders);
    document.addEventListener("visibilitychange", syncVisibleOrders);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncOrders);
      document.removeEventListener("visibilitychange", syncVisibleOrders);
    };
  }, [refreshOrders, userId]);

  useEffect(() => {
    if (!userId) return;

    const syncCollections = () => {
      void refreshAccountCollections(userId);
    };
    const syncVisibleCollections = () => {
      if (document.visibilityState === "visible") syncCollections();
    };
    const channel = supabase
      .channel(`account-commerce-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${userId}`,
        },
        syncCollections,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wishlist_items",
          filter: `user_id=eq.${userId}`,
        },
        syncCollections,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") syncCollections();
      });
    const interval = window.setInterval(syncVisibleCollections, 10_000);

    window.addEventListener("focus", syncCollections);
    document.addEventListener("visibilitychange", syncVisibleCollections);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncCollections);
      document.removeEventListener("visibilitychange", syncVisibleCollections);
      void supabase.removeChannel(channel);
    };
  }, [refreshAccountCollections, userId]);

  useEffect(() => {
    if (!userId) return;
    const stockByProduct = new Map(
      adminProducts.flatMap((product) =>
        typeof product.stockQuantity === "number"
          ? [[product.id, Math.max(0, product.stockQuantity)] as const]
          : [],
      ),
    );
    if (!stockByProduct.size) return;
    setCart((items) => {
      const next = items.flatMap((item) => {
        const limit = stockByProduct.get(item.id);
        if (limit === undefined) return [item];
        if (limit === 0) return [];
        return [{ ...item, quantity: Math.min(item.quantity, limit) }];
      });
      const changed =
        next.length !== items.length ||
        next.some((item, index) => item.quantity !== items[index]?.quantity);
      if (!changed) return items;
      const nextIds = new Set(next.map((item) => item.id));
      void queueAccountWrite(
        Promise.all([
          ...items
            .filter((item) => !nextIds.has(item.id))
            .map((item) =>
              supabase
                .from("cart_items")
                .delete()
                .eq("user_id", userId)
                .eq("product_id", item.id),
            ),
          ...next.map((item) =>
            supabase
              .from("cart_items")
              .upsert(
                {
                  user_id: userId,
                  product_id: item.id,
                  quantity: item.quantity,
                  selected_for_checkout: item.selectedForCheckout,
                },
                { onConflict: "user_id,product_id" },
              ),
          ),
        ]),
      );
      return next;
    });
  }, [adminProducts, queueAccountWrite, userId]);

  const reloadAddresses = async () => {
    const { data } = await supabase.from("addresses").select("*").order("is_primary", { ascending: false });
    setAddresses((data ?? []).map((item) => ({ id:item.id, label:item.label, name:item.recipient_name, mobile:item.mobile, email:item.email, line:item.address_line, barangay:item.barangay, city:item.city, province:item.province, postal:item.postal_code, note:item.delivery_note, primary:item.is_primary })));
  };

  const saveAddress = async (address: Address) => {
    if (!userId) return "Please sign in before saving an address.";
    if (!userEmail) return "Your account email is unavailable.";
    const payload = { user_id:userId, label:address.label, recipient_name:address.name, mobile:address.mobile, email:userEmail, address_line:address.line, barangay:address.barangay, city:address.city, province:address.province, postal_code:address.postal, delivery_note:address.note, is_primary:address.primary };
    const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(address.id);
    const { error } = isUuid
      ? await supabase.from("addresses").upsert({ id: address.id, ...payload })
      : await supabase.from("addresses").insert(payload);
    if (error) return error.message;
    await reloadAddresses();
    return null;
  };
  const deleteAddress = async (id: string) => { await supabase.from("addresses").delete().eq("id", id); await reloadAddresses(); };
  const setDefaultAddress = async (id: string) => {
    if (!userId) return;
    await supabase.from("addresses").update({ is_primary:false }).eq("user_id", userId);
    await supabase.from("addresses").update({ is_primary:true }).eq("id", id).eq("user_id", userId);
    await reloadAddresses();
  };

  const stockLimitFor = (id: string) => {
    const product =
      adminProducts.find((item) => item.id === id) ??
      products.find((item) => item.id === id);
    return typeof product?.stockQuantity === "number"
      ? Math.max(0, product.stockQuantity)
      : null;
  };

  const queueCartWrite = (
    request: PromiseLike<{ error: { message: string } | null }>,
  ) => {
    void queueAccountWrite(
      Promise.resolve(request).then(async ({ error }) => {
        if (error && userId) await refreshAccountCollections(userId);
      }),
    );
  };

  const add = (id: string, amount = 1) => {
    if (!authReady) return;
    if (!userId) {
      setShopPrompt(true);
      return;
    }
    const stockLimit = stockLimitFor(id);
    const current = cart.find((item) => item.id === id)?.quantity ?? 0;
    if (stockLimit === 0 || (stockLimit !== null && current >= stockLimit)) {
      return;
    }
    triggerFly("cart");
    setCart((items) => {
      const currentLine = items.find((item) => item.id === id);
      const currentQuantity = currentLine?.quantity ?? 0;
      const selectedForCheckout = currentLine?.selectedForCheckout ?? true;
      const requested = currentQuantity + Math.max(1, Math.floor(amount));
      const quantity =
        stockLimit === null ? requested : Math.min(requested, stockLimit);
      if (quantity === currentQuantity) return items;
      const next = currentQuantity
        ? items.map((item) =>
            item.id === id ? { ...item, quantity } : item,
          )
        : [...items, { id, quantity, selectedForCheckout }];
      queueCartWrite(
        supabase
          .from("cart_items")
          .upsert(
            {
              user_id: userId,
              product_id: id,
              quantity,
              selected_for_checkout: selectedForCheckout,
            },
            { onConflict: "user_id,product_id" },
          ),
      );
      return next;
    });
  };
  const remove = (id: string) => {
    setCart((items) => items.filter((x) => x.id !== id));
    if (userId) {
      queueCartWrite(
        supabase
          .from("cart_items")
          .delete()
          .eq("user_id", userId)
          .eq("product_id", id),
      );
    }
  };
  const qty = (id: string, value: number) => {
    if (value < 1) { remove(id); return; }
    const stockLimit = stockLimitFor(id);
    if (stockLimit === 0) { remove(id); return; }
    const requested = Math.max(1, Math.floor(value));
    const quantity =
      stockLimit === null ? requested : Math.min(requested, stockLimit);
    const selectedForCheckout =
      cart.find((item) => item.id === id)?.selectedForCheckout ?? true;
    setCart((items) =>
      items.map((item) =>
        item.id === id ? { ...item, quantity } : item,
      ),
    );
    if (userId) {
      queueCartWrite(
        supabase
          .from("cart_items")
          .upsert(
            {
              user_id: userId,
              product_id: id,
              quantity,
              selected_for_checkout: selectedForCheckout,
            },
            { onConflict: "user_id,product_id" },
          ),
      );
    }
  };
  const setCartSelection = (id: string, selected: boolean) => {
    setCart((items) =>
      items.map((item) =>
        item.id === id ? { ...item, selectedForCheckout: selected } : item,
      ),
    );
    if (userId) {
      queueCartWrite(
        supabase
          .from("cart_items")
          .update({ selected_for_checkout: selected })
          .eq("user_id", userId)
          .eq("product_id", id),
      );
    }
  };
  const setAllCartSelection = (selected: boolean) => {
    setCart((items) =>
      items.map((item) => ({ ...item, selectedForCheckout: selected })),
    );
    if (userId) {
      queueCartWrite(
        supabase
          .from("cart_items")
          .update({ selected_for_checkout: selected })
          .eq("user_id", userId),
      );
    }
  };
  const toggle = (id: string) => {
    if (!authReady) return;
    if (!userId) {
      setShopPrompt(true);
      return;
    }
    setSaved((items) => {
    const exists = items.includes(id);
    if (!exists) triggerFly("wishlist");
    void queueAccountWrite(
      exists
        ? supabase
            .from("wishlist_items")
            .delete()
            .eq("user_id", userId)
            .eq("product_id", id)
        : supabase
            .from("wishlist_items")
            .upsert(
              { user_id: userId, product_id: id },
              { onConflict: "user_id,product_id" },
            ),
    );
    return exists ? items.filter((x) => x !== id) : [...items, id];
    });
  };
  const clearCart = () => {
    setCart([]);
    if (userId) {
      void queueAccountWrite(
        supabase.from("cart_items").delete().eq("user_id", userId),
      );
    }
  };
  const signOut = async () => {
    await Promise.allSettled([...pendingAccountWrites.current]);
    if (userId) {
      const reconciliations: PromiseLike<unknown>[] = [];
      if (cart.length) {
        reconciliations.push(
          supabase.from("cart_items").upsert(
            cart.map((item) => ({
              user_id: userId,
              product_id: item.id,
              quantity: item.quantity,
              selected_for_checkout: item.selectedForCheckout,
            })),
            { onConflict: "user_id,product_id" },
          ),
        );
      }
      if (saved.length) {
        reconciliations.push(
          supabase.from("wishlist_items").upsert(
            saved.map((productId) => ({
              user_id: userId,
              product_id: productId,
            })),
            { onConflict: "user_id,product_id" },
          ),
        );
      }
      await Promise.allSettled(reconciliations.map((item) => Promise.resolve(item)));
    }
    await supabase.auth.signOut({ scope: "local" });
  };

  const placeOrder = async (
    addressId: string,
    paymentMethod: string,
    productIds?: string[],
  ) => {
    const { selected: orderCart, remaining: remainingCart } = selectCheckoutLines(cart, productIds);
    const signature = checkoutSignature(orderCart);
    const checkoutStorageKey = `cozycraft-checkout:${userId ?? "guest"}:${addressId}:${paymentMethod}:${signature}`;
    let checkoutKey = window.sessionStorage.getItem(checkoutStorageKey);
    if (!checkoutKey) {
      checkoutKey = crypto.randomUUID();
      window.sessionStorage.setItem(checkoutStorageKey, checkoutKey);
    }
    if (["card", "gcash"].includes(paymentMethod)) {
      const { data, error } = await supabase.functions.invoke(
        "create-paymongo-checkout",
        {
          body: {
            addressId,
            paymentMethod,
            checkoutKey,
            returnOrigin: window.location.origin,
            items: orderCart.map((item) => ({
              product_id: item.id,
              quantity: item.quantity,
            })),
          },
        },
      );
      if (error || data?.error) {
        return {
          id: null,
          orderNumber: null,
          checkoutUrl: null,
          error: data?.error ?? error?.message ?? "Unable to start secure payment.",
        };
      }
      if (userId && remainingCart.length) {
        await supabase.from("cart_items").upsert(
          remainingCart.map((item) => ({
            user_id: userId,
            product_id: item.id,
            quantity: item.quantity,
            selected_for_checkout: item.selectedForCheckout,
          })),
          { onConflict: "user_id,product_id" },
        );
      }
      setCart(remainingCart);
      window.sessionStorage.removeItem(checkoutStorageKey);
      await Promise.all([refreshOrders(), refreshProducts()]);
      return {
        id: data.orderId ?? null,
        orderNumber: data.orderNumber ?? null,
        checkoutUrl: data.checkoutUrl ?? null,
        error: null,
      };
    }
    if (paymentMethod !== "cod") {
      return { id: null, orderNumber: null, checkoutUrl: null, error: "Unsupported payment method." };
    }
    const { data, error } = await supabase.rpc("place_order", { p_address_id:addressId, p_payment_method:paymentMethod, p_items:orderCart.map((item) => ({ product_id:item.id, quantity:item.quantity })), p_checkout_key: checkoutKey });
    if (error) return { id:null, orderNumber:null, checkoutUrl:null, error:error.message };
    const orderId = data as string;
    const { data: createdOrder } = await supabase
      .from("orders")
      .select("order_number")
      .eq("id", orderId)
      .single();
    if (userId && remainingCart.length) {
      await supabase.from("cart_items").upsert(
        remainingCart.map((item) => ({
          user_id: userId,
          product_id: item.id,
          quantity: item.quantity,
          selected_for_checkout: item.selectedForCheckout,
        })),
      );
    }
    setCart(remainingCart);
    window.sessionStorage.removeItem(checkoutStorageKey);
    await Promise.all([refreshOrders(), refreshProducts()]);
    return {
      id: orderId,
      orderNumber: createdOrder?.order_number ?? null,
      checkoutUrl: null,
      error: null,
    };
  };
  const updateOrderStatus = async (id: string, status: DbOrder["status"]) => {
    if (status === "cancelled") {
      return "Use the protected cancellation workflow and provide a reason.";
    }
    const payload: Record<string, string> = { status };
    const order = orders.find((item) => item.id === id);
    if (status === "delivered" && order?.payment_method === "cod") {
      payload.payment_status = "paid";
    }
    const { error } = await supabase.from("orders").update(payload).eq("id", id);
    if (!error) await refreshOrders();
    return error?.message ?? null;
  };
  const cancelOrder = async (id: string, reason: string) => {
    const { data, error } = await supabase.functions.invoke("cancel-order", {
      body: { orderId: id, reason },
    });
    if (error || data?.error) {
      return data?.error ?? error?.message ?? "Unable to cancel this order safely.";
    }
    await Promise.all([refreshOrders(), refreshProducts()]);
    return null;
  };
  const saveProduct = async (product: ManagedProduct) => {
    const id = product.id || product.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("products").upsert({ id, name:product.name, category:product.category, subcategory:product.subcategory, price:product.price, stock_quantity:product.quantity, status:product.status.toLowerCase(), images:product.images, main_image_index:product.main, material:product.material, dimensions:product.dimensions }, { onConflict:"id" });
    if (!error) await refreshProducts();
    return error?.message ?? null;
  };
  const deleteProduct = async (id: string) => { const { error } = await supabase.from("products").delete().eq("id", id); if (!error) await refreshProducts(); return error?.message ?? null; };
  const uploadProductImages = async (files: FileList) => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = Date.now() + "-" + crypto.randomUUID() + "-" + safeFileName(file.name);
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) continue;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };
  const uploadAvatar = async (file: File) => {
    if (!userId) {
      return { url: null, error: "Please sign in before uploading a photo." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: "Choose an image smaller than 5 MB." };
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return {
        url: null,
        error: "Choose a JPEG, PNG, or WebP image.",
      };
    }

    const path =
      userId +
      "/avatar-" +
      Date.now() +
      "-" +
      crypto.randomUUID() +
      "-" +
      safeFileName(file.name);
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      return {
        url: null,
        error: `Photo upload failed: ${uploadError.message}`,
      };
    }

    const { data: savedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: uploaded.path })
      .eq("id", userId)
      .select("avatar_url")
      .single();
    if (profileError || savedProfile?.avatar_url !== uploaded.path) {
      await supabase.storage.from("avatars").remove([uploaded.path]);
      return {
        url: null,
        error: `The photo uploaded, but the profile could not be updated: ${
          profileError?.message ?? "database verification failed"
        }`,
      };
    }

    const oldPath = avatarObjectPath(avatarPath);
    if (oldPath?.startsWith(userId + "/") && oldPath !== uploaded.path) {
      void supabase.storage.from("avatars").remove([oldPath]);
    }

    const signedUrl = await privateAvatarUrl(uploaded.path);
    if (!signedUrl) {
      return {
        url: null,
        error: "The photo was saved, but its private preview could not be created.",
      };
    }
    setAvatarPath(uploaded.path);
    setAvatar(signedUrl);
    setCustomerProfiles((profiles) =>
      profiles.map((profile) =>
        profile.id === userId
          ? { ...profile, avatar_url: signedUrl }
          : profile,
      ),
    );
    return { url: signedUrl, error: null };
  };
  const submitTicket = async (details: { message:string; category:DbSupportTicket["category"]; priority:DbSupportTicket["priority"]; orderId?:string; files?:File[] }) => {
    if (!userId) return "Please sign in first.";
    const message = details.message.trim();
    if (message.length < 10 || message.length > 4000) {
      return "Please describe your concern in 10 to 4,000 characters.";
    }
    const attachmentPaths:string[] = [];
    for (const file of (details.files ?? []).slice(0,3)) {
      if (file.size > 5*1024*1024 || !["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)) return "Attachments must be JPG, PNG, WebP, or PDF files no larger than 5 MB.";
      const path=`${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error:uploadError }=await supabase.storage.from("support-attachments").upload(path,file);
      if(uploadError)return `Could not upload ${file.name}: ${uploadError.message}`;
      attachmentPaths.push(path);
    }
    const { error } = await supabase.from("support_tickets").insert({ user_id:userId, message, category:details.category, priority:details.priority, order_id:details.orderId||null, subject:`${details.category.charAt(0).toUpperCase()+details.category.slice(1)} support request`, attachment_paths:attachmentPaths });
    if (error && attachmentPaths.length) {
      await supabase.storage.from("support-attachments").remove(attachmentPaths);
    }
    if (!error) await refreshTickets();
    return error?.message ?? null;
  };
  const replyToTicket = async (
    id: string,
    reply: string,
    status: DbSupportTicket["status"] = "in_progress",
  ) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ admin_reply: reply, status })
      .eq("id", id);
    if (!error) {
      await Promise.all([refreshTickets(), refreshCustomers()]);
    }
    return error?.message ?? null;
  };
  const updateTicketStatus = async (
    id: string,
    status: DbSupportTicket["status"],
  ) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", id);
    if (!error) {
      await Promise.all([refreshTickets(), refreshCustomers()]);
    }
    return error?.message ?? null;
  };

  const saveProfile = async (details: {
    fullName: string;
    phone: string;
    username: string;
    gender: string;
    birth: string;
  }) => {
    if (!userId) return "Please sign in first.";
    const normalizedUsername = details.username.trim();
    if (!normalizedUsername) return "Username is required.";
    const attributes = {
      data: {
        full_name: details.fullName,
        username: normalizedUsername,
        gender: details.gender,
        date_of_birth: details.birth,
      },
    };
    const { error: authError } = await supabase.auth.updateUser(attributes);
    if (authError) return authError.message;
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: details.fullName,
        phone: details.phone,
        username: normalizedUsername,
        gender: details.gender,
        date_of_birth: details.birth || null,
        preferred_payment_method: "cod",
      })
      .eq("id", userId);
    if (profileError) return profileError.message;
    setUser(details.fullName);
    setProfilePhone(details.phone);
    setProfileUsername(normalizedUsername);
    setProfileGender(details.gender);
    setProfileBirth(details.birth);
    setProfilePaymentMethod("cod");
    return null;
  };
  const requestEmailChange = useCallback(async (email: string) => {
    const { error } = await supabase.auth.updateUser(
      { email },
      {
        emailRedirectTo: `${window.location.origin}/profile?email-change=confirmed`,
      },
    );
    return error?.message ?? null;
  }, []);
  const confirmEmailChange = useCallback(
    async (expectedEmail: string) => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return { confirmed: false, error: error.message };
      const activeEmail = data.user?.email?.toLowerCase() ?? "";
      if (activeEmail !== expectedEmail.toLowerCase()) {
        return { confirmed: false, error: null };
      }
      if (userId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ email: activeEmail })
          .eq("id", userId);
        if (profileError) {
          return { confirmed: false, error: profileError.message };
        }
      }
      setUserEmail(activeEmail);
      return { confirmed: true, error: null };
    },
    [userId],
  );
  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    if (hasPassword) {
      if (!userEmail) return "Your account email is unavailable.";
      const { error: verificationError } =
        await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword,
        });
      if (verificationError) return "Your current password is incorrect.";
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (!error) setHasPassword(true);
    return error?.message ?? null;
  };
  const requestPasswordSetup = async () => {
    if (!userEmail) return "Your account email is unavailable.";
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-password?mode=setup`,
    });
    return error?.message ?? null;
  };

  const store: Store = {
    storeSettings,
    products,
    adminProducts,
    cart,
    saved,
    userId,
    user,
    userEmail,
    profilePhone,
    profileUsername,
    profileGender,
    profileBirth,
    profilePaymentMethod,
    hasPassword,
    role,
    authReady,
    avatar,
    addresses,
    orders,
    customerProfiles,
    supportTickets,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    add,
    remove,
    qty,
    setCartSelection,
    setAllCartSelection,
    toggle,
    signOut,
    setAvatar,
    clearCart,
    refreshOrders,
    refreshCustomers,
    refreshTickets,
    placeOrder,
    updateOrderStatus,
    cancelOrder,
    saveProduct,
    deleteProduct,
    uploadProductImages,
    uploadAvatar,
    submitTicket,
    replyToTicket,
    updateTicketStatus,
    saveProfile,
    requestEmailChange,
    confirmEmailChange,
    changePassword,
    requestPasswordSetup,
  };
  return (
    <StoreContext.Provider value={store}>
      <AdminSessionContext.Provider
        value={{ role: adminRole, setRole: setAdminRole }}
      >
        {splash ? <Splash /> : <RouterProvider router={router} />}
        {!splash && <UsernameSetupGate />}
        {shopPrompt && (
          <ShopSignInPrompt close={() => setShopPrompt(false)} />
        )}
        {fly && <FlyToNav fly={fly} done={() => setFly(null)} />}
      </AdminSessionContext.Provider>
    </StoreContext.Provider>
  );
}

function UsernameSetupGate() {
  const { authReady, userId, user, role, profileUsername, profilePhone, profileGender, profileBirth, saveProfile, storeSettings } = useStore();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!authReady || !userId || role !== "customer" || profileUsername.trim() || !storeSettings.account_settings.username_required) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized=username.trim();
    if(!/^[A-Za-z0-9._-]{3,24}$/.test(normalized)){setError("Use 3–24 letters, numbers, dots, underscores, or hyphens.");return;}
    setSaving(true); setError("");
    const issue=await saveProfile({fullName:user??"Member",phone:profilePhone,username:normalized,gender:profileGender,birth:profileBirth});
    setSaving(false);
    if(issue)setError(issue.includes("duplicate")||issue.includes("unique")?"That username is already taken. Try another.":issue);
  };
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#25221f]/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="username-setup-title"><form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-border bg-card p-7 shadow-2xl"><span className="grid h-11 w-11 place-items-center rounded-full bg-secondary"><UserRound size={19}/></span><p className="mt-5 text-[10px] font-bold tracking-[.18em] text-muted-foreground">COMPLETE YOUR ACCOUNT</p><h2 id="username-setup-title" className="mt-2 font-serif text-4xl">Choose your username.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">This is the name shown in CozyCraft’s account menu. Your Google name remains saved as your personal name.</p><label className="mt-6 grid gap-2 text-sm font-semibold">Username<input autoFocus value={username} onChange={event=>setUsername(event.target.value.replace(/[^A-Za-z0-9._-]/g,"").slice(0,24))} minLength={3} maxLength={24} autoComplete="username" placeholder="cozyhome" className="h-12 rounded-xl border border-border bg-background px-4 font-normal"/></label>{error&&<p className="mt-3 rounded-xl bg-[#f3e5d4] p-3 text-xs font-semibold text-[#8b5c46]">{error}</p>}<button disabled={saving||username.trim().length<3} className="mt-5 w-full rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">{saving?"Saving username…":"Continue to CozyCraft"}</button><p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">Usernames are unique and may be changed later from your profile.</p></form></div>;
}

type FlyState = {
  kind: "cart" | "wishlist";
  x: number;
  y: number;
  id: number;
};

function FlyToNav({ fly, done }: { fly: FlyState; done: () => void }) {
  const [travel, setTravel] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setTravel(false);
    const target = document.getElementById(
      fly.kind === "cart" ? "cart-nav-target" : "wishlist-nav-target",
    );
    const origin = {
      x: fly.x || window.innerWidth / 2,
      y: fly.y || window.innerHeight / 2,
    };
    if (target) {
      const rect = target.getBoundingClientRect();
      setOffset({
        x: rect.left + rect.width / 2 - origin.x,
        y: rect.top + rect.height / 2 - origin.y,
      });
    }
    const frame = window.requestAnimationFrame(() => setTravel(true));
    const timer = window.setTimeout(done, 720);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [done, fly]);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none fixed z-[120] grid h-10 w-10 place-items-center rounded-full bg-foreground text-background shadow-xl transition-[transform,opacity] duration-700 ease-in-out"
      style={{
        left: fly.x - 20,
        top: fly.y - 20,
        transform: travel
          ? `translate(${offset.x}px,${offset.y}px) scale(.35)`
          : "translate(0,0) scale(1)",
        opacity: travel ? 0.35 : 1,
      }}
    >
      {fly.kind === "cart" ? (
        <ShoppingBag size={18} />
      ) : (
        <Heart size={18} fill="currentColor" />
      )}
    </span>
  );
}

const storefrontCatalogRoute = async (name: string) => {
  const pages = await import("./features/storefront/catalog");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

const storefrontCommerceRoute = async (name: string) => {
  const pages = await import("./features/storefront/commerce");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

const storefrontAuthRoute = async (name: string) => {
  const pages = await import("./features/storefront/auth");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

const storefrontProfileRoute = async (name: string) => {
  const pages = await import("./features/storefront/profile");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

const adminShellRoute = async (name: string) => {
  const pages = await import("./features/admin/shell");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

const adminCatalogRoute = async (name: string) => {
  const pages = await import("./features/admin/catalog");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

const adminOperationsRoute = async (name: string) => {
  const pages = await import("./features/admin/operations");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

const adminTeamRoute = async (name: string) => {
  const pages = await import("./features/admin/team-settings");
  return { Component: pages[name as keyof typeof pages] as React.ComponentType };
};

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : String(error ?? "");
  useEffect(() => {
    void supabase.rpc("report_client_error", {
      p_message: message || "Unknown route error",
      p_stack: error instanceof Error ? error.stack ?? "" : "",
      p_path: window.location.pathname + window.location.search,
      p_context: "route_boundary",
      p_user_agent: window.navigator.userAgent,
    });
  }, [error, message]);
  const isDeploymentUpdate =
    /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(
      message,
    );
  return (
    <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eee8df]">
          <Archive size={20} />
        </div>
        <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
          {isDeploymentUpdate ? "WEBSITE UPDATED" : "TEMPORARY INTERRUPTION"}
        </p>
        <h1 className="mt-2 font-serif text-4xl">
          {isDeploymentUpdate
            ? "A fresh version is ready."
            : "Let’s get you back inside."}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {isDeploymentUpdate
            ? "CozyCraft was updated while this page was open. Refresh once to continue with the newest version."
            : "The page could not finish loading. Your account and saved information are safe."}
        </p>
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem("cozycraft-deployment-reload");
            window.location.reload();
          }}
          className="mt-7 w-full rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background"
        >
          Refresh CozyCraft
        </button>
        <a
          href="/home"
          className="mt-4 inline-block text-xs font-semibold underline underline-offset-4"
        >
          Return to home
        </a>
      </section>
    </main>
  );
}

const router = createBrowserRouter([
  { path: "/", lazy: () => storefrontCatalogRoute("Home") },
  { path: "/home", lazy: () => storefrontCatalogRoute("Home") },
  { path: "/about", lazy: () => storefrontCatalogRoute("About") },
  { path: "/collections/:room", lazy: () => storefrontCatalogRoute("CollectionPage") },
  { path: "/living-room", lazy: () => storefrontCatalogRoute("CollectionPage") },
  { path: "/bedroom", lazy: () => storefrontCatalogRoute("CollectionPage") },
  { path: "/dining-room", lazy: () => storefrontCatalogRoute("CollectionPage") },
  { path: "/new-arrivals", lazy: () => storefrontCatalogRoute("CollectionPage") },
  { path: "/products/:productId", lazy: () => storefrontCatalogRoute("ProductPage") },
  { path: "/cart", lazy: () => storefrontCommerceRoute("Cart") },
  {
    path: "/checkout",
    lazy: async () => {
      const { Checkout, CheckoutErrorBoundary } = await import(
        "./features/storefront/commerce"
      );
      return {
        Component: Checkout,
        ErrorBoundary: CheckoutErrorBoundary,
      };
    },
  },
  { path: "/wishlist", lazy: () => storefrontCommerceRoute("Wishlist") },
  { path: "/orders", lazy: () => storefrontCommerceRoute("CustomerOrders") },
  {
    path: "/login",
    lazy: async () => {
      const { Account } = await import("./features/storefront/auth");
      return { Component: () => <Account mode="login" /> };
    },
  },
  {
    path: "/signup",
    lazy: async () => {
      const { Account } = await import("./features/storefront/auth");
      return { Component: () => <Account mode="signup" /> };
    },
  },
  { path: "/reset-password", lazy: () => storefrontAuthRoute("ResetPassword") },
  { path: "/profile", lazy: () => storefrontProfileRoute("Profile") },
  { path: "/admin/login", lazy: () => adminShellRoute("AdminLogin") },
  { path: "/admin/setup-account", lazy: () => adminShellRoute("AdminSetupAccount") },
  { path: "/admin", lazy: () => adminOperationsRoute("Admin") },
  { path: "/admin/team", lazy: () => adminTeamRoute("TeamAccessPage") },
  { path: "/admin/products", lazy: () => adminCatalogRoute("ProductManager") },
  { path: "/admin/products/new", lazy: () => adminCatalogRoute("ProductManager") },
  { path: "/admin/categories", lazy: () => adminCatalogRoute("CategoriesPage") },
  { path: "/admin/inventory", lazy: () => adminCatalogRoute("InventoryPage") },
  { path: "/admin/orders", lazy: () => adminOperationsRoute("OrdersWorkspacePage") },
  { path: "/admin/payments", lazy: () => adminOperationsRoute("PaymentsPage") },
  { path: "/admin/customers", lazy: () => adminOperationsRoute("CustomersPage") },
  { path: "/admin/reviews", lazy: () => adminOperationsRoute("ReviewsPage") },
  { path: "/admin/reports", lazy: () => adminOperationsRoute("ReportsPage") },
  { path: "/admin/activity-logs", lazy: () => adminOperationsRoute("ActivityLogsPage") },
  { path: "/admin/support", lazy: () => adminOperationsRoute("SupportPage") },
  { path: "/admin/settings", lazy: () => adminTeamRoute("StoreSettingsPage") },
  { path: "*", lazy: () => storefrontCatalogRoute("Home") },
].map((route) => ({ ...route, errorElement: <RouteErrorBoundary /> })));

export default App;
