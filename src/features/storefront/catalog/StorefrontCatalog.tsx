import { localStore } from "@/lib/shared/browser-storage";
import { DataPagination } from "@/components/DataPagination";
import { createRefreshScheduler } from "@/lib/admin/refresh-scheduler";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";
import { withReadDeadline } from "@/lib/shared/read-deadline";
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
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
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
  Clock3,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Grid2X2,
  Heart,
  HelpCircle,
  ImagePlus,
  LayoutDashboard,
  List,
  LockKeyhole,
  Mail,
  MapPin,
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
  Share2,
  Ruler,
  ZoomIn,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Square,
  RotateCcw,
  Star,
  Tag,
  Truck,
  Trash2,
  Upload,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { ResilientImage } from "@/components/media/ResilientImage";
import { ProductMeasurements } from "@/components/catalog/ProductMeasurements";
import { measurementCm } from "@/lib/catalog/product-quality";
import { selectNewArrivals } from "@/lib/catalog/new-arrivals";
import {
  filterByPriceRange,
  STOREFRONT_MAX_PRICE,
} from "@/lib/catalog/price-range";
import {
  catalogValuesMatch,
  matchesCatalogSubcategory,
  rankCatalogSearch,
} from "@/lib/catalog/discovery";
import cozyCraftLogo from "@/assets/branding/cozycraft-logo.png";
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
} from "@/services/supabase/client";
import {
  parseDimensionSpecs,
  parseMaterialSpecs,
} from "@/lib/catalog/product-specs";
import { primaryProductImage, productMainImageIndex } from "@/lib/catalog/product-images";
import { exactStockAvailability, friendlyAvailability } from "@/lib/catalog/stock-availability";
import { sortProducts, type ProductSort } from "@/lib/catalog/sort-products";
import {
  managedSectionTitle,
  parseManagedSections,
  type ManagedContentSection,
} from "@/lib/content/managed-sections";
import {
  clearContentCache,
  getContentPage,
  getHomepageBanners,
  type ContentPage,
  type HomepageBanner,
} from "@/services/content/content.service";
import {
  COMPARE_CHANGE_EVENT,
  readComparedProductIds,
  toggleComparedProduct,
  writeComparedProductIds,
} from "@/lib/catalog/compare";
import {
  deliveryDateRange,
  deliveryFeeFor,
  type DeliveryServiceArea,
} from "@/lib/catalog/delivery";
import {
  expandCatalogQuery,
  getDeliveryServiceAreas,
  getProductAlerts,
  getSearchSynonyms,
  recordCatalogSearch,
  setProductAlert,
  type SearchSynonym,
} from "@/services/catalog/experience.service";
import { subscribeToNewsletter } from "@/services/content/newsletter.service";
import { roomCollections, subcategoryProductMap } from "@/lib/catalog/room-collections";
import { journalEntries, findJournalEntry } from "./journal";
import { SlidingIndicator, useSlidingIndicator } from "@/components/storefront/SlidingIndicator";
import { StarRating } from "@/components/storefront/StarRating";
import { prefersReducedMotion as prefersReducedMotionNow, usePresence, useReducedMotion, useStickyHold } from "@/components/storefront/motion";
import { usePageTitle } from "@/components/storefront/page-meta";

import {
  Product,
  fallbackProducts,
  CartLine,
  Address,
  Store,
  StoreContext,
  AdminRole,
  AdminSession,
  AdminSessionContext,
  useAdminSession,
  money,
  materialFor,
  subcategoryFor,
  useStore,
  Logo,
  Header,
  Layout,
  ProductCard,
  ProductGrid,
  ProductCardSkeleton,
  Empty,
  ConfirmSignOut,
  Status,
  ManagedProduct,
  Toast,
  Metric,
  Splash,
  ShopSignInPrompt
} from "@/app/core";


type HomeReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewer_display_name: string;
  product_id: string;
};

const editTabs = [
  { key: "popular", label: "Customer favourites" },
  { key: "newest", label: "New in" },
  { key: "rating", label: "Top rated" },
  { key: "value", label: "Under ₱10,000" },
] as const;

export function Home() {
  const { products, catalogPending, storeSettings } = useStore();
  const [editTab, setEditTab] = useState<(typeof editTabs)[number]["key"]>("popular");
  const editProducts = useMemo(() => {
    if (editTab === "value") return sortProducts(products.filter((product) => product.price <= 10_000), "popular").slice(0, 8);
    return sortProducts(products, editTab).slice(0, 8);
  }, [editTab, products]);
  const { containerRef: editTabsRef, indicatorStyle: editIndicator } = useSlidingIndicator<HTMLDivElement>(editTab);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<
    "idle" | "submitting" | "confirmation_sent" | "already_subscribed" | "confirmed" | "unsubscribed" | "error"
  >("idle");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [homeReviews, setHomeReviews] = useState<HomeReview[]>([]);

  useEffect(() => {
    const preference = new URLSearchParams(window.location.search).get("newsletter");
    if (preference === "confirmed" || preference === "already-confirmed") {
      setNewsletterState("confirmed");
      setNewsletterMessage(
        preference === "confirmed"
          ? "You’re confirmed. Thoughtful CozyCraft updates will now reach your inbox."
          : "This email subscription is already confirmed.",
      );
    } else if (preference === "unsubscribed") {
      setNewsletterState("unsubscribed");
      setNewsletterMessage("You’ve been unsubscribed. You can join again whenever you like.");
    } else if (preference === "invalid-link" || preference === "unavailable") {
      setNewsletterState("error");
      setNewsletterMessage(
        preference === "invalid-link"
          ? "This newsletter link is invalid or has already been used."
          : "We couldn’t update your newsletter preference just now. Please try again shortly.",
      );
    }
  }, []);

  useEffect(() => {
    // A handful of published reviews for social proof, cached per tab session.
    const cacheKey = "cozycraft-home-reviews-v1";
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(cacheKey) ?? "null") as HomeReview[] | null;
      if (Array.isArray(cached)) {
        setHomeReviews(cached);
        return;
      }
    } catch { /* Storage may be unavailable; fall through to a live read. */ }
    let active = true;
    void supabase
      .from("reviews")
      .select("id,rating,title,body,reviewer_display_name,product_id")
      .eq("approved", true)
      .gte("rating", 4)
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!active || error) return;
        const rows = ((data ?? []) as HomeReview[]).filter((row) => (row.body ?? "").trim().length >= 24).slice(0, 6);
        setHomeReviews(rows);
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(rows)); } catch { /* optional cache */ }
      });
    return () => { active = false; };
  }, []);

  const joinNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newsletterState === "submitting") return;
    setNewsletterState("submitting");
    setNewsletterMessage("");
    const result = await subscribeToNewsletter(newsletterEmail);
    if (!result.ok) {
      setNewsletterState("error");
      setNewsletterMessage(result.message);
      return;
    }
    setNewsletterState(result.status);
    setNewsletterMessage(
      result.status === "already_subscribed"
        ? "You’re already on the CozyCraft list."
        : "One last step: open the confirmation email we just sent you.",
    );
  };
  const fallbackSlides = [
    {
      eyebrow: "THE 2026 COLLECTION",
      title: "Furniture that makes home feel complete.",
      copy: "Considered pieces for the rooms that carry your everyday rituals.",
      image:
        "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?auto=format&fit=crop&w=1800&q=88",
      action: "Shop the collection",
    },
    {
      eyebrow: "THE LIVING EDIT",
      title: "Room to settle into.",
      copy: "Soft forms, honest materials, and a slower point of view for the everyday living room.",
      image:
        "https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1800&q=88",
      action: "Explore living room",
      path: "/living-room",
    },
    {
      eyebrow: "NEW ARRIVALS",
      title: "A softer shape of modern.",
      copy: "Discover new pieces made to grow more beautiful with each season at home.",
      image:
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=88",
      action: "Discover the edit",
      path: "/new-arrivals",
    },
  ];
  const [managedSlides, setManagedSlides] = useState<HomepageBanner[]>([]);
  useEffect(() => {
    const load = () => {
      void getHomepageBanners(true)
        .then(setManagedSlides)
        .catch(() => undefined);
    };
    load();
    const channel = supabase
      .channel("storefront-homepage-banners")
      .on("postgres_changes", { event: "*", schema: "public", table: "homepage_banners" }, () => {
        clearContentCache();
        load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);
  const slides = managedSlides.length
    ? managedSlides.map((banner) => ({
        eyebrow: banner.eyebrow,
        title: banner.title,
        copy: banner.subtitle,
        image: banner.image_url,
        action: banner.cta_label,
        path: banner.cta_path === "#shop" ? "/shop" : banner.cta_path,
      }))
    : fallbackSlides.map((slide) => ({ ...slide, path: slide.path ?? "/shop" }));
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const touchStart = useRef<number | null>(null);
  const slideDuration = 7000;
  const activeIndex = active % Math.max(1, slides.length);
  useEffect(() => {
    if (reducedMotion || paused || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      setActive((value) => (value + 1) % slides.length);
      setCycle((value) => value + 1);
    }, slideDuration);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, paused, slides.length, activeIndex, cycle]);
  useEffect(() => {
    const visibility = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  const slide = slides[activeIndex];
  useEffect(() => {
    if (slides.length < 2) return;
    const nextImage = new Image();
    nextImage.src = slides[(activeIndex + 1) % slides.length].image;
  }, [activeIndex, slides]);
  const goTo = (index: number) => {
    setActive((index + slides.length) % slides.length);
    setCycle((value) => value + 1);
  };
  const roomCount = (room: string) => products.filter((product) => catalogValuesMatch(product.category, room)).length;
  const ratedProducts = products.filter((product) => product.reviews > 0);
  const reviewTotal = ratedProducts.reduce((sum, product) => sum + product.reviews, 0);
  const averageRating = reviewTotal
    ? ratedProducts.reduce((sum, product) => sum + Number(product.rating) * product.reviews, 0) / reviewTotal
    : 0;
  const reviewedProduct = (id: string) => products.find((product) => product.id === id);
  const rooms = [
    { key: "living-room", title: "Living room", text: "Sofas, tables & quiet corners", image: "https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1200&q=85", span: "md:col-span-6 md:row-span-2" },
    { key: "bedroom", title: "Bedroom", text: "Rest, made considered", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85", span: "md:col-span-6" },
    { key: "dining-room", title: "Dining room", text: "Gather beautifully", image: "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=900&q=85", span: "md:col-span-6" },
  ] as const;
  return (
    <Layout immersive>
      <main>
        <section aria-roledescription="carousel" aria-label="Featured collections">
          <div
            className="relative min-h-[100svh] overflow-hidden bg-[#171614]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              touchStart.current = null;
              const end = event.changedTouches[0]?.clientX;
              if (start === null || end === undefined || Math.abs(end - start) < 50) return;
              goTo(activeIndex + (end < start ? 1 : -1));
            }}
          >
            {slides.map((item, index) => (
              <div
                key={item.image + index}
                aria-hidden={index !== activeIndex}
                className={`absolute inset-0 transition-opacity duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
              >
                <ResilientImage
                  key={index === activeIndex ? `active-${cycle}` : "idle"}
                  src={item.image}
                  alt={index === activeIndex ? item.title : ""}
                  loading={index === 0 ? "eager" : "lazy"}
                  {...(index === 0 ? { fetchpriority: "high" } : {})}
                  sizes="100vw"
                  className={`absolute inset-0 h-full w-full object-cover ${index === activeIndex && !reducedMotion ? "cc-kenburns" : ""}`}
                />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />
            <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-black/35 to-transparent" />
            <div className="relative mx-auto flex min-h-[100svh] max-w-[1440px] flex-col justify-end px-6 pb-[calc(var(--mobile-store-nav-height)+6.5rem)] pt-32 text-[#f8f6f1] sm:px-14 md:pb-32">
              <div key={`${activeIndex}-${cycle}`} className="max-w-3xl" aria-live="polite">
                <div className="cc-rise mb-6 flex items-center gap-3" style={{ ["--i" as string]: 0 }}>
                  <span className="h-px w-10 bg-[#d6c1a5]" />
                  <p className="text-[11px] font-bold tracking-[.24em] text-[#f4eadf]">
                    {slide.eyebrow}
                  </p>
                </div>
                <h1 className="cc-rise max-w-[15ch] font-serif text-[clamp(2.9rem,8.4vw,6.4rem)] leading-[.95] tracking-[-.025em]" style={{ ["--i" as string]: 1 }}>
                  {slide.title}
                </h1>
                <div className="cc-rise mt-7 flex max-w-xl items-start gap-5" style={{ ["--i" as string]: 2 }}>
                  <span className="mt-2 hidden h-8 w-px bg-white/55 sm:block" />
                  <p className="text-[15px] leading-7 text-white/85">
                    {slide.copy}
                  </p>
                </div>
                <div className="cc-rise mt-9 flex flex-wrap items-center gap-3 sm:gap-4" style={{ ["--i" as string]: 3 }}>
                  <Link
                    to={slide.path}
                    className="cc-press group inline-flex h-12 items-center gap-2 rounded-full bg-[#f6f2eb] px-6 text-sm font-semibold text-foreground hover:bg-white"
                  >
                    {slide.action}
                    <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
                  </Link>
                  <Link to="/find-my-furniture" className="cc-press inline-flex h-12 items-center rounded-full border border-white/60 px-6 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/10">
                    Find my furniture
                  </Link>
                </div>
              </div>
            </div>
            {slides.length > 1 && (
              <div className="absolute inset-x-6 bottom-[calc(var(--mobile-store-nav-height)+1.75rem)] flex items-center justify-between gap-6 text-white sm:left-14 sm:right-28 md:bottom-10">
                <div className="flex min-w-0 max-w-[calc(100%-4.5rem)] flex-1 items-center gap-4 sm:max-w-none">
                  <span className="font-mono text-[11px] tabular-nums">{String(activeIndex + 1).padStart(2, "0")}</span>
                  <div className="flex max-w-[280px] flex-1 gap-2">
                    {slides.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => goTo(index)}
                        aria-label={`Show slide ${index + 1} of ${slides.length}`}
                        aria-current={index === activeIndex ? "true" : undefined}
                        className="group relative h-6 flex-1"
                      >
                        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full bg-white/30 transition group-hover:bg-white/50">
                          {index === activeIndex && (
                            <span
                              key={`${cycle}-${paused}`}
                              className={`absolute inset-0 rounded-full bg-white ${reducedMotion || paused ? "" : "cc-progress"}`}
                              style={{ animationDuration: `${slideDuration}ms` }}
                            />
                          )}
                          {index < activeIndex && <span className="absolute inset-0 rounded-full bg-white/70" />}
                        </span>
                      </button>
                    ))}
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-white/60">{String(slides.length).padStart(2, "0")}</span>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => goTo(activeIndex - 1)}
                    className="cc-press grid h-11 w-11 place-items-center rounded-full border border-white/50 bg-black/15 backdrop-blur-sm hover:bg-white hover:text-foreground"
                    aria-label="Previous hero slide"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(activeIndex + 1)}
                    className="cc-press grid h-11 w-11 place-items-center rounded-full border border-white/50 bg-black/15 backdrop-blur-sm hover:bg-white hover:text-foreground"
                    aria-label="Next hero slide"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section id="collections" className="mx-auto max-w-[1440px] scroll-mt-24 px-5 py-16 lg:px-10 lg:py-28">
          <div data-reveal className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">SHOP BY ROOM</p>
              <h2 className="mt-4 font-serif text-4xl tracking-[-.02em] sm:text-5xl lg:text-6xl">Begin with a feeling.</h2>
            </div>
            <Link to="/shop" className="cc-underline hidden shrink-0 text-sm font-semibold sm:inline-block">
              Shop all pieces
            </Link>
          </div>
          <div className="cc-no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-12 md:grid-rows-2 md:gap-4 md:overflow-visible md:px-0">
            {rooms.map((room, index) => (
              <Link
                key={room.key}
                to={`/${room.key}`}
                data-reveal
                style={{ ["--reveal-delay" as string]: index * 110 }}
                className={`group relative h-[420px] w-[80%] shrink-0 snap-start overflow-hidden rounded-[1.75rem] bg-secondary sm:w-[58%] md:h-auto md:min-h-[270px] md:w-auto lg:min-h-[300px] ${room.span}`}
              >
                <ResilientImage
                  src={room.image}
                  alt=""
                  sizes="(max-width: 768px) 80vw, 50vw"
                  className="absolute inset-0 h-full w-full object-cover transition duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.06]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
                <span className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4 text-white">
                  <span>
                    <span className="block text-[11px] font-bold tracking-[.18em] text-white/70">{roomCount(room.title)} PIECES</span>
                    <span className="mt-2 block font-serif text-3xl sm:text-4xl">{room.title}</span>
                    <span className="mt-1 block text-sm text-white/80">{room.text}</span>
                  </span>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur-md transition duration-500 group-hover:bg-white group-hover:text-foreground">
                    <ArrowUpRight size={18} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="shop" className="border-y border-border bg-card">
          <div className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-28">
            <div data-reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">THE EDIT</p>
                <h2 className="mt-4 font-serif text-4xl tracking-[-.02em] sm:text-5xl lg:text-6xl">Designed to be lived with.</h2>
              </div>
              <div
                ref={editTabsRef}
                role="tablist"
                aria-label="Filter the edit"
                className="cc-no-scrollbar relative -mx-5 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:rounded-full lg:border lg:border-border lg:bg-background lg:p-1"
              >
                <SlidingIndicator style={editIndicator} className="rounded-full bg-foreground" />
                {editTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={editTab === tab.key}
                    data-active={editTab === tab.key}
                    onClick={() => setEditTab(tab.key)}
                    className={`relative z-10 h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-xs font-semibold transition-colors duration-300 ${editTab === tab.key ? "text-background" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div key={editTab} className="mt-10">
              {editProducts.length || catalogPending ? (
                <ProductGrid products={editProducts} pending={catalogPending} />
              ) : (
                <p className="rounded-2xl bg-secondary p-8 text-center text-sm text-muted-foreground">New pieces for this edit are on their way.</p>
              )}
            </div>
            <div className="mt-14 flex justify-center">
              <Link
                to="/shop"
                className="cc-press group inline-flex h-12 items-center gap-2 rounded-full border border-foreground/80 px-6 text-sm font-semibold hover:bg-foreground hover:text-background"
              >
                Shop all {products.length || ""} pieces <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        <section id="new" className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-28">
          <div data-reveal="scale" className="grid overflow-hidden rounded-[2rem] bg-[#cbb8a1] shadow-[0_14px_36px_rgba(35,31,27,.10)] lg:grid-cols-2">
            <div className="flex min-h-[380px] flex-col justify-between gap-10 p-8 sm:p-14">
              <div>
                <p className="text-[11px] font-bold tracking-[.2em]">
                  THE NEW ARRIVALS
                </p>
                <h2 className="mt-5 max-w-md font-serif text-4xl leading-[1.02] tracking-[-.02em] sm:text-5xl lg:text-6xl">
                  Just landed, made to stay.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-7 text-foreground/75">The newest shapes and finishes in the collection, chosen for how they will look in five years, not five minutes.</p>
              </div>
              <Link
                to="/new-arrivals"
                className="cc-underline inline-flex w-fit items-center gap-2 text-sm font-semibold [background-size:100%_1px] hover:[background-size:0_1px]"
              >
                Discover the edit <ArrowRight size={16} />
              </Link>
            </div>
            <div className="relative min-h-[320px] overflow-hidden lg:min-h-[480px]">
              <ResilientImage
                src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1100&q=85"
                alt="A neutral living room with new CozyCraft pieces"
                className="absolute inset-0 h-full w-full object-cover transition duration-[1600ms] hover:scale-105"
              />
            </div>
          </div>
        </section>

        <section className="bg-[#272421] text-[#f4f2ee]">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-28">
            <div data-reveal>
              <p className="text-[11px] font-bold tracking-[.2em] text-[#f4f2ee]/55">
                MATERIAL STUDY / 01
              </p>
              <h2 className="mt-6 font-serif text-4xl leading-[1.03] tracking-[-.02em] sm:text-5xl lg:text-6xl">
                Made to become part of the room.
              </h2>
              <p className="mt-6 max-w-md text-[15px] leading-8 text-[#f4f2ee]/70">
                We look for materials that soften, deepen, and earn their place
                over time. Natural timber, tactile fabric, and finishes chosen
                for the life that happens around them.
              </p>
            </div>
            <dl className="grid content-end gap-px overflow-hidden rounded-[1.5rem] bg-white/10 sm:grid-cols-3">
              {[
                [String(products.length || "—"), "pieces in the collection", "Across living, bedroom and dining rooms."],
                [averageRating ? averageRating.toFixed(1) : "New", averageRating ? "average customer rating" : "reviews opening soon", reviewTotal ? `From ${reviewTotal} verified reviews.` : "Verified buyers can review delivered orders."],
                [`${storeSettings.fulfillment_settings.estimated_delivery_days_min}–${storeSettings.fulfillment_settings.estimated_delivery_days_max}`, "day delivery estimate", "Careful delivery with order tracking."],
              ].map(([value, label, note], index) => (
                <div key={label} data-reveal style={{ ["--reveal-delay" as string]: index * 120 }} className="bg-[#272421] p-7">
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block font-serif text-5xl tabular-nums sm:text-6xl">{value}</span>
                    <span className="mt-3 block text-sm font-semibold text-white/85">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/55">{note}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {homeReviews.length > 0 && (
          <section className="mx-auto max-w-[1440px] px-5 py-20 lg:px-10 lg:py-28" aria-labelledby="home-reviews-title">
            <div data-reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">IN REAL HOMES</p>
                <h2 id="home-reviews-title" className="mt-4 font-serif text-4xl tracking-[-.02em] sm:text-5xl">Words from the people who live with it.</h2>
              </div>
              {averageRating > 0 && <StarRating value={averageRating} count={reviewTotal} size={15} showValue />}
            </div>
            <div className="cc-no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
              {homeReviews.slice(0, 3).map((review, index) => {
                const product = reviewedProduct(review.product_id);
                return (
                  <figure key={review.id} data-reveal style={{ ["--reveal-delay" as string]: index * 110 }} className="flex w-[85%] shrink-0 snap-start flex-col rounded-[1.75rem] border border-border bg-card p-7 shadow-[var(--shadow-soft)] sm:w-[60%] lg:w-auto">
                    <StarRating value={review.rating} size={14} />
                    {review.title && <p className="mt-5 font-serif text-2xl leading-snug">“{review.title}”</p>}
                    <blockquote className="mt-3 line-clamp-5 flex-1 text-sm leading-7 text-muted-foreground">{review.body}</blockquote>
                    <figcaption className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5 text-xs">
                      <span className="font-semibold">@{review.reviewer_display_name || "CozyCraft customer"}</span>
                      {product && <Link to={`/products/${product.id}`} className="truncate text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{product.name}</Link>}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        )}

        <section id="newsletter-story" className="mx-auto max-w-[1440px] px-5 pb-20 lg:px-10 lg:pb-28">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <div data-reveal="scale" className="relative h-[420px] overflow-hidden rounded-[2rem] shadow-[0_14px_36px_rgba(35,31,27,.10)] lg:h-[560px]">
              <ResilientImage
                src="https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1400&q=86"
                alt="A restful CozyCraft bedroom space"
                className="absolute inset-0 h-full w-full object-cover transition duration-[1600ms] hover:scale-105"
              />
            </div>
            <div data-reveal className="flex flex-col justify-between gap-10 rounded-[2rem] bg-secondary p-8 lg:p-10">
              <div>
                <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">
                  AT HOME WITH COZYCRAFT
                </p>
                <h2 className="mt-5 font-serif text-4xl leading-[1.06] tracking-[-.02em]">
                  The room is never finished. It simply grows with you.
                </h2>
              </div>
              <div>
                <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                  Find forms that let you pause, settle in, and make a little
                  more room for living.
                </p>
                <Link
                  to="/about"
                  className="cc-underline mt-6 inline-flex items-center gap-2 text-sm font-semibold [background-size:100%_1px] hover:[background-size:0_1px]"
                >
                  Our story <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-24">
            <div data-reveal>
              <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">
                FROM THE JOURNAL
              </p>
              <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.02] tracking-[-.02em] sm:text-5xl">
                Small notes on making a more personal home.
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {journalEntries.map((entry, index) => (
                <Link
                  key={entry.slug}
                  to={`/journal/${entry.slug}`}
                  data-reveal
                  style={{ ["--reveal-delay" as string]: index * 120 }}
                  className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-background"
                >
                  <span className="cc-media block aspect-[16/10] overflow-hidden bg-secondary">
                    <ResilientImage src={entry.image.replace("w=1800", "w=900")} alt="" className="h-full w-full object-cover transition duration-[1200ms] group-hover:scale-105" />
                  </span>
                  <span className="flex flex-1 flex-col p-6">
                    <span className="text-[11px] font-bold tracking-[.16em] text-muted-foreground">{entry.kicker}</span>
                    <span className="mt-3 font-serif text-2xl leading-snug">{entry.title}</span>
                    <span className="mt-auto inline-flex items-center gap-2 pt-6 text-xs font-semibold">
                      Read the note <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="newsletter" className="mx-auto max-w-[1440px] scroll-mt-28 px-5 py-20 lg:px-10 lg:py-28">
          <div data-reveal className="flex flex-col items-start justify-between gap-8 border-y border-foreground py-12 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">
                KEEP IN TOUCH
              </p>
              <h2 className="mt-4 max-w-xl font-serif text-4xl tracking-[-.02em] sm:text-5xl">
                New pieces and quieter ideas, sent occasionally.
              </h2>
            </div>
            <form className="w-full max-w-md" onSubmit={joinNewsletter} noValidate>
              <div
                className={`flex border-b transition-colors ${
                  newsletterState === "error"
                    ? "border-[#9a5e45]"
                    : "border-foreground focus-within:border-[#8c7357]"
                }`}
              >
                <input
                  type="email"
                  name="newsletter-email"
                  aria-label="Email address for CozyCraft updates"
                  aria-describedby="newsletter-status newsletter-privacy"
                  aria-invalid={newsletterState === "error"}
                  autoComplete="email"
                  inputMode="email"
                  value={newsletterEmail}
                  onChange={(event) => {
                    setNewsletterEmail(event.target.value);
                    if (newsletterState !== "submitting") {
                      setNewsletterState("idle");
                      setNewsletterMessage("");
                    }
                  }}
                  className="storefront-product-search-input h-14 min-w-0 flex-1 bg-transparent pr-4 text-base outline-none placeholder:text-muted-foreground"
                  placeholder="Your email address"
                />
                <button
                  type="submit"
                  disabled={newsletterState === "submitting"}
                  className="group inline-flex min-w-[5rem] items-center justify-end gap-1.5 text-sm font-semibold transition-opacity disabled:cursor-wait disabled:opacity-55"
                >
                  {newsletterState === "submitting"
                    ? "Joining…"
                    : newsletterState === "confirmation_sent" ||
                        newsletterState === "already_subscribed" ||
                        newsletterState === "confirmed"
                      ? <><Check size={15} /> Joined</>
                      : <>Join <ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></>}
                </button>
              </div>
              <p
                id="newsletter-status"
                role={newsletterState === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`mt-3 min-h-5 text-xs leading-relaxed ${
                  newsletterState === "error"
                    ? "text-[#8a563f]"
                    : "text-muted-foreground"
                }`}
              >
                {newsletterMessage}
              </p>
              <p
                id="newsletter-privacy"
                className="mt-1 text-xs leading-relaxed text-muted-foreground"
              >
                By selecting Join, you request occasional CozyCraft email updates. Unsubscribe whenever you like. <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>
              </p>
            </form>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export function Room({
  title,
  text,
  image,
  span,
}: {
  title: string;
  text: string;
  image: string;
  span: string;
}) {
  const to =
    title === "Living room"
      ? "/living-room"
      : title === "Bedroom"
        ? "/bedroom"
        : "/dining-room";
  return (
    <Link
      to={to}
      className={`group relative h-[340px] overflow-hidden rounded-[1.75rem] ${span}`}
    >
      <ResilientImage
        src={image}
        alt={title}
        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute inset-x-6 bottom-6 text-white">
        <h3 className="font-serif text-3xl">{title}</h3>
        <p className="mt-1 text-xs text-white/85">{text}</p>
      </div>
    </Link>
  );
}

export function StaticContentPage() {
  const slug = useLocation().pathname.replace(/^\//, "") || "contact";
  const [content, setContent] = useState<ContentPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contentError, setContentError] = useState("");
  const [contentAttempt, setContentAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let version = 0;
    setContent(getCachedContentPage(slug));
    setIsLoading(true);
    setContentError("");
    const load = (fresh = false) => {
      const request = ++version;
      void getContentPage(slug, fresh).then(value => {
        if (active && request === version) {
          setContent(value);
          setContentError(value ? "" : "This information is currently unavailable.");
        }
      }).catch(() => {
        if (active && request === version) setContentError("We couldn't load the latest information. Please check your connection and try again.");
      }).finally(() => { if (active && request === version) setIsLoading(false); });
    };
    load();
    const reconnect = () => load(true);
    window.addEventListener("online", reconnect);
    const channel = supabase.channel(`storefront-content-${slug}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "content_pages", filter: `slug=eq.${slug}` },
      () => { clearContentCache(slug); load(true); },
    ).subscribe();
    return () => { active = false; window.removeEventListener("online", reconnect); void supabase.removeChannel(channel); };
  }, [slug, contentAttempt]);
  const sections = useMemo(
    () => parseManagedSections(content?.body ?? ""),
    [content?.body],
  );
  const page = content ?? {
    slug,
    eyebrow: "COZYCRAFT",
    title: "Customer information",
    summary: "This page is being prepared by the CozyCraft team.",
    body: "",
    published: true,
    updated_at: new Date().toISOString(),
  };

  if (isLoading && !content) return <InformationPageLoading />;
  if (!content && contentError) return <Layout><main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16"><p className="text-xs font-semibold uppercase tracking-widest">CozyCraft help</p><h1 className="mt-4 font-serif text-3xl sm:text-5xl">Let's try that again.</h1><p role="alert" className="mt-5 leading-7">{contentError}</p><button type="button" onClick={() => setContentAttempt(value => value + 1)} className="mt-6 min-h-11 rounded-xl bg-foreground px-6 py-3 font-semibold text-background">Try again</button><Link to="/contact" className="ml-5 underline">Contact support</Link></main></Layout>;

  if (slug === "faq") {
    return <FaqInformationPage content={page} cachedWarning={contentError} retry={() => setContentAttempt(value => value + 1)} sections={sections.map(section => /how do reviews work/i.test(section.title) ? { ...section, body: 'Customers can review delivered products from their Orders page. Eligible reviews publish without an approval queue. Content that violates the review rules may be removed; legitimate negative feedback is not a reason for removal.' } : section)} />;
  }
  if (slug === "privacy" || slug === "terms") {
    return (
      <PrivacyInformationPage
        content={page}
        sections={sections}
        kind={slug}
      />
    );
  }
  return <ContactInformationPage content={page} sections={sections} cachedWarning={contentError} retry={() => setContentAttempt(value => value + 1)} />;
}

function CachedInformationNotice({ message, retry }: { message?: string; retry?: () => void }) {
  return message ? <aside role="status" className="border-b border-border bg-secondary px-5 py-3 text-center text-sm leading-6">Showing saved information. {message} <button type="button" className="ml-2 min-h-11 font-semibold underline" onClick={retry}>Try again</button></aside> : null;
}

function InformationPageLoading() {
  return (
    <Layout>
      <main className="min-h-[70vh] bg-[#f3f0e9] px-5 py-6 sm:px-7 lg:px-10 lg:py-10" aria-busy="true" aria-label="Loading customer information">
        <div className="mx-auto grid min-h-[520px] max-w-[1360px] animate-pulse overflow-hidden rounded-[2rem] border border-black/5 bg-[#e6e0d6] lg:grid-cols-[1.08fr_.92fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <div className="h-3 w-36 rounded-full bg-black/10" />
            <div className="mt-9 h-16 max-w-xl rounded-2xl bg-black/10 sm:h-24" />
            <div className="mt-5 h-16 max-w-lg rounded-2xl bg-black/5" />
            <div className="mt-10 h-12 w-48 rounded-full bg-black/10" />
          </div>
          <div className="border-t border-black/5 bg-[#d8c8ae] p-5 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <div className="h-full min-h-[300px] rounded-[1.6rem] bg-white/65" />
          </div>
        </div>
      </main>
    </Layout>
  );
}

function ContactInformationPage({
  content,
  sections,
  cachedWarning,
  retry,
}: {
  content: ContentPage;
  sections: ManagedContentSection[];
  cachedWarning?: string;
  retry?: () => void;
}) {
  const email =
    content.body.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ??
    "cozycraftfurnitures2026@gmail.com";
  const iconFor = (title: string) => {
    const key = title.toLocaleLowerCase("en-PH");
    if (key.includes("email")) return Mail;
    if (key.includes("hour")) return Clock3;
    if (key.includes("area")) return MapPin;
    return MessageCircle;
  };

  return (
    <Layout>
      <main className="min-h-[70vh] overflow-hidden bg-[#f3f0e9] text-[#1e1e1b]">
        <CachedInformationNotice message={cachedWarning} retry={retry} />
        <section className="mx-auto max-w-[1440px] px-5 pb-5 pt-6 sm:px-7 lg:px-10 lg:pb-10 lg:pt-10">
          <div className="grid overflow-hidden rounded-[2rem] border border-black/10 bg-[#22231f] text-white shadow-[0_26px_80px_rgba(32,30,25,.14)] lg:min-h-[510px] lg:grid-cols-[1.08fr_.92fr]">
            <div className="flex min-w-0 flex-col justify-between p-7 sm:p-10 lg:p-14">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.28em] text-[#d8c6aa]">
                  {content.eyebrow}
                </p>
                <h1 className="mt-7 max-w-[760px] font-serif text-[clamp(3rem,7vw,6.6rem)] leading-[.9] tracking-[-.055em]">
                  {content.title}
                </h1>
                <p className="mt-8 max-w-xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                  {content.summary}
                </p>
              </div>
              <div className="mt-12 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`mailto:${email}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#20211e] transition hover:bg-[#e8ddcc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#22231f]"
                >
                  Email customer care <ArrowRight size={16} />
                </a>
                <Link
                  to="/profile?tab=support"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/25 px-6 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <MessageCircle size={16} /> Track a support request
                </Link>
              </div>
            </div>

            <div className="relative min-h-[350px] border-t border-white/10 bg-[#d9c7ab] p-5 text-[#20211e] sm:p-8 lg:min-h-0 lg:border-l lg:border-t-0 lg:p-10">
              <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,#272720_1px,transparent_0)] [background-size:22px_22px]" />
              <div className="relative flex h-full flex-col justify-between rounded-[1.6rem] border border-black/10 bg-[#f8f6f1] p-6 shadow-[0_18px_50px_rgba(42,38,30,.12)] sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22231f] text-white">
                  <MessageCircle size={21} />
                </div>
                <div className="mt-12">
                  <p className="text-[11px] font-bold uppercase tracking-[.24em] text-black/45">
                    CozyCraft Care
                  </p>
                  <h2 className="mt-4 max-w-sm font-serif text-4xl leading-[1.02] tracking-[-.035em] sm:text-5xl">
                    Thoughtful help, from a real team.
                  </h2>
                  <p className="mt-5 max-w-md text-sm leading-7 text-black/58">
                    Tell us what you need and include your order number when your question is about a purchase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 pb-16 pt-5 sm:px-7 lg:px-10 lg:pb-24 lg:pt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sections.map((section, index) => {
              const Icon = iconFor(section.title);
              return (
                <article
                  key={`${section.title}-${index}`}
                  className="group min-w-0 rounded-[1.5rem] border border-black/10 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(38,35,30,.08)] sm:p-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eee7db] text-[#38372f]">
                      <Icon size={19} />
                    </span>
                    <span className="font-serif text-2xl text-black/18">0{index + 1}</span>
                  </div>
                  <h2 className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-black/78">
                    {section.title}
                  </h2>
                  <p className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-black/56">
                    {section.body}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </Layout>
  );
}

function FaqInformationPage({
  content,
  sections,
  cachedWarning,
  retry,
}: {
  content: ContentPage;
  sections: ManagedContentSection[];
  cachedWarning?: string;
  retry?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openTitle, setOpenTitle] = useState<string | null>(sections[0]?.title ?? null);
  const filtered = sections.filter((section) =>
    `${section.title} ${section.body}`
      .toLocaleLowerCase("en-PH")
      .includes(query.trim().toLocaleLowerCase("en-PH")),
  );

  useEffect(() => {
    if (sections.length && !sections.some((section) => section.title === openTitle)) {
      setOpenTitle(sections[0].title);
    }
  }, [openTitle, sections]);

  return (
    <Layout>
      <main className="min-h-[70vh] bg-[#faf9f6] text-[#20201d]">
        <CachedInformationNotice message={cachedWarning} retry={retry} />
        <section className="border-b border-black/10">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:px-7 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:items-end lg:px-10 lg:py-24">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
                <HelpCircle size={20} />
              </div>
              <p className="mt-8 text-[11px] font-bold uppercase tracking-[.28em] text-black/45">
                {content.eyebrow}
              </p>
            </div>
            <div>
              <h1 className="max-w-4xl font-serif text-[clamp(3.2rem,7vw,7rem)] leading-[.9] tracking-[-.055em]">
                {content.title}
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-black/55 sm:text-lg">
                {content.summary}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:px-7 lg:grid-cols-[330px_minmax(0,1fr)] lg:px-10 lg:py-20">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <label className="relative block">
              <span className="sr-only">Search frequently asked questions</span>
              <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-black/40" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for an answer"
                className="min-h-14 w-full rounded-full border border-black/10 bg-white py-3 pl-13 pr-5 text-sm outline-none transition placeholder:text-black/35 focus:border-black/35 focus:ring-4 focus:ring-black/5"
              />
            </label>
            <div className="mt-6 rounded-[1.5rem] bg-[#252621] p-6 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/45">
                Still curious?
              </p>
              <p className="mt-4 font-serif text-2xl leading-tight">
                CozyCraft Care can help with the details.
              </p>
              <Link
                to="/contact"
                className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-xs font-bold text-[#252621] transition hover:bg-[#e8ddcc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Contact us <ArrowRight size={14} />
              </Link>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex items-end justify-between gap-5 border-b border-black/10 pb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.22em] text-black/40">
                  Answers, clearly
                </p>
                <h2 className="mt-2 font-serif text-3xl tracking-[-.03em] sm:text-4xl">
                  What customers ask us.
                </h2>
              </div>
              <span className="shrink-0 text-sm text-black/45">{filtered.length} {filtered.length === 1 ? "result" : "results"}</span>
            </div>

            <div className="divide-y divide-black/10">
              {filtered.map((section, index) => {
                const isOpen = openTitle === section.title;
                const panelId = `faq-panel-${index}`;
                return (
                  <article key={section.title} className="py-2">
                    <button
                      type="button"
                      onClick={() => setOpenTitle(isOpen ? null : section.title)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="group flex min-h-20 w-full items-center gap-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-4"
                    >
                      <span className="hidden w-10 shrink-0 font-serif text-lg text-black/25 sm:block">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 text-base font-bold leading-6 sm:text-lg">
                        {managedSectionTitle(section.title)}
                      </span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white transition group-hover:bg-black group-hover:text-white">
                        <ChevronDown className={`transition duration-300 ${isOpen ? "rotate-180" : ""}`} size={17} />
                      </span>
                    </button>
                    <div
                      id={panelId}
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-3xl whitespace-pre-line pb-8 pl-0 pr-14 text-sm leading-7 text-black/58 sm:pl-14 sm:text-base sm:leading-8">
                          {section.body}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!filtered.length && (
              <div className="mt-8 rounded-[1.5rem] border border-dashed border-black/15 p-8 text-center">
                <p className="font-serif text-2xl">No matching question yet.</p>
                <p className="mt-2 text-sm text-black/50">Try a shorter phrase or contact CozyCraft Care.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
}

function PrivacyInformationPage({
  content,
  sections,
  kind,
}: {
  content: ContentPage;
  sections: ManagedContentSection[];
  kind: "privacy" | "terms";
}) {
  const isPrivacy = kind === "privacy";
  const lastUpdated = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeZone: "Asia/Manila",
  }).format(new Date(content.updated_at));

  return (
    <Layout>
      <main className="min-h-[70vh] bg-[#ede9e1] text-[#20201d]">
        <section className="mx-auto max-w-[1440px] px-5 py-6 sm:px-7 lg:px-10 lg:py-10">
          <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-[#e1d6c5] px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
            <div className="absolute -right-28 -top-36 h-[380px] w-[380px] rounded-full border-[70px] border-white/25" />
            <div className="relative max-w-5xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#20211e] text-white">
                {isPrivacy ? <ShieldCheck size={21} /> : <FileText size={21} />}
              </div>
              <p className="mt-9 text-[11px] font-bold uppercase tracking-[.28em] text-black/48">
                {content.eyebrow}
              </p>
              <h1 className="mt-5 max-w-4xl font-serif text-[clamp(3.2rem,7vw,7rem)] leading-[.9] tracking-[-.055em]">
                {content.title}
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-black/58 sm:text-lg">
                {content.summary}
              </p>
              <p className="mt-9 text-xs font-semibold text-black/48">Last updated {lastUpdated}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-8 px-5 pb-20 pt-6 sm:px-7 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-10 lg:pb-28 lg:pt-10">
          <aside className="h-fit rounded-[1.5rem] border border-black/10 bg-[#f8f6f1] p-6 lg:sticky lg:top-28">
            <p className="text-[11px] font-bold uppercase tracking-[.22em] text-black/40">On this page</p>
            <nav aria-label={`${isPrivacy ? "Privacy Policy" : "Terms of Use"} sections`} className="mt-5 space-y-1">
              {sections.map((section, index) => (
                <a
                  key={section.title}
                  href={`#legal-${index + 1}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-black/58 transition hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                >
                  <span className="text-xs text-black/28">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">{managedSectionTitle(section.title)}</span>
                </a>
              ))}
            </nav>
            <div className="mt-7 border-t border-black/10 pt-6">
              <LockKeyhole size={18} className="text-black/55" />
              <p className="mt-3 text-xs leading-6 text-black/48">
                Questions about this {isPrivacy ? "notice" : "agreement"} can be sent to CozyCraft Care.
              </p>
              <Link to="/contact" className="mt-3 inline-flex items-center gap-2 text-xs font-bold underline underline-offset-4">
                Contact us <ArrowRight size={13} />
              </Link>
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            {sections.map((section, index) => (
              <article
                id={`legal-${index + 1}`}
                key={section.title}
                className="scroll-mt-32 rounded-[1.5rem] border border-black/10 bg-[#f8f6f1] p-6 sm:p-8 lg:p-10"
              >
                <div className="grid gap-5 sm:grid-cols-[70px_minmax(0,1fr)]">
                  <span className="font-serif text-3xl text-black/20">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <h2 className="font-serif text-2xl leading-tight tracking-[-.02em] sm:text-3xl">
                      {managedSectionTitle(section.title)}
                    </h2>
                    <p className="mt-5 whitespace-pre-line break-words text-sm leading-7 text-black/58 sm:text-base sm:leading-8">
                      {section.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}

export function About() {
  const [content, setContent] = useState<ContentPage | null>(null);
  useEffect(() => {
    const load = () => void getContentPage("about", true).then(setContent).catch(() => undefined);
    load();
    const channel = supabase.channel("storefront-about-content").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "content_pages", filter: "slug=eq.about" },
      () => { clearContentCache("about"); load(); },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);
  const team = [
    {
      name: "Joylyn Campuso",
      role: "Product & Research",
      initials: "CJ",
      image: "/team/joylyn-campuso.jpg",
    },
    {
      name: "Jacob Christopher Cañete",
      role: "Platform Development",
      initials: "JC",
      image: "/team/jacob-christopher-canete.jpg",
    },
    {
      name: "Prince Balane",
      role: "Project Lead · Vision Ventures",
      initials: "PB",
      lead: true,
      image: "/team/prince-balane.jpg",
    },
    {
      name: "Angela Faith Suba",
      role: "Customer Experience",
      initials: "AS",
      image: "/team/angela-faith-suba.jpeg",
    },
    {
      name: "Hydee Mae Sumalinog",
      role: "Operations & Quality",
      initials: "HS",
      image: "/team/hydee-mae-sumalinog.jpg",
    },
  ];
  return (
    <Layout>
      <main>
        <section className="mx-auto max-w-[1440px] px-5 py-5 lg:px-10">
          <div className="relative min-h-[590px] overflow-hidden rounded-[2rem] bg-[#282924]">
            <ResilientImage
              src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=88"
              alt="A quiet CozyCraft living space"
              className="absolute inset-0 h-full w-full object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1d1d1a]/85 via-[#1d1d1a]/45 to-transparent" />
            <div className="relative flex min-h-[590px] max-w-3xl flex-col justify-end p-7 text-[#f7f3eb] sm:p-14">
              <p className="text-[11px] font-bold tracking-[.22em] text-[#dfd4c7]">
                {content?.eyebrow || "COZYCRAFT FURNITURES · EST. 2026"}
              </p>
              <h1 className="mt-5 font-serif text-5xl leading-[1.02] sm:text-7xl">
                {content?.title || "Your home starts with the perfect furniture."}
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#e3dcd2]">
                {content?.summary || "A more convenient, reliable way to discover, order, and bring home pieces made for everyday living."}
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1120px] px-5 py-18 lg:py-24">
          <div data-reveal className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">
                OUR BACKGROUND
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-tight">
                Built to make furnishing feel simpler.
              </h2>
            </div>
            <div className="max-w-2xl text-sm leading-7 text-muted-foreground">
              <p>
                {content?.body || <>CozyCraft Furnitures was founded in 2026 by Vision
                Ventures—Prince Balane, Joylyn Campuso, Jacob Christopher
                Cañete, Angela Faith Suba, and Hydee Mae Sumalinog—with the
                project led by Prince Balane.</>}
              </p>
              <p className="mt-5">
                We created CozyCraft to make furniture shopping convenient,
                accessible, and organized for homeowners. The platform addresses
                familiar online-shopping friction: manual Facebook-message
                ordering, disconnected inventory monitoring, limited payment
                options, missing order visibility, and hand-prepared sales
                records.
              </p>
            </div>
          </div>
        </section>
        <section className="bg-[#eee8df]">
          <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">
                  THE COZYCRAFT PLATFORM
                </p>
                <h2 className="mt-4 max-w-2xl font-serif text-4xl">
                  One considered journey, from discovery to delivery.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                CozyCraft is a B2C e-commerce furniture store for living rooms,
                bedrooms, and dining rooms—available through web and mobile.
              </p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-[#d5ccbe] sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "01",
                  "Discover",
                  "Search detailed furniture information and explore pieces by room.",
                ],
                [
                  "02",
                  "Choose",
                  "Save favorites, add items to bag, and checkout with flexible payment options.",
                ],
                [
                  "03",
                  "Track",
                  "Follow every order from confirmation and preparation to shipped, out for delivery, and delivered.",
                ],
                [
                  "04",
                  "Manage",
                  "A connected admin workspace keeps products, inventory, customers, orders, and reports organized.",
                ],
              ].map(([number, title, copy]) => (
                <article data-reveal key={number} className="bg-[#f7f4ee] p-6">
                  <p className="font-mono text-xs text-muted-foreground">
                    {number}
                  </p>
                  <h3 className="mt-10 font-serif text-2xl">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1120px] px-5 py-18 lg:py-24">
          <div data-reveal className="grid gap-10 lg:grid-cols-[1fr_.8fr]">
            <div>
              <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">
                WHAT MAKES US DIFFERENT
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-tight">
                Quality furniture, convenience, and care—on one platform.
              </h2>
            </div>
            <p className="self-end text-sm leading-7 text-muted-foreground">
              With an efficient order-management system for customers and
              administrators, CozyCraft makes the experience smooth from the
              first saved piece through dependable delivery. We are here to help
              customers build a comfortable, stylish home with confidence.
            </p>
          </div>
        </section>
        <section className="bg-[#292a26] text-[#f7f3eb]">
          <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[.2em] text-[#c9c0b3]">
                  VISION VENTURES
                </p>
                <h2 className="mt-4 font-serif text-4xl">Meet the team.</h2>
              </div>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {team.map((member) => (
                <article data-reveal
                  key={member.name}
                  className={`rounded-2xl border p-4 ${member.lead ? "border-[#c8ae8b] bg-[#3a3934] lg:col-span-1" : "border-white/10 bg-white/5"}`}
                >
                  {member.image ? (
                    <ResilientImage
                      src={member.image}
                      alt={`${member.name}, ${member.role}`}
                      className="aspect-square w-full rounded-xl bg-[#d4c3aa] object-cover object-top"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-xl bg-[#d4c3aa] font-serif text-4xl text-[#292a26]">
                      {member.initials}
                    </div>
                  )}
                  <p className="mt-5 text-sm font-semibold">{member.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#c9c0b3]">
                    {member.role}
                  </p>
                  {member.lead && (
                    <span className="mt-4 inline-block rounded-full border border-[#c8ae8b]/60 px-2 py-1 text-[10px] font-bold tracking-[.12em] text-[#d8c3a6]">
                      TEAM LEADER
                    </span>
                  )}
                  {!member.image && (
                    <p className="mt-4 text-[11px] text-[#9f988f]">
                      Photo placeholder
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
        <section data-reveal className="mx-auto max-w-[1120px] px-5 py-20 text-center">
          <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">
            THE COZYCRAFT PROMISE
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight">
            Make home furnishing simple, enjoyable, and dependable.
          </h2>
          <Link
            to="/home#shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
          >
            Find your perfect piece <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    </Layout>
  );
}

export { roomCollections, subcategoryProductMap } from "@/lib/catalog/room-collections";

type CollectionFilters = {
  group: string;
  type: string;
  q: string;
  stock: string;
  material: string;
  min: number;
  max: number;
  sort: ProductSort;
};

const productSorts: Array<[ProductSort, string]> = [
  ["featured", "Featured"],
  ["newest", "Newest"],
  ["popular", "Most popular"],
  ["rating", "Highest rated"],
  ["price-low", "Price: low to high"],
  ["price-high", "Price: high to low"],
  ["name-asc", "Name: A to Z"],
  ["name-desc", "Name: Z to A"],
];
const materialOptions = ["Wood", "Fabric", "Metal", "Stone", "Leather"];
const materialAliases: Record<string, string[]> = {
  Wood: ["wood", "oak", "ash", "walnut", "veneer", "hardwood", "timber"],
  Fabric: ["fabric", "linen", "upholstery", "weave", "bouclé", "velvet"],
  Metal: ["metal", "steel", "brass", "aluminium", "aluminum"],
  Stone: ["stone", "marble", "travertine", "granite"],
  Leather: ["leather"],
};
const stockOptions: Array<[string, string]> = [["all", "All"], ["in-stock", "In stock"], ["low-stock", "Only a few left"]];
const gridDensityKey = "cozycraft-grid-density";

const readCollectionFilters = (search: string): CollectionFilters => {
  const params = new URLSearchParams(search);
  const number = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    return value !== null && Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, STOREFRONT_MAX_PRICE)) : fallback;
  };
  const sort = params.get("sort") as ProductSort | null;
  return {
    group: params.get("group") ?? "All",
    type: params.get("type") ?? "",
    q: params.get("q") ?? "",
    stock: params.get("stock") ?? "all",
    material: params.get("material") ?? "all",
    min: number(params.get("min"), 0),
    max: number(params.get("max"), STOREFRONT_MAX_PRICE),
    sort: sort && productSorts.some(([key]) => key === sort) ? sort : "featured",
  };
};

const writeCollectionFilters = (filters: CollectionFilters) => {
  const params = new URLSearchParams();
  if (filters.group !== "All") params.set("group", filters.group);
  if (filters.type) params.set("type", filters.type);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.stock !== "all") params.set("stock", filters.stock);
  if (filters.material !== "all") params.set("material", filters.material);
  if (filters.min > 0) params.set("min", String(filters.min));
  if (filters.max < STOREFRONT_MAX_PRICE) params.set("max", String(filters.max));
  if (filters.sort !== "featured") params.set("sort", filters.sort);
  const search = params.toString();
  return search ? `?${search}` : "";
};

export function CollectionPage() {
  const { products, userId, catalogPending } = useStore();
  const { room } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const current = room ?? (location.pathname.slice(1) || "living-room");
  const info =
    roomCollections[current as keyof typeof roomCollections] ??
    roomCollections["living-room"];
  const collectionGroups = Object.keys(info.groups);
  const groups = info.match === "new" ? collectionGroups : ["All", ...collectionGroups];
  const [filters, setFilters] = useState<CollectionFilters>(() => readCollectionFilters(location.search));
  const lastWrittenSearch = useRef(location.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPresence = usePresence(filtersOpen, 280);
  const [density, setDensity] = useState<"standard" | "large">(() => localStore.getItem(gridDensityKey) === "large" ? "large" : "standard");
  const [synonyms, setSynonyms] = useState<SearchSynonym[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>(() => readComparedProductIds());
  const comparePresence = usePresence(compareIds.length > 0, 300);
  const [lastCompared, setLastCompared] = useState<string[]>(compareIds);
  if (compareIds.length > 0 && lastCompared !== compareIds) setLastCompared(compareIds);
  const group = groups.includes(filters.group) ? filters.group : groups[0];
  const { containerRef: groupTabsRef, indicatorStyle: groupIndicator } = useSlidingIndicator<HTMLDivElement>(`${current}:${group}`);
  const update = (patch: Partial<CollectionFilters>) => setFilters((currentFilters) => ({ ...currentFilters, ...patch }));

  useEffect(() => {
    // Back/forward, mega-menu links and room switches drive the filters.
    if (location.search === lastWrittenSearch.current) return;
    lastWrittenSearch.current = location.search;
    setFilters(readCollectionFilters(location.search));
  }, [location.search]);
  useEffect(() => {
    lastWrittenSearch.current = location.search;
    setFilters(readCollectionFilters(location.search));
    // A new room starts from its own URL, never the previous room's filters.
  }, [current]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = writeCollectionFilters({ ...filters, group });
      if (search === location.search) return;
      lastWrittenSearch.current = search;
      navigate({ search }, { replace: true, preventScrollReset: true });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [filters, group]);
  useEffect(() => {
    let active = true;
    void getSearchSynonyms()
      .then((rows) => { if (active) setSynonyms(rows); })
      .catch(() => undefined);
    const syncCompare = () => setCompareIds(readComparedProductIds());
    window.addEventListener(COMPARE_CHANGE_EVENT, syncCompare);
    window.addEventListener("storage", syncCompare);
    return () => {
      active = false;
      window.removeEventListener(COMPARE_CHANGE_EVENT, syncCompare);
      window.removeEventListener("storage", syncCompare);
    };
  }, []);
  useEffect(() => {
    if (!filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [filtersOpen]);

  const children =
    group === "All"
      ? []
      : (info.groups as Record<string, readonly string[]>)[group] ?? [];
  const subcategory = children.includes(filters.type) ? filters.type : "";
  const matchesSubcategory = (product: Product, value: string) =>
    matchesCatalogSubcategory(
      product,
      value,
      subcategoryProductMap[value] ?? [],
    );
  const collectionItems =
    info.match === "new"
      ? selectNewArrivals(products, group)
      : info.match === "all"
        ? group === "All" ? products : products.filter((p) => catalogValuesMatch(p.category, group))
        : products.filter((p) => catalogValuesMatch(p.category, info.match));
  const query = filters.q;
  let items = collectionItems;
  const searchActive = Boolean(query.trim());
  if (!searchActive && subcategory) {
    items = items.filter((product) => matchesSubcategory(product, subcategory));
  } else if (!searchActive && info.match !== "new" && info.match !== "all" && children.length) {
    items = items.filter((product) =>
      children.some((child) => matchesSubcategory(product, child)),
    );
  }
  const expandedQuery = expandCatalogQuery(query, synonyms);
  if (searchActive) items = rankCatalogSearch(items, expandedQuery);
  if (filters.stock === "in-stock") items = items.filter((product) => (product.stockQuantity ?? 1) > 8);
  if (filters.stock === "low-stock") items = items.filter((product) => (product.stockQuantity ?? 99) > 0 && (product.stockQuantity ?? 99) <= 8);
  if (filters.material !== "all") {
    items = items.filter((product) => {
      const source = (product.material || materialFor(product.id)).toLowerCase();
      return (materialAliases[filters.material] ?? [filters.material.toLowerCase()]).some((term) => source.includes(term));
    });
  }
  items = filterByPriceRange(items, filters.min, filters.max);
  if (!searchActive || filters.sort !== "featured") items = sortProducts(items, filters.sort);
  const searchSuggestions = query.trim().length >= 2
    ? rankCatalogSearch(collectionItems, expandedQuery).slice(0, 6)
    : [];
  useEffect(() => {
    if (!userId || query.trim().length < 2) return;
    const timeout = window.setTimeout(() => {
      void recordCatalogSearch(query, items.length, current).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [current, items.length, query, userId]);
  const priceCeiling = Math.min(
    STOREFRONT_MAX_PRICE,
    Math.max(10_000, Math.ceil(Math.max(0, ...collectionItems.map((product) => product.price)) / 5_000) * 5_000),
  );
  const shownMax = Math.min(filters.max, priceCeiling);
  const priceRangeActive = filters.min > 0 || filters.max < STOREFRONT_MAX_PRICE;
  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [
    ...(query.trim() ? [{ key: "q", label: `“${query.trim()}”`, clear: () => update({ q: "" }) }] : []),
    ...(subcategory ? [{ key: "type", label: subcategory, clear: () => update({ type: "" }) }] : []),
    ...(filters.stock !== "all" ? [{ key: "stock", label: filters.stock === "in-stock" ? "In stock" : "Only a few left", clear: () => update({ stock: "all" }) }] : []),
    ...(filters.material !== "all" ? [{ key: "material", label: filters.material, clear: () => update({ material: "all" }) }] : []),
    ...(priceRangeActive ? [{ key: "price", label: `${money(filters.min)} – ${filters.max >= STOREFRONT_MAX_PRICE ? `${money(priceCeiling)}+` : money(filters.max)}`, clear: () => update({ min: 0, max: STOREFRONT_MAX_PRICE }) }] : []),
  ];
  const drawerFilterCount = [filters.stock !== "all", filters.material !== "all", priceRangeActive].filter(Boolean).length;
  const clearFilters = () => update({ q: "", type: "", stock: "all", material: "all", min: 0, max: STOREFRONT_MAX_PRICE });
  const setDensityPreference = (value: "standard" | "large") => {
    setDensity(value);
    localStore.setItem(gridDensityKey, value);
  };
  const comparedProducts = lastCompared
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
  const pricePresets: Array<[string, number, number]> = [
    ["Under ₱10k", 0, 10_000],
    ["₱10k – ₱30k", 10_000, 30_000],
    ["₱30k – ₱60k", 30_000, 60_000],
    ["₱60k +", 60_000, STOREFRONT_MAX_PRICE],
  ];
  return (
    <Layout>
      <main>
        <section className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-5 lg:px-10 lg:pt-6">
          <nav aria-label="Breadcrumb" className="mb-4 px-1 text-xs text-muted-foreground">
            <Link to="/home" className="hover:text-foreground">Home</Link>
            <span className="mx-2">/</span>
            {info.match === "all" ? <span className="text-foreground">Shop all</span> : <><Link to="/shop" className="hover:text-foreground">Shop</Link><span className="mx-2">/</span><span className="text-foreground">{info.title}</span></>}
          </nav>
          <div className="relative min-h-[280px] overflow-hidden rounded-[1.75rem] bg-[#2a2723] sm:min-h-[380px] lg:min-h-[440px]">
            <ResilientImage
              key={info.image}
              src={info.image}
              alt=""
              loading="eager"
              sizes="100vw"
              className={`cc-kenburns absolute inset-0 h-full w-full object-cover ${info.title === "Dining room" ? "object-[center_72%]" : "object-center"}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
            <div className="relative flex min-h-[280px] flex-col justify-end px-6 py-8 text-white sm:min-h-[380px] sm:px-12 sm:py-12 lg:min-h-[440px]">
              <p className="cc-rise text-[11px] font-bold tracking-[.22em] text-white/80">
                {info.eyebrow}
              </p>
              <h1 className="cc-rise mt-4 font-serif text-5xl leading-[.95] tracking-[-.02em] sm:text-7xl lg:text-8xl" style={{ ["--i" as string]: 1 }}>
                {info.title}
              </h1>
              <div className="cc-rise mt-5 flex flex-wrap items-center gap-x-6 gap-y-3" style={{ ["--i" as string]: 2 }}>
                <p className="max-w-md text-sm leading-6 text-white/85">{info.copy}</p>
                {!catalogPending && <span className="rounded-full border border-white/35 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">{collectionItems.length} pieces</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-7 sm:px-5 sm:py-10 lg:px-10 lg:py-12">
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <div
                ref={groupTabsRef}
                role="tablist"
                aria-label={`Browse ${info.title.toLowerCase()}`}
                className="cc-no-scrollbar cc-fade-x relative -mx-4 flex min-w-0 flex-1 gap-1 overflow-x-auto px-4 sm:mx-0 sm:flex-none sm:rounded-full sm:border sm:border-border sm:bg-card sm:p-1 sm:[mask-image:none]"
              >
                <SlidingIndicator style={groupIndicator} className="rounded-full bg-foreground shadow-sm" />
                {groups.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={group === item}
                    data-active={group === item}
                    onClick={() => update({ group: item, type: "" })}
                    className={`relative z-10 h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-colors duration-300 ${group === item ? "text-background" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="hidden shrink-0 text-sm text-muted-foreground sm:block" aria-live="polite">
                {catalogPending ? "Loading pieces…" : `${items.length} ${items.length === 1 ? "piece" : "pieces"}`}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <label className="flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-[var(--shadow-soft)] transition focus-within:border-[#b8a58d] focus-within:ring-4 focus-within:ring-[#b8a58d]/15">
                  <Search size={17} className="shrink-0 text-muted-foreground" />
                  <span className="sr-only">Search {info.title.toLowerCase()}</span>
                  <input
                    value={query}
                    onChange={(event) => update({ q: event.target.value })}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                    placeholder={`Search ${info.match === "all" ? "all" : info.title.toLowerCase()} pieces`}
                    className="storefront-product-search-input min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  {query && (
                    <button type="button" onClick={() => update({ q: "" })} aria-label="Clear search" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X size={15} /></button>
                  )}
                </label>
                {searchFocused && query.trim().length >= 2 && (
                  <div className="cc-popover absolute inset-x-0 top-[calc(100%+.4rem)] z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-raised)]" data-state="open">
                    {searchSuggestions.length ? searchSuggestions.map((suggestion) => (
                      <Link key={suggestion.id} to={`/products/${suggestion.id}`} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-secondary">
                        <span className="cc-media h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary"><ResilientImage src={suggestion.images[productMainImageIndex(suggestion)]} alt="" className="h-full w-full object-cover" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{suggestion.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{suggestion.subcategory || suggestion.category}</span></span>
                        <span className="text-sm font-semibold tabular-nums">{money(suggestion.price)}</span>
                      </Link>
                    )) : (
                      <div className="px-4 py-4 text-xs text-muted-foreground"><p className="font-semibold text-foreground">No exact match yet</p><p className="mt-1">Try a room, material, product type, or clear the filters.</p></div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  aria-haspopup="dialog"
                  className="cc-press flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold shadow-[var(--shadow-soft)] hover:bg-secondary md:flex-none"
                >
                  <SlidersHorizontal size={16} /> Filters
                  {drawerFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[11px] text-background">{drawerFilterCount}</span>}
                </button>
                <label className="relative flex-1 md:w-52 md:flex-none">
                  <span className="sr-only">Sort products</span>
                  <select
                    aria-label="Sort products"
                    value={filters.sort}
                    onChange={(event) => update({ sort: event.target.value as ProductSort })}
                    className="h-12 w-full appearance-none rounded-2xl border border-border bg-card pl-4 pr-10 text-[13px] font-semibold shadow-[var(--shadow-soft)]"
                  >
                    {productSorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </label>
                <div className="hidden h-12 items-center rounded-2xl border border-border bg-card p-1 shadow-[var(--shadow-soft)] sm:flex" role="group" aria-label="Grid size">
                  <button type="button" aria-pressed={density === "standard"} aria-label="Show more pieces per row" onClick={() => setDensityPreference("standard")} className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${density === "standard" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"}`}><Grid2X2 size={16} /></button>
                  <button type="button" aria-pressed={density === "large"} aria-label="Show larger pieces" onClick={() => setDensityPreference("large")} className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${density === "large" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"}`}><Square size={15} /></button>
                </div>
              </div>
            </div>

            {children.length > 0 && (
              <div className="cc-no-scrollbar cc-fade-x -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]" aria-label={`${group} types`}>
                {["", ...children].map((child) => (
                  <button
                    key={child || "all"}
                    type="button"
                    aria-pressed={subcategory === child}
                    onClick={() => update({ type: child })}
                    className={`cc-press h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors ${subcategory === child ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground/80 hover:border-foreground/40"}`}
                  >
                    {child || `All ${group.toLowerCase()}`}
                  </button>
                ))}
              </div>
            )}

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    aria-label={`Remove filter ${chip.label}`}
                    className="cc-enter-pop inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary pl-3 pr-2 text-xs font-semibold hover:bg-[#e3ddd3]"
                  >
                    {chip.label} <X size={13} />
                  </button>
                ))}
                <button type="button" onClick={clearFilters} className="px-2 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear all</button>
                <span className="ml-auto text-xs text-muted-foreground sm:hidden">{items.length} pieces</span>
              </div>
            )}
          </div>

          {items.length || catalogPending ? (
            <ProductGrid
              key={`${current}-${group}-${subcategory}-${filters.sort}`}
              className="mt-9"
              products={items}
              pending={catalogPending}
              columns={density}
            />
          ) : (
            <div className="cc-enter-up mt-10 grid min-h-[340px] place-items-center rounded-[2rem] border border-dashed border-border bg-card px-6 py-12 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-[#8d7863]"><Search size={22} /></span>
                <h2 className="mt-6 font-serif text-3xl sm:text-4xl">{activeChips.length ? "Nothing matches just yet." : "More pieces are arriving soon."}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {activeChips.length ? "Try loosening a filter or searching for a material, like oak or linen." : "This part of the collection is being prepared. Explore the rest of the store in the meantime."}
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  {activeChips.length > 0 && <button type="button" onClick={clearFilters} className="cc-press h-12 rounded-full bg-foreground px-6 text-sm font-semibold text-background">Clear filters</button>}
                  <Link to="/find-my-furniture" className="cc-press inline-flex h-12 items-center rounded-full border border-border px-6 text-sm font-semibold hover:bg-secondary">Find my furniture</Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {filterPresence.mounted && createPortal(
          <div className="fixed inset-0 z-[130]">
            <button type="button" tabIndex={-1} aria-label="Close filters" data-state={filterPresence.state} onClick={() => setFiltersOpen(false)} className="cc-backdrop absolute inset-0 bg-[#171614]/45 backdrop-blur-[3px]" />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="collection-filters-title"
              data-state={filterPresence.state}
              className="cc-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-[#fbfaf7] shadow-[var(--shadow-overlay)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-[1.75rem]"
            >
              <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden="true" />
              <header className="flex items-center justify-between border-b border-border px-6 pb-4 pt-3 md:pt-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-muted-foreground">Refine</p>
                  <h2 id="collection-filters-title" className="mt-1 font-serif text-3xl">Filters</h2>
                </div>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" data-dialog-close className="cc-press grid h-11 w-11 place-items-center rounded-full border border-border bg-white hover:bg-secondary"><X size={18} /></button>
              </header>
              <div className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-6 py-6">
                <fieldset>
                  <legend className="text-sm font-semibold">Availability</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stockOptions.map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={filters.stock === value} onClick={() => update({ stock: value })} className={`cc-press h-10 rounded-full border px-4 text-xs font-semibold transition-colors ${filters.stock === value ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground/40"}`}>{label}</button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-semibold">Material</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["all", ...materialOptions].map((value) => (
                      <button key={value} type="button" aria-pressed={filters.material === value} onClick={() => update({ material: value })} className={`cc-press h-10 rounded-full border px-4 text-xs font-semibold transition-colors ${filters.material === value ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground/40"}`}>{value === "all" ? "All materials" : value}</button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-semibold">Price</legend>
                  <div className="mt-3 flex items-center justify-between text-sm tabular-nums">
                    <span className="rounded-xl border border-border bg-white px-3 py-2">{money(filters.min)}</span>
                    <span className="h-px w-6 bg-border" />
                    <span className="rounded-xl border border-border bg-white px-3 py-2">{filters.max >= STOREFRONT_MAX_PRICE ? `${money(priceCeiling)}+` : money(filters.max)}</span>
                  </div>
                  <div className="cc-range mt-4">
                    <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" aria-hidden="true" />
                    <span
                      className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground"
                      aria-hidden="true"
                      style={{ left: `${(Math.min(filters.min, priceCeiling) / priceCeiling) * 100}%`, right: `${100 - (shownMax / priceCeiling) * 100}%` }}
                    />
                    <input
                      type="range"
                      aria-label="Minimum price"
                      min={0}
                      max={priceCeiling}
                      step={1_000}
                      value={Math.min(filters.min, priceCeiling)}
                      onChange={(event) => update({ min: Math.min(Number(event.target.value), shownMax - 1_000 < 0 ? 0 : shownMax - 1_000) })}
                    />
                    <input
                      type="range"
                      aria-label="Maximum price"
                      min={0}
                      max={priceCeiling}
                      step={1_000}
                      value={shownMax}
                      onChange={(event) => {
                        const value = Math.max(Number(event.target.value), filters.min + 1_000);
                        update({ max: value >= priceCeiling ? STOREFRONT_MAX_PRICE : value });
                      }}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pricePresets.map(([label, min, max]) => {
                      const selected = filters.min === min && filters.max === max;
                      return <button key={label} type="button" aria-pressed={selected} onClick={() => update(selected ? { min: 0, max: STOREFRONT_MAX_PRICE } : { min, max })} className={`cc-press h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${selected ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground/40"}`}>{label}</button>;
                    })}
                  </div>
                </fieldset>
              </div>
              <footer className="grid grid-cols-[auto_1fr] gap-3 border-t border-border bg-white px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:pb-7">
                <button type="button" onClick={() => update({ stock: "all", material: "all", min: 0, max: STOREFRONT_MAX_PRICE })} className="cc-press inline-flex h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"><RotateCcw size={15} /> Reset</button>
                <button type="button" onClick={() => setFiltersOpen(false)} className="cc-press h-12 rounded-xl bg-foreground text-sm font-semibold text-background hover:bg-[#35322e]">
                  Show {items.length} {items.length === 1 ? "piece" : "pieces"}
                </button>
              </footer>
            </aside>
          </div>,
          document.body,
        )}

        {comparePresence.mounted && (
          <div data-state={comparePresence.state} className="cc-quickview fixed inset-x-3 bottom-[calc(var(--mobile-store-nav-height)+.75rem)] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-[#201f1d]/95 p-2.5 pl-3 text-white shadow-[var(--shadow-overlay)] backdrop-blur md:bottom-6">
            <div className="flex -space-x-2">
              {comparedProducts.slice(0, 4).map((product) => (
                <span key={product.id} className="h-10 w-10 overflow-hidden rounded-xl border-2 border-[#201f1d] bg-secondary">
                  <ResilientImage src={primaryProductImage(product)} alt="" className="h-full w-full object-cover" />
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Compare {compareIds.length || lastCompared.length} of 4</p><p className="mt-0.5 hidden truncate text-[11px] text-white/60 sm:block">Price, size, finish, ratings and stock side by side.</p></div>
            <Link to="/compare" className="cc-press rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[#201f1d]">Compare</Link>
            <button type="button" onClick={() => writeComparedProductIds([])} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Clear comparison"><X size={15}/></button>
          </div>
        )}
      </main>
    </Layout>
  );
}

export function ComparePage() {
  const { products, add } = useStore();
  const [ids, setIds] = useState<string[]>(() => readComparedProductIds());
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
  useEffect(() => {
    const sync = () => setIds(readComparedProductIds());
    window.addEventListener(COMPARE_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COMPARE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const compared = ids.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  const comparisonTableMinWidth = 148 + compared.length * 270;
  const rows = [
    ["Price", (product: Product) => money(product.price)],
    ["Room", (product: Product) => product.category],
    ["Product type", (product: Product) => product.subcategory || subcategoryFor(product.id)],
    ["Finish", (product: Product) => product.color],
    ["Materials", (product: Product) => parseMaterialSpecs(product.material || materialFor(product.id)).map((item) => `${item.type}: ${item.description}`).join(" · ")],
    ["Dimensions", (product: Product) => parseDimensionSpecs(product.dimensions).map((item) => `${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`).join(" · ") || "Details coming soon"],
    ["Customer rating", (product: Product) => product.reviews > 0 ? `${product.rating} / 5 (${product.reviews} reviews)` : "No reviews yet"],
    ["Availability", (product: Product) => exactStockAvailability(product.stockQuantity, product.stock)],
  ] as const;
  const visibleRows = showDifferencesOnly && compared.length > 1
    ? rows.filter(([, value]) => new Set(compared.map((product) => String(value(product)).trim().toLocaleLowerCase("en-PH"))).size > 1)
    : rows;
  return (
    <Layout>
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">PRODUCT COMPARISON</p>
            <h1 className="mt-3 font-serif text-4xl leading-[.95] sm:text-5xl lg:text-6xl">Choose with confidence.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Compare up to four pieces using the latest catalog details, dimensions, ratings, and availability.</p>
          </div>
          {ids.length > 0 && (
            <button
              type="button"
              onClick={() => writeComparedProductIds([])}
              className="w-fit shrink-0 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold transition hover:bg-secondary"
            >
              Clear comparison
            </button>
          )}
        </div>

        {compared.length ? (
          <section className="mt-8" aria-labelledby="comparison-table-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="comparison-table-title" className="text-xs font-semibold">{compared.length} {compared.length === 1 ? "product" : "products"} selected</h2>
              <div className="flex items-center gap-2">
                {compared.length > 1 && (
                  <button
                    type="button"
                    aria-pressed={showDifferencesOnly}
                    onClick={() => setShowDifferencesOnly((current) => !current)}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition ${showDifferencesOnly ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}
                  >
                    <SlidersHorizontal size={13} />
                    Differences only
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground sm:hidden">Swipe →</p>
              </div>
            </div>
            <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-card shadow-[0_12px_35px_rgba(33,31,29,.045)] [-webkit-overflow-scrolling:touch]">
              <table
                aria-label="Product comparison"
                className="w-full table-fixed border-collapse text-left"
                style={{ minWidth: `${comparisonTableMinWidth}px` }}
              >
                <colgroup>
                  <col className="w-[148px]"/>
                  {compared.map((product) => <col key={product.id}/>)}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-20 border-b border-r border-border bg-[#f2eee8] p-3 text-[11px] font-bold sm:p-4">Product</th>
                    {compared.map((product) => (
                      <th key={product.id} scope="col" className="border-b border-r border-border bg-card p-3 align-top last:border-r-0 sm:p-4">
                        <div className="cc-media relative h-40 w-full overflow-hidden rounded-xl bg-secondary sm:h-52 lg:h-60">
                          <ResilientImage
                            src={product.images[productMainImageIndex(product)]}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => toggleComparedProduct(product.id)}
                            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/95 shadow transition hover:bg-secondary"
                            aria-label={`Remove ${product.name} from comparison`}
                          >
                            <X size={14}/>
                          </button>
                        </div>
                        <Link
                          to={`/products/${product.id}`}
                          className="mt-3 flex min-h-10 items-start text-sm font-semibold leading-5 hover:underline"
                        >
                          {product.name}
                        </Link>
                        <div className="mt-2 flex items-center justify-between gap-2" data-fly-source>
                          <span className="text-sm tabular-nums">{money(product.price)}</span>
                          <button
                            type="button"
                            onClick={() => add(product.id)}
                            disabled={product.stockQuantity === 0}
                            className="cc-press inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus size={13} /> {product.stockQuantity === 0 ? "Sold out" : "Add"}
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(([label, value]) => (
                    <tr key={label}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-r border-border bg-[#f7f4ef] p-3 align-top text-[11px] font-bold sm:p-4"
                      >
                        {label}
                      </th>
                      {compared.map((product) => (
                        <td
                          key={product.id}
                          className="break-words border-b border-r border-border p-3 align-top text-xs leading-5 text-muted-foreground last:border-r-0 sm:p-4"
                        >
                          {value(product)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {showDifferencesOnly && visibleRows.length === 0 && (
                    <tr>
                      <th scope="row" className="sticky left-0 z-10 border-r border-border bg-[#f7f4ef] p-3 text-[11px] font-bold sm:p-4">Differences</th>
                      <td colSpan={compared.length} className="p-6 text-center text-xs text-muted-foreground">These products match across every listed detail.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <Empty
            icon={Scale}
            title="Your comparison is empty."
            text="Tick “Compare” under any product to line up to four pieces side by side."
            cta="Browse the collection"
            to="/shop"
          />
        )}
      </main>
    </Layout>
  );
}

type ProductReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewer_display_name: string;
  image_urls: string[];
  created_at: string;
};

const normalizeProductReviews = (rows: ProductReview[]): ProductReview[] => rows.map((row) => ({
  ...row,
  reviewer_display_name: row.reviewer_display_name?.trim() || "CozyCraft customer",
  image_urls: Array.isArray(row.image_urls) ? row.image_urls.map((_, index) =>
    `${String(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, "")}/functions/v1/review-photo?review_id=${encodeURIComponent(row.id)}&index=${index}`) : [],
}));

const reviewAvatarUrl = (reviewId: string) =>
  `${String(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, "")}/functions/v1/review-avatar?review_id=${encodeURIComponent(reviewId)}`;

function ReviewerAvatar({
  reviewId,
  displayName,
}: {
  reviewId: string;
  displayName: string;
}) {
  const [imageUnavailable, setImageUnavailable] = useState(false);

  useEffect(() => {
    setImageUnavailable(false);
  }, [reviewId]);

  return (
    <span
      className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ded4c6] text-xs font-bold uppercase"
      aria-label={`${displayName}'s profile photo`}
      role="img"
    >
      {displayName.slice(0, 2)}
      {!imageUnavailable && (
        <img
          src={reviewAvatarUrl(reviewId)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageUnavailable(true)}
        />
      )}
    </span>
  );
}

type ProductAvailabilityState = "checking" | "available" | "unavailable";

const productCollectionPath = (product: Product) => {
  const category = product.category.trim().toLocaleLowerCase();
  if (category.includes("living")) return "/living-room";
  if (category.includes("bedroom")) return "/bedroom";
  if (category.includes("dining")) return "/dining-room";
  return "/shop";
};

export function ProductPage() {
  const [loadFailed, setLoadFailed] = useState(false);
  const { productId } = useParams();
  const { products } = useStore();
  const visibleProduct = products.find((product) => product.id === productId);
  const [productSnapshot, setProductSnapshot] = useState<Product | null>(
    visibleProduct ?? null,
  );
  const [availability, setAvailability] = useState<ProductAvailabilityState>(
    visibleProduct ? "available" : "checking",
  );

  useEffect(() => {
    setProductSnapshot(visibleProduct ?? null);
    setAvailability(visibleProduct ? "available" : "checking");
  }, [productId]);

  useEffect(() => {
    if (visibleProduct) setProductSnapshot(visibleProduct);
  }, [visibleProduct]);

  useEffect(() => {
    setLoadFailed(false);
    if (productSnapshot) return;
    const timer = window.setTimeout(() => setLoadFailed(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [productId, productSnapshot]);

  useEffect(() => {
    if (!productId) {
      setAvailability("unavailable");
      return;
    }

    let active = true;
    let availabilityRequest: AbortController | undefined;
    const loadAvailability = async () => {
      availabilityRequest?.abort();
      const controller = new AbortController();
      availabilityRequest = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      try {
        const { data, error } = await supabase
        .from("product_availability")
        .select("available")
        .eq("product_id", productId)
        .abortSignal(controller.signal).maybeSingle();
        if (!active || availabilityRequest !== controller) return;
        if (error) { setLoadFailed(true); return; }
        setAvailability(data?.available ? "available" : "unavailable");
      } catch {
        if (active && availabilityRequest === controller) setLoadFailed(true);
      } finally { window.clearTimeout(timeout); }
    };

    void loadAvailability();
    const channel = supabase
      .channel(`storefront-product-availability-${productId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_availability",
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          if (!active) return;
          const row = payload.new as { available?: boolean };
          setAvailability(row.available ? "available" : "unavailable");
        },
      )
      .subscribe();
    const refreshOnFocus = () => void loadAvailability();
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnFocus);
      availabilityRequest?.abort();
      void supabase.removeChannel(channel);
    };
  }, [productId]);

  if (!productSnapshot) {
    return (
      <Layout>
        <main className="mx-auto grid min-h-[62vh] max-w-[1440px] place-items-center px-5 py-12 lg:px-10">
          {loadFailed && availability !== "unavailable" ? (
            <section className="max-w-md text-center" role="alert">
              <h1 className="font-serif text-3xl">We couldn’t load this piece.</h1>
              <p className="mt-3 text-sm text-muted-foreground">Please check your connection and try again. This does not mean the product is unavailable.</p>
              <button onClick={() => window.location.reload()} className="mt-5 min-h-12 rounded-xl bg-foreground px-6 text-sm font-semibold text-background">Try again</button>
            </section>
          ) : availability !== "unavailable" ? (
            <div className="grid w-full gap-10 self-start lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]" role="status" aria-live="polite" aria-label="Loading this piece">
              <div className="cc-skeleton aspect-[4/5] w-full rounded-[1.75rem]" />
              <div className="space-y-4 pt-2">
                <div className="cc-skeleton h-3 w-1/3 rounded-full" />
                <div className="cc-skeleton h-12 w-3/4 rounded-2xl" />
                <div className="cc-skeleton h-6 w-1/4 rounded-full" />
                <div className="cc-skeleton mt-8 h-24 w-full rounded-2xl" />
                <div className="cc-skeleton h-12 w-full rounded-xl" />
                <span className="sr-only">Checking this piece…</span>
              </div>
            </div>
          ) : (
            <section className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-7 text-center shadow-[0_18px_50px_rgba(35,31,27,.08)] sm:p-10">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary">
                <EyeOff size={23} />
              </span>
              <p className="mt-6 text-[11px] font-bold tracking-[.18em] text-muted-foreground">PRODUCT UNAVAILABLE</p>
              <h1 className="mt-2 font-serif text-4xl">This piece is not currently available.</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                It may have just been hidden or removed from the collection. Explore the catalog to find another piece for your home.
              </p>
              <Link to="/shop" className="cc-press mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-foreground px-6 text-sm font-semibold text-background">
                Browse available pieces
              </Link>
            </section>
          )}
        </main>
      </Layout>
    );
  }

  return (
    <ProductPageContent
      key={productSnapshot.id}
      product={productSnapshot}
      liveAvailable={availability !== "unavailable"}
    />
  );
}

function ProductPageContent({
  product,
  liveAvailable,
}: {
  product: Product;
  liveAvailable: boolean;
}) {
  const { add, toggle, saved, products, userId, orders, storeSettings, catalogPending } = useStore();
  usePageTitle(product.name, storeSettings.store_name || undefined);
  const [justAdded, setJustAdded] = useState(false);
  const [morphName, setMorphName] = useState(true);
  const [ctaVisible, setCtaVisible] = useState(true);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const mobileGalleryRef = useRef<HTMLDivElement | null>(null);
  // Keeps the sticky desktop gallery still while the detail accordions open.
  const galleryHold = useStickyHold<HTMLElement>();
  const [zoomOrigin, setZoomOrigin] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [ratingCounts, setRatingCounts] = useState<number[] | null>(null);
  const [photoLayers, setPhotoLayers] = useState(() => ({ current: productMainImageIndex(product), previous: productMainImageIndex(product) }));
  const [photo, setPhoto] = useState(() => productMainImageIndex(product));
  const [quantity, setQuantity] = useState(1);
  const [reviewFilter, setReviewFilter] = useState("All");
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewPage,setReviewPage] = useState(1);
  const [reviewTotal,setReviewTotal] = useState(0);
  const [reviewRevision,setReviewRevision] = useState(0);
  const [hasPurchased,setHasPurchased] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [existingReview, setExistingReview] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewGallery, setReviewGallery] = useState<{ reviewId: string; index: number } | null>(null);
  const [productGalleryOpen, setProductGalleryOpen] = useState(false);
  const productGalleryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const productGalleryPanelRef = useRef<HTMLElement | null>(null);
  const productGalleryCloseRef = useRef<HTMLButtonElement | null>(null);
  const productGalleryTouchStartRef = useRef<number | null>(null);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryServiceArea[]>([]);
  const [deliveryAreaCode, setDeliveryAreaCode] = useState("");
  const [roomWidth, setRoomWidth] = useState("");
  const [roomDepth, setRoomDepth] = useState("");
  const [alerts, setAlerts] = useState<string[]>([]);
  const [alertBusy, setAlertBusy] = useState("");
  const [alertNotice, setAlertNotice] = useState("");
  const [compared, setCompared] = useState(() => readComparedProductIds().includes(product.id));
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(!liveAvailable);
  const nav = useNavigate();
  const collectionPath = productCollectionPath(product);
  const isSaved = saved.includes(product.id);
  const materialItems = parseMaterialSpecs(
    product.material || materialFor(product.id),
  );
  const dimensionItems = parseDimensionSpecs(product.dimensions);
  const stockLimit =
    typeof product.stockQuantity === "number"
      ? Math.max(0, product.stockQuantity)
      : null;
  const atStockLimit = stockLimit !== null && quantity >= stockLimit;
  const outOfStock = stockLimit === 0;
  const lowStock = stockLimit !== null && stockLimit > 0 && stockLimit <= 8;
  const stockAvailability = exactStockAvailability(product.stockQuantity, product.stock);
  const selectedDeliveryArea = deliveryAreas.find((area) => area.area_code === deliveryAreaCode) ?? null;
  const deliveryWindow = selectedDeliveryArea ? deliveryDateRange(selectedDeliveryArea) : null;
  const deliveryFee = selectedDeliveryArea ? deliveryFeeFor(selectedDeliveryArea, product.price * quantity) : null;
  const productWidth = measurementCm(dimensionItems, "width") ?? Number.NaN;
  const productDepth = measurementCm(dimensionItems, "depth") ?? Number.NaN;
  const fitChecked = Number(roomWidth) > 0 && Number(roomDepth) > 0 && Number.isFinite(productWidth) && Number.isFinite(productDepth);
  const fitsRoom = fitChecked && productWidth <= Number(roomWidth) && productDepth <= Number(roomDepth);
  useEffect(() => {
    setAvailabilityDialogOpen(!liveAvailable);
  }, [liveAvailable]);
  useEffect(() => {
    if (!availabilityDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAvailabilityDialogOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [availabilityDialogOpen]);
  useEffect(() => {
    let active = true;
    void getDeliveryServiceAreas()
      .then((areas) => {
        if (!active) return;
        setDeliveryAreas(areas);
        setDeliveryAreaCode((current) => current || areas[0]?.area_code || "");
      })
      .catch(() => undefined);
    const syncCompare = () => setCompared(readComparedProductIds().includes(product.id));
    window.addEventListener(COMPARE_CHANGE_EVENT, syncCompare);
    window.addEventListener("storage", syncCompare);
    return () => {
      active = false;
      window.removeEventListener(COMPARE_CHANGE_EVENT, syncCompare);
      window.removeEventListener("storage", syncCompare);
    };
  }, [product.id]);
  useEffect(() => {
    if (!userId) { setAlerts([]); return; }
    let active = true;
    void getProductAlerts(userId, product.id)
      .then((types) => { if (active) setAlerts(types); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [product.id, userId]);
  useEffect(() => {
    setPhoto(productMainImageIndex(product));
    setQuantity(1);
    setReviewFilter("All");
  }, [product.id]);
  useEffect(() => {
    let active=true;
    const remember=async()=>{
      if(userId){
        await supabase.from("product_views").upsert({user_id:userId,product_id:product.id,viewed_at:new Date().toISOString()},{onConflict:"user_id,product_id"});
        const {data}=await supabase.from("product_views").select("product_id").eq("user_id",userId).neq("product_id",product.id).order("viewed_at",{ascending:false}).limit(4);
        if(active)setRecentProductIds((data??[]).map((row)=>row.product_id));
        return;
      }
      const key="cozycraft-recent-products";
      const stored=JSON.parse(localStore.getItem(key)??"[]") as unknown;
      const ids=Array.isArray(stored)?stored.filter((id):id is string=>typeof id==="string"):[];
      const next=[product.id,...ids.filter((id)=>id!==product.id)].slice(0,8);
      localStore.setItem(key,JSON.stringify(next));
      if(active)setRecentProductIds(next.filter((id)=>id!==product.id).slice(0,4));
    };
    void remember();
    return()=>{active=false;};
  },[product.id,userId]);
  const recentProducts=recentProductIds.map((id)=>products.find((item)=>item.id===id)).filter((item):item is Product=>Boolean(item));
  useEffect(() => {
    let active = true;
    const scheduler = createRefreshScheduler(async () => {
      let query = supabase.from("reviews").select("id,rating,title,body,reviewer_display_name,image_urls,created_at",{count:"exact"})
        .eq("product_id",product.id).eq("approved",true);
      if(reviewFilter!=="All") query=query.eq("rating",Number(reviewFilter));
      const {data,error,count} = await query.order("created_at",{ascending:false}).order("id",{ascending:false}).range((reviewPage-1)*5,reviewPage*5-1);
      if(!active) return;
      if(error) { setReviewNotice("Reviews could not be refreshed. Please try again."); return; }
      setReviewTotal(count ?? 0); setReviews(normalizeProductReviews((data ?? []) as ProductReview[]));
      if(reviewPage>Math.max(1,Math.ceil((count ?? 0)/5))) setReviewPage(Math.max(1,Math.ceil((count ?? 0)/5)));
    },200,1500);
    scheduler.request();
    const recovery=watchVisibleRecovery(scheduler.request);
    const channel=supabase.channel('product-reviews-'+product.id).on('postgres_changes',{event:'*',schema:'public',table:'reviews',filter:'product_id=eq.'+product.id},recovery.invalidate)
      .subscribe(status=>{if(status==='SUBSCRIBED') recovery.invalidate();});
    return()=>{active=false;scheduler.dispose();recovery.dispose();void supabase.removeChannel(channel);};
  },[product.id,reviewPage,reviewFilter,reviewRevision]);
  useEffect(() => {setReviewPage(1);setReviewGallery(null);},[product.id,reviewFilter]);
  useEffect(() => {
    let active=true;
    setHasPurchased(false);
    setExistingReview(false);
    if(!userId){setExistingReview(false);return;}
    void withReadDeadline(signal=>supabase.rpc("current_product_review_context",{p_product_id:product.id}).abortSignal(signal)).then(({data,error})=>{
      if(!active || error || !data) return;
      setHasPurchased(Boolean(data.purchased));
      setExistingReview(Boolean(data.review));
      if(data.review) {setReviewRating(data.review.rating);setReviewTitle(data.review.title ?? "");setReviewBody(data.review.body ?? "");}
    }).catch(()=>{if(active)setHasPurchased(false);});
    return()=>{active=false;};
  },[product.id,userId]);
  const visibleReviews=reviews;
  const mayReview = !storeSettings.review_settings.verified_purchases_only || hasPurchased;
  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !userId ||
      !mayReview ||
      reviewBody.trim().length < storeSettings.review_settings.minimum_length ||
      submittingReview
    )
      return;
    setSubmittingReview(true);
    const { data, error } = await supabase.rpc("submit_product_review", {
      p_product_id: product.id,
      p_rating: reviewRating,
      p_title: reviewTitle.trim(),
      p_body: reviewBody.trim(),
    });
    setSubmittingReview(false);
    const visible = Array.isArray(data) ? data[0]?.approved !== false : true;
    setReviewNotice(
      error?.message ??
        (visible
          ? existingReview
            ? "Your verified review was updated."
            : "Your verified review is now published."
          : "Your changes were saved. This review is currently hidden from the storefront."),
    );
    if (!error) {
      setExistingReview(true);
      setReviewPage(1);setReviewRevision(n=>n+1);
    }
  };
  const reviewAverage=Number(product.rating || 0);
  const galleryReview = reviewGallery
    ? reviews.find((review) => review.id === reviewGallery.reviewId) ?? null
    : null;
  useEffect(() => {
    if (!reviewGallery) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReviewGallery(null);
      const count = galleryReview?.image_urls.length ?? 0;
      if (!count) return;
      if (event.key === "ArrowLeft") setReviewGallery((current) => current && ({ ...current, index: (current.index - 1 + count) % count }));
      if (event.key === "ArrowRight") setReviewGallery((current) => current && ({ ...current, index: (current.index + 1) % count }));
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", handleKey); };
  }, [galleryReview, reviewGallery]);
  useEffect(() => {
    if (!productGalleryOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.requestAnimationFrame(() => {
      productGalleryCloseRef.current?.focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setProductGalleryOpen(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        setPhoto((current) => (current - 1 + product.images.length) % product.images.length);
        return;
      }
      if (event.key === "ArrowRight") {
        setPhoto((current) => (current + 1) % product.images.length);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        productGalleryPanelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [product.images.length, productGalleryOpen]);
  const toggleAlert = async (type: "back_in_stock" | "price_drop") => {
    if (!liveAvailable) return;
    if (!userId) {
      nav(`/login?next=${encodeURIComponent(`/products/${product.id}`)}`);
      return;
    }
    const enabled = !alerts.includes(type);
    setAlertBusy(type);
    setAlertNotice("");
    try {
      await setProductAlert(
        userId,
        product.id,
        type,
        enabled,
        type === "price_drop" ? Math.round(product.price * 0.9) : undefined,
      );
      setAlerts((current) => enabled ? [...new Set([...current, type])] : current.filter((value) => value !== type));
      setAlertNotice(enabled ? "Alert saved to your account." : "Alert removed.");
    } catch {
      setAlertNotice("The alert could not be saved. Please try again.");
    } finally {
      setAlertBusy("");
    }
  };
  const related = useMemo(() => {
    const others = products.filter((item) => item.id !== product.id);
    const sameRoom = others.filter((item) => catalogValuesMatch(item.category, product.category));
    const type = (product.subcategory || "").toLowerCase();
    const similar = sortProducts(sameRoom.filter((item) => (item.subcategory || "").toLowerCase() === type), "popular").slice(0, 4);
    const similarIds = new Set(similar.map((item) => item.id));
    const complete = sortProducts(sameRoom.filter((item) => !similarIds.has(item.id) && (item.subcategory || "").toLowerCase() !== type), "popular").slice(0, 4);
    return { similar, complete };
  }, [product.category, product.id, product.subcategory, products]);
  useEffect(() => {
    const timer = window.setTimeout(() => setMorphName(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    setPhotoLayers((layers) => layers.current === photo ? layers : { current: photo, previous: layers.current });
    const gallery = mobileGalleryRef.current;
    if (gallery && gallery.clientWidth && Math.round(gallery.scrollLeft / gallery.clientWidth) !== photo) {
      gallery.scrollTo({ left: photo * gallery.clientWidth, behavior: prefersReducedMotionNow() ? "auto" : "smooth" });
    }
  }, [photo]);
  useEffect(() => {
    // The compact buy bar appears only after the main button scrolls away.
    let frame = 0;
    const measure = () => {
      frame = 0;
      const node = ctaRef.current;
      if (node) setCtaVisible(node.getBoundingClientRect().bottom > 76);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    if (!product.reviews) {
      setRatingCounts(null);
      return;
    }
    let active = true;
    void Promise.all([5, 4, 3, 2, 1].map((rating) =>
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("product_id", product.id).eq("approved", true).eq("rating", rating),
    )).then((results) => {
      if (!active || results.some((result) => result.error)) return;
      setRatingCounts(results.map((result) => result.count ?? 0));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [product.id, product.reviews, reviewRevision]);
  const addToBag = () => {
    add(product.id, quantity);
    if (!userId) return;
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };
  const shareProduct = async () => {
    const url = `${window.location.origin}/products/${product.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: `${product.name} at CozyCraft`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNotice("Link copied");
    } catch {
      setShareNotice("");
      return;
    }
    window.setTimeout(() => setShareNotice(""), 2200);
  };
  const availabilityTone = !liveAvailable || outOfStock
    ? "bg-[var(--tone-danger-bg)] text-[var(--tone-danger-fg)]"
    : lowStock
      ? "bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)]"
      : "bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]";
  const availabilityText = liveAvailable ? friendlyAvailability(product.stockQuantity, product.stock) : "Currently unavailable";
  const images = product.images;
  const addLabel = !liveAvailable ? "Unavailable" : outOfStock ? "Out of stock" : justAdded ? "Added to bag" : "Add to bag";
  const reviewTotalCount = ratingCounts?.reduce((sum, count) => sum + count, 0) ?? product.reviews;
  const pillButton = "cc-press inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  return (
    <Layout>
      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-5 lg:px-10 lg:py-8">
        <nav aria-label="Breadcrumb" className="mb-5 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
          <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav(collectionPath))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card hover:bg-secondary" aria-label="Go back"><ArrowLeft size={14} /></button>
          <Link to="/home" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to={collectionPath} className="hover:text-foreground">{product.category}</Link>
          {product.subcategory && <><span className="hidden sm:inline">/</span><Link to={`${collectionPath}?q=${encodeURIComponent(product.subcategory)}`} className="hidden hover:text-foreground sm:inline">{product.subcategory}</Link></>}
          <span>/</span>
          <span className="truncate text-foreground">{product.name}</span>
        </nav>
        {!liveAvailable && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#dac6b9] bg-[#f5e9df] p-4 text-[#754d3d] sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="assertive">
            <div className="flex items-start gap-3">
              <EyeOff className="mt-0.5 shrink-0" size={18} />
              <div>
                <p className="text-sm font-semibold">This product is currently unavailable.</p>
                <p className="mt-1 text-xs leading-5 text-[#876555]">It was just hidden from the store, so shopping actions are disabled.</p>
              </div>
            </div>
            <Link to={collectionPath} className="shrink-0 text-xs font-semibold underline underline-offset-4">View available pieces</Link>
          </div>
        )}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)] lg:gap-12 xl:gap-16">
          <section ref={galleryHold.ref} aria-label={`${product.name} photos`} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            {/* Phones and tablets: swipeable gallery */}
            <div className="relative lg:hidden">
              <div
                ref={mobileGalleryRef}
                className="cc-no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto sm:mx-0 sm:rounded-[1.75rem]"
                onScroll={(event) => {
                  const gallery = event.currentTarget;
                  const index = Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
                  if (index !== photo && index >= 0 && index < images.length) setPhoto(index);
                }}
              >
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => { setPhoto(index); setProductGalleryOpen(true); }}
                    className="cc-media relative aspect-[4/5] w-full shrink-0 snap-center bg-secondary sm:aspect-[5/4]"
                    style={{ viewTransitionName: morphName && index === photoLayers.current ? "cc-product-media" : undefined }}
                    aria-label={`Open fullscreen image ${index + 1} of ${images.length}`}
                  >
                    <ResilientImage
                      src={image}
                      alt={`${product.name}, view ${index + 1}`}
                      loading={index === photo ? "eager" : "lazy"}
                      sizes="100vw"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
              {images.length > 1 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5" aria-hidden="true">
                  {images.map((image, index) => <span key={`${image}-dot-${index}`} className={`h-1.5 rounded-full bg-white shadow transition-all duration-500 ${index === photo ? "w-6" : "w-1.5 opacity-60"}`} />)}
                </div>
              )}
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
                {photo + 1} / {images.length}
              </span>
            </div>
            {/* Desktop: thumbnail rail + zoomable image */}
            <div className="hidden gap-4 lg:flex">
              {images.length > 1 && (
                <div className="cc-no-scrollbar flex max-h-[calc(100vh-8rem)] w-[76px] shrink-0 flex-col gap-3 overflow-y-auto">
                  {images.map((image, i) => (
                    <button
                      onClick={() => setPhoto(i)}
                      key={`${image}-${i}`}
                      type="button"
                      aria-pressed={photo === i}
                      aria-label={`Show ${product.name} image ${i + 1} of ${images.length}`}
                      className={`cc-media relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-xl bg-secondary ring-offset-2 ring-offset-background transition ${photo === i ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100"}`}
                    >
                      <ResilientImage src={image} alt="" sizes="80px" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <button
                ref={productGalleryTriggerRef}
                type="button"
                onClick={() => setProductGalleryOpen(true)}
                onPointerMove={(event) => {
                  if (event.pointerType !== "mouse") return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  setZoomOrigin(`${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`);
                }}
                onPointerLeave={() => setZoomOrigin(null)}
                className="group cc-media relative block h-[min(calc(100vh-8rem),860px)] min-h-[520px] w-full cursor-zoom-in overflow-hidden rounded-[1.75rem] bg-secondary text-left"
                style={{ viewTransitionName: morphName ? "cc-product-media" : undefined }}
                aria-label={`Open fullscreen image ${photo + 1} of ${images.length} for ${product.name}`}
              >
                {photoLayers.previous !== photoLayers.current && images[photoLayers.previous] && (
                  <ResilientImage
                    src={images[photoLayers.previous]}
                    alt=""
                    aria-hidden="true"
                    sizes="(max-width: 1280px) 55vw, 760px"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <ResilientImage
                  key={photoLayers.current}
                  src={images[photoLayers.current]}
                  alt={`${product.name}, view ${photoLayers.current + 1}`}
                  loading="eager"
                  sizes="(max-width: 1280px) 55vw, 760px"
                  className="cc-enter-fade absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out"
                  style={{ transform: zoomOrigin ? "scale(1.9)" : undefined, transformOrigin: zoomOrigin ?? undefined }}
                />
                <span className="pointer-events-none absolute right-4 top-4 inline-flex h-10 items-center gap-2 rounded-full bg-white/90 px-3.5 text-[11px] font-semibold text-foreground opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100">
                  <ZoomIn size={14} /> Click to view full screen
                </span>
                <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
                  {photo + 1} / {images.length}
                </span>
              </button>
            </div>
          </section>

          <section className="min-w-0 lg:pt-2">
            <p className="cc-enter-up text-[11px] font-bold tracking-[.18em] text-muted-foreground">
              {product.category.toUpperCase()} <span className="px-1">·</span>
              {(product.subcategory || subcategoryFor(product.id)).toUpperCase()}
            </p>
            <h1 className="cc-enter-up mt-3 font-serif text-4xl leading-[1.02] tracking-[-.02em] sm:text-5xl xl:text-6xl" style={{ ["--i" as string]: 1 }}>
              {product.name}
            </h1>
            <div className="cc-enter-up mt-5 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ ["--i" as string]: 2 }}>
              <p className="text-2xl font-semibold tabular-nums">{money(product.price)}</p>
              {product.reviews > 0 ? (
                <a href="#reviews" onClick={(event) => { event.preventDefault(); document.getElementById("reviews")?.scrollIntoView({ behavior: prefersReducedMotionNow() ? "auto" : "smooth" }); }} className="rounded-full underline-offset-4 hover:underline">
                  <StarRating value={Number(product.rating)} count={product.reviews} showValue />
                </a>
              ) : (
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                  No reviews yet
                </span>
              )}
            </div>
            <p className="cc-enter-up mt-6 max-w-xl text-[15px] leading-7 text-muted-foreground" style={{ ["--i" as string]: 3 }}>
              {product.description}
            </p>
            <div className="cc-enter-up mt-6 flex flex-wrap items-center gap-3 text-sm" style={{ ["--i" as string]: 3 }}>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${availabilityTone}`} aria-label={`Availability: ${availabilityText}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" /> {availabilityText}
              </span>
              {product.color && <span className="text-xs text-muted-foreground">Finish · <span className="font-semibold text-foreground">{product.color}</span></span>}
            </div>

            <div ref={ctaRef} className="cc-enter-up mt-7 flex gap-2.5 sm:gap-3" style={{ ["--i" as string]: 4 }}>
              <div className="flex h-14 items-center rounded-2xl border border-border bg-card">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={!liveAvailable || quantity <= 1}
                  className="grid h-full w-11 place-items-center rounded-l-2xl hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Decrease ${product.name} quantity`}
                >
                  <Minus size={15} />
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity}</span>
                <button
                  onClick={() =>
                    setQuantity(
                      stockLimit === null
                        ? quantity + 1
                        : Math.min(stockLimit, quantity + 1),
                    )
                  }
                  disabled={!liveAvailable || atStockLimit}
                  className="grid h-full w-11 place-items-center rounded-r-2xl hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={
                    atStockLimit && stockLimit !== null
                      ? `Maximum available stock is ${stockLimit}`
                      : `Increase ${product.name} quantity`
                  }
                >
                  <Plus size={15} />
                </button>
              </div>
              <button
                onClick={addToBag}
                disabled={!liveAvailable || outOfStock}
                data-fly-source
                className={`cc-press relative flex h-14 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-semibold text-background shadow-[0_10px_24px_rgba(28,27,25,.18)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${justAdded ? "bg-[#3f5139]" : "bg-foreground hover:bg-[#35322e]"}`}
              >
                <span key={addLabel} className="cc-enter-fade inline-flex items-center gap-2">
                  {justAdded ? <Check size={17} /> : <ShoppingBag size={17} />}
                  {addLabel}
                </span>
              </button>
              <button
                onClick={() => toggle(product.id)}
                disabled={!liveAvailable}
                aria-pressed={isSaved}
                className="cc-press grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border bg-card hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart key={String(isSaved)} size={19} fill={isSaved ? "currentColor" : "none"} className={isSaved ? "cc-pop text-[#9a4f46]" : ""} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={!liveAvailable} aria-pressed={compared} onClick={() => { const result = toggleComparedProduct(product.id); setCompared(result.ids.includes(product.id)); setAlertNotice(result.limitReached ? "Compare up to four products. Remove one first." : result.added ? "Added to comparison." : "Removed from comparison."); }} className={`${pillButton} ${compared ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}><Scale size={14}/>{compared ? "In comparison" : "Compare"}</button>
              {outOfStock && <button type="button" disabled={!liveAvailable || alertBusy === "back_in_stock"} onClick={() => void toggleAlert("back_in_stock")} className={`${pillButton} ${alerts.includes("back_in_stock") ? "border-[#6d8065] bg-[#e7eee3] text-[#50664b]" : "border-border bg-card hover:bg-secondary"}`}><Bell size={14}/>{alerts.includes("back_in_stock") ? "Back-in-stock alert on" : "Notify when available"}</button>}
              <button type="button" disabled={!liveAvailable || alertBusy === "price_drop"} onClick={() => void toggleAlert("price_drop")} className={`${pillButton} ${alerts.includes("price_drop") ? "border-[#6d8065] bg-[#e7eee3] text-[#50664b]" : "border-border bg-card hover:bg-secondary"}`}><Bell size={14}/>{alerts.includes("price_drop") ? "Price alert on" : "Alert me at 10% off"}</button>
              <button type="button" onClick={() => void shareProduct()} className={`${pillButton} border-border bg-card hover:bg-secondary`}><Share2 size={14}/>{shareNotice || "Share"}</button>
            </div>
            {alertNotice && <p className="cc-enter-fade mt-2.5 text-xs font-semibold text-muted-foreground" role="status">{alertNotice}</p>}

            <div className="mt-7 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><Truck size={16}/></span><h2 className="text-sm font-semibold">Delivery estimate</h2></div>
                <label className="relative">
                  <span className="sr-only">Delivery area</span>
                  <select value={deliveryAreaCode} onChange={(event) => setDeliveryAreaCode(event.target.value)} className="h-10 appearance-none rounded-xl border border-border bg-background pl-3 pr-9 text-xs font-semibold" aria-label="Delivery area">
                    {deliveryAreas.map((area) => <option key={area.id} value={area.area_code}>{area.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </label>
              </div>
              {selectedDeliveryArea && deliveryWindow ? (
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <p><span className="block text-muted-foreground">Arrives</span><span className="mt-1 block text-sm font-semibold">{deliveryWindow.earliest.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – {deliveryWindow.latest.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span></p>
                  <p><span className="block text-muted-foreground">Delivery</span><span className="mt-1 block text-sm font-semibold">{deliveryFee === 0 ? "Free" : money(deliveryFee ?? 0)}</span></p>
                  <p><span className="block text-muted-foreground">Assembly</span><span className="mt-1 block text-sm font-semibold">{selectedDeliveryArea.assembly_available ? "Available" : "Guidance included"}</span></p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Delivery dates appear once service areas load.</p>
              )}
            </div>

            <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] leading-4 text-muted-foreground">
              {[[Package, "Careful delivery"], [ShieldCheck, "Secure checkout"], [MessageCircle, "CozyCraft Care"]].map(([Icon, label]) => {
                const TrustIcon = Icon as typeof Package;
                return <li key={label as string} className="flex flex-col items-center gap-2 rounded-2xl bg-secondary/60 px-2 py-3"><TrustIcon size={16} className="text-foreground/70" />{label as string}</li>;
              })}
            </ul>

            <div
              className="mt-6 divide-y divide-border border-y border-border"
              onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest("summary")) galleryHold.hold();
              }}
            >
              <details className="cc-accordion group" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">Materials & finish<Plus size={16} className="shrink-0 transition duration-300 group-open:rotate-45" /></summary>
                <ul className="grid gap-3 pb-6 text-sm">
                  {materialItems.map((material, index) => (
                    <li key={`${material.type}-${index}`} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-4">
                      <strong className="font-semibold">{material.type || "Material"}</strong>
                      <span className="break-words text-muted-foreground">{material.description || (index === 0 ? product.color : "")}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <details className="cc-accordion group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">Dimensions & fit<Plus size={16} className="shrink-0 transition duration-300 group-open:rotate-45" /></summary>
                <div className="pb-6">
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {dimensionItems.map((dimension, index) => (
                      <div key={`${dimension.label}-${index}`} className="rounded-xl border border-border bg-card px-3 py-2.5">
                        <dt className="text-[11px] text-muted-foreground">{dimension.label || "Measurement"}</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">{dimension.value}{dimension.unit ? ` ${dimension.unit}` : ""}</dd>
                      </div>
                    ))}
                  </dl>
                  <ProductMeasurements specs={dimensionItems} name={product.name} type={product.subcategory || subcategoryFor(product.id)} />
                  <section className="mt-4 rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2"><Ruler size={16}/><h3 className="text-sm font-semibold">Will it fit?</h3></div>
                    <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] font-semibold text-muted-foreground">Room width (cm)<input inputMode="decimal" value={roomWidth} onChange={(event) => setRoomWidth(event.target.value.replace(/[^0-9.]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground" placeholder="e.g. 300"/></label><label className="text-[11px] font-semibold text-muted-foreground">Room depth (cm)<input inputMode="decimal" value={roomDepth} onChange={(event) => setRoomDepth(event.target.value.replace(/[^0-9.]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground" placeholder="e.g. 250"/></label></div>
                    {fitChecked && <p className={`cc-enter-fade mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${fitsRoom ? "bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]" : "bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)]"}`}>{fitsRoom ? `Fits with about ${Math.round(Number(roomWidth) - productWidth)} cm width and ${Math.round(Number(roomDepth) - productDepth)} cm depth to spare.` : `This piece needs at least ${productWidth} × ${productDepth} cm. Recheck your room and access path.`}</p>}
                    {!Number.isFinite(productWidth) && <p className="mt-3 text-[11px] text-muted-foreground">Detailed width and depth measurements are still being prepared.</p>}
                  </section>
                </div>
              </details>
              <details className="cc-accordion group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">Delivery & assembly<Plus size={16} className="shrink-0 transition duration-300 group-open:rotate-45" /></summary>
                <p className="pb-6 text-sm leading-7 text-muted-foreground">Furniture is carefully prepared for delivery. Order tracking appears in your account, with assembly guidance included when applicable. Measure doorways, stairs and lifts before ordering larger pieces.</p>
              </details>
              <details className="cc-accordion group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">Care & payment<Plus size={16} className="shrink-0 transition duration-300 group-open:rotate-45" /></summary>
                <p className="pb-6 text-sm leading-7 text-muted-foreground">Follow the included material-care instructions to protect the finish, and contact CozyCraft Care if a piece arrives with an issue. Pay by cash on delivery, card or GCash; online payments are completed on PayMongo’s secure checkout.</p>
              </details>
            </div>
          </section>
        </div>

        {related.complete.length > 0 && (
          <section className="mt-20 border-t border-border pt-12 lg:mt-28" aria-labelledby="complete-room-title">
            <div data-reveal className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">COMPLETE THE ROOM</p>
                <h2 id="complete-room-title" className="mt-3 font-serif text-4xl">Pieces that belong together.</h2>
              </div>
              <Link to={collectionPath} className="cc-underline hidden text-sm font-semibold sm:inline-block">Shop {product.category.toLowerCase()}</Link>
            </div>
            <ProductGrid className="mt-9" products={related.complete} pending={catalogPending} skeletons={4} />
          </section>
        )}
        {related.similar.length > 0 && (
          <section className="mt-16 border-t border-border pt-12" aria-labelledby="similar-title">
            <div data-reveal>
              <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">SIMILAR PIECES</p>
              <h2 id="similar-title" className="mt-3 font-serif text-4xl">You may also like.</h2>
            </div>
            <ProductGrid className="mt-9" products={related.similar} pending={catalogPending} skeletons={4} />
          </section>
        )}

        <section
          id="reviews"
          className="mt-20 scroll-mt-24 border-t border-border pt-12"
        >
          <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-14">
            <aside data-reveal className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">CUSTOMER REVIEWS</p>
              <h2 className="mt-3 font-serif text-4xl">Loved in real homes.</h2>
              <div className="mt-6 rounded-[1.5rem] border border-border bg-card p-6">
                <div className="flex items-end gap-3">
                  <span className="font-serif text-6xl leading-none tabular-nums">{product.reviews ? reviewAverage.toFixed(1) : "—"}</span>
                  <span className="pb-1.5">
                    <StarRating value={reviewAverage} size={15} />
                    <span className="mt-1 block text-xs text-muted-foreground">{product.reviews ? `${product.reviews} verified review${product.reviews === 1 ? "" : "s"}` : "No reviews yet"}</span>
                  </span>
                </div>
                <div className="mt-6 grid gap-2">
                  {[5, 4, 3, 2, 1].map((star, index) => {
                    const count = ratingCounts?.[index] ?? 0;
                    const share = reviewTotalCount ? (count / reviewTotalCount) * 100 : 0;
                    const selected = reviewFilter === String(star);
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewFilter(selected ? "All" : String(star))}
                        aria-pressed={selected}
                        className={`group grid grid-cols-[2.25rem_1fr_2rem] items-center gap-3 rounded-lg px-1.5 py-1 text-xs transition-colors ${selected ? "bg-secondary" : "hover:bg-secondary/60"}`}
                      >
                        <span className="inline-flex items-center gap-1 font-semibold">{star}<Star size={11} fill="currentColor" strokeWidth={0} className="text-[#a4814f]" /></span>
                        <span className="h-2 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-[#a4814f] transition-[width] duration-700 ease-out" style={{ width: `${share}%` }} /></span>
                        <span className="text-right tabular-nums text-muted-foreground">{ratingCounts ? count : "–"}</span>
                      </button>
                    );
                  })}
                </div>
                {reviewFilter !== "All" && <button type="button" onClick={() => setReviewFilter("All")} className="mt-4 text-xs font-semibold underline underline-offset-4">Show all reviews</button>}
                {!userId && <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground"><Link to={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`} className="font-semibold text-foreground underline underline-offset-4">Sign in</Link> after delivery to share your own review.</p>}
              </div>
            </aside>
            <div className="min-w-0">
              {userId && mayReview ? (
                <form
                  onSubmit={submitReview}
                  className="rounded-[1.5rem] border border-border bg-[#f4f0e9] p-5 sm:p-6"
                >
                  <p className="text-sm font-semibold">
                    {existingReview
                      ? `Update your ${hasPurchased ? "verified " : ""}review`
                      : hasPurchased ? "Review your delivered purchase" : "Review this product"}
                  </p>
                  <fieldset className="mt-4">
                    <legend className="text-xs text-muted-foreground">Your rating</legend>
                    <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Your rating">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          role="radio"
                          aria-checked={reviewRating === rating}
                          aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                          onClick={() => setReviewRating(rating)}
                          className="cc-press grid h-10 w-10 place-items-center rounded-full hover:bg-white"
                        >
                          <Star size={22} fill={rating <= reviewRating ? "currentColor" : "none"} strokeWidth={1.6} className={rating <= reviewRating ? "text-[#a4814f]" : "text-[#b9ae9e]"} />
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <input
                    value={reviewTitle}
                    onChange={(event) => setReviewTitle(event.target.value)}
                    placeholder="Review title"
                    aria-label="Review title"
                    className="mt-4 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm"
                  />
                  <textarea
                    value={reviewBody}
                    onChange={(event) => setReviewBody(event.target.value)}
                    required
                    aria-label="Your review"
                    minLength={storeSettings.review_settings.minimum_length}
                    maxLength={storeSettings.review_settings.maximum_length}
                    placeholder="Tell other customers about this piece"
                    className="mt-3 min-h-28 w-full rounded-xl border border-border bg-card p-4 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-muted-foreground tabular-nums">{reviewBody.length}/{storeSettings.review_settings.maximum_length} characters · minimum {storeSettings.review_settings.minimum_length}</p>
                    <button
                      disabled={submittingReview}
                      className="cc-press h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingReview
                        ? "Saving review…"
                        : existingReview
                          ? "Update review"
                          : "Publish review"}
                    </button>
                  </div>
                  {reviewNotice && (
                    <p className="cc-enter-fade mt-3 text-xs font-semibold text-[#56714f]" role="status">
                      {reviewNotice}
                    </p>
                  )}
                </form>
              ) : null}
              <div className={`grid gap-4 ${userId && mayReview ? "mt-6" : ""}`}>
                {visibleReviews.map((review) => (
                  <article
                    key={review.id}
                    data-reveal
                    className="overflow-hidden rounded-[1.5rem] border border-border bg-card"
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ReviewerAvatar
                            reviewId={review.id}
                            displayName={review.reviewer_display_name}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">@{review.reviewer_display_name}</p>
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#56714f]"><Check size={11} strokeWidth={3} /> Verified customer</p>
                          </div>
                        </div>
                        <StarRating value={review.rating} size={13} />
                      </div>
                      {review.title && <h3 className="mt-4 font-serif text-xl leading-snug">{review.title}</h3>}
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{review.body}</p>
                      <time dateTime={review.created_at} className="mt-4 block text-[11px] text-muted-foreground">{new Date(review.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" })}</time>
                    </div>
                    {review.image_urls.length > 0 && <div className="border-t border-border bg-[#f4f0e9] p-4"><p className="mb-3 text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">Photos from this home</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{review.image_urls.map((url, index) => <button key={`${review.id}-${index}`} onClick={() => setReviewGallery({ reviewId: review.id, index })} className="group cc-media relative aspect-square overflow-hidden rounded-xl bg-secondary" aria-label={`View photo ${index + 1} from ${review.reviewer_display_name}'s review`}><ResilientImage src={url} alt={`${review.reviewer_display_name}'s product review photo ${index + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/></button>)}</div></div>}
                  </article>
                ))}
              </div>
              {!visibleReviews.length && (
                <div className="mt-2 rounded-[1.5rem] border border-dashed border-border bg-card p-10 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary"><Star size={18} /></span>
                  <p className="mt-4 font-serif text-2xl">{reviewFilter !== "All" ? "No reviews with this rating yet." : "No reviews yet."}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{reviewFilter !== "All" ? "Try another star rating." : "Customers who receive this piece can be the first to share their experience."}</p>
                </div>
              )}
              {reviewTotal > 5 && <DataPagination page={reviewPage} total={reviewTotal} size={5} onChange={setReviewPage} label="Product review pages"/>}
            </div>
          </div>
        </section>
        {reviewGallery && galleryReview?.image_urls[reviewGallery.index] && createPortal(<div className="cc-backdrop fixed inset-0 z-[300] grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-6" data-state="open" role="dialog" aria-modal="true" aria-label="Customer review photo" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewGallery(null); }}><section data-state="open" className="cc-dialog flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] bg-[#171614] text-white shadow-2xl"><header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-semibold">@{galleryReview.reviewer_display_name}</p><p className="mt-0.5 text-[11px] text-white/60">Review photo {reviewGallery.index + 1} of {galleryReview.image_urls.length}</p></div><button onClick={() => setReviewGallery(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close review photo"><X size={18}/></button></header><div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:p-5"><ResilientImage key={reviewGallery.index} src={galleryReview.image_urls[reviewGallery.index]} alt={`${galleryReview.reviewer_display_name}'s review photo ${reviewGallery.index + 1}`} className="cc-enter-fade max-h-[76dvh] w-auto max-w-full object-contain"/>{galleryReview.image_urls.length > 1 && <><button onClick={() => setReviewGallery((current) => current && ({ ...current, index: (current.index - 1 + galleryReview.image_urls.length) % galleryReview.image_urls.length }))} className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-black/65 hover:bg-black" aria-label="Previous review photo"><ChevronLeft/></button><button onClick={() => setReviewGallery((current) => current && ({ ...current, index: (current.index + 1) % galleryReview.image_urls.length }))} className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-black/65 hover:bg-black" aria-label="Next review photo"><ChevronRight/></button></>}</div><footer className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-white/70 sm:px-5">{galleryReview.body}</footer></section></div>, document.body)}
        {productGalleryOpen && createPortal(
          <div
            className="cc-backdrop fixed inset-0 z-[350] grid place-items-center bg-black/92 p-2 backdrop-blur-sm sm:p-6"
            data-state="open"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-gallery-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setProductGalleryOpen(false);
            }}
          >
            <section ref={productGalleryPanelRef} data-state="open" className="cc-dialog flex h-[min(94dvh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#171614] text-white shadow-2xl">
              <header className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 id="product-gallery-title" className="truncate text-sm font-semibold">{product.name}</h2>
                  <p className="mt-0.5 text-[11px] text-white/60">Image {photo + 1} of {images.length} · Swipe or use arrow keys</p>
                </div>
                <button ref={productGalleryCloseRef} type="button" onClick={() => setProductGalleryOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Close product image gallery"><X size={19}/></button>
              </header>
              <div
                className="relative flex min-h-0 flex-1 touch-pinch-zoom items-center justify-center overflow-auto bg-black p-3 sm:p-5"
                style={{ touchAction: "pinch-zoom" }}
                onTouchStart={(event) => {
                  productGalleryTouchStartRef.current = event.touches.length === 1 ? event.touches[0].clientX : null;
                }}
                onTouchEnd={(event) => {
                  const start = productGalleryTouchStartRef.current;
                  productGalleryTouchStartRef.current = null;
                  if (start === null || event.changedTouches.length !== 1) return;
                  const distance = event.changedTouches[0].clientX - start;
                  if (Math.abs(distance) < 45) return;
                  setPhoto((current) => distance > 0 ? (current - 1 + images.length) % images.length : (current + 1) % images.length);
                }}
              >
                <ResilientImage key={photo} optimize={false} src={images[photo]} alt={`${product.name}, fullscreen view ${photo + 1}`} loading="eager" className="cc-enter-fade max-h-full w-auto max-w-full select-none object-contain" draggable={false}/>
                {images.length > 1 && (
                  <>
                    <button type="button" onClick={() => setPhoto((current) => (current - 1 + images.length) % images.length)} className="absolute left-3 grid h-12 w-12 place-items-center rounded-full bg-white/10 shadow-lg backdrop-blur transition hover:bg-white/20 sm:left-5" aria-label="Previous product image"><ChevronLeft size={22}/></button>
                    <button type="button" onClick={() => setPhoto((current) => (current + 1) % images.length)} className="absolute right-3 grid h-12 w-12 place-items-center rounded-full bg-white/10 shadow-lg backdrop-blur transition hover:bg-white/20 sm:right-5" aria-label="Next product image"><ChevronRight size={22}/></button>
                  </>
                )}
              </div>
              <footer className="flex gap-2 overflow-x-auto border-t border-white/10 p-3 sm:justify-center sm:p-4">
                {images.map((image, index) => (
                  <button key={`${image}-fullscreen-${index}`} type="button" onClick={() => setPhoto(index)} aria-pressed={photo === index} aria-label={`Show image ${index + 1}`} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-16 ${photo === index ? "border-white" : "border-transparent opacity-55 hover:opacity-100"}`}>
                    <ResilientImage src={image} alt="" className="h-full w-full object-cover"/>
                  </button>
                ))}
              </footer>
            </section>
          </div>,
          document.body,
        )}
        {recentProducts.length>0&&<section className="mt-20 border-t border-border pt-12"><div data-reveal className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">CONTINUE BROWSING</p><h2 className="mt-3 font-serif text-4xl">Recently viewed.</h2><p className="mt-2 text-sm text-muted-foreground">Pick up where you left off on this or another signed-in device.</p></div><Link to="/shop" className="cc-underline hidden text-sm font-semibold sm:block">Explore all products</Link></div><ProductGrid className="mt-9" products={recentProducts} /></section>}
        <div
          aria-hidden={ctaVisible || undefined}
          className={`fixed inset-x-0 bottom-[var(--mobile-store-nav-height)] z-30 flex items-center gap-3 border-t border-border bg-[#fbfaf7]/95 px-4 py-3 shadow-[0_-12px_30px_rgba(35,31,27,.12)] backdrop-blur-xl transition duration-500 ease-[cubic-bezier(.22,1,.36,1)] lg:hidden ${ctaVisible ? "pointer-events-none translate-y-[calc(100%+var(--mobile-store-nav-height))] opacity-0" : "translate-y-0 opacity-100"}`}
        >
          <span className="cc-media h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary"><ResilientImage src={images[photoLayers.current] ?? images[0]} alt="" className="h-full w-full object-cover" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-0.5 text-sm font-bold tabular-nums">{money(product.price * quantity)}</p></div>
          <button tabIndex={ctaVisible ? -1 : undefined} onClick={() => toggle(product.id)} disabled={!liveAvailable} aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"} className="cc-press grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card disabled:cursor-not-allowed disabled:opacity-40"><Heart size={17} fill={isSaved ? "currentColor" : "none"} /></button>
          <button tabIndex={ctaVisible ? -1 : undefined} data-fly-source onClick={addToBag} disabled={!liveAvailable || outOfStock} className={`cc-press h-11 shrink-0 rounded-xl px-5 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50 ${justAdded ? "bg-[#3f5139]" : "bg-foreground"}`}>{addLabel}</button>
        </div>
      </main>
      {availabilityDialogOpen && createPortal(
        <div className="cc-backdrop fixed inset-0 z-[400] grid place-items-center bg-[#1f1d1a]/65 p-4 backdrop-blur-sm" data-state="open" role="dialog" aria-modal="true" aria-labelledby="product-unavailable-title">
          <section data-state="open" className="cc-dialog relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#fbfaf7] p-7 shadow-2xl sm:p-9">
            <button type="button" onClick={() => setAvailabilityDialogOpen(false)} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-border bg-white transition hover:bg-secondary" aria-label="Close unavailable product notice"><X size={17}/></button>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#efe5dc] text-[#754d3d]"><EyeOff size={23}/></span>
            <p className="mt-6 text-[11px] font-bold tracking-[.18em] text-muted-foreground">AVAILABILITY UPDATE</p>
            <h2 id="product-unavailable-title" className="mt-2 pr-8 font-serif text-4xl leading-tight">This piece is no longer available.</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              <strong className="text-foreground">{product.name}</strong> was just hidden from the store while you were viewing it. It cannot be added to your bag, wishlist, or comparison right now.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setAvailabilityDialogOpen(false)} className="cc-press min-h-12 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary">Stay on page</button>
              <button type="button" onClick={() => nav(collectionPath)} className="cc-press min-h-12 rounded-xl bg-foreground px-4 text-sm font-semibold text-background">View similar pieces</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </Layout>
  );
}

export function JournalPage() {
  const { slug } = useParams();
  const { products, catalogPending, storeSettings } = useStore();
  const entry = findJournalEntry(slug);
  usePageTitle(entry?.title, storeSettings.store_name || undefined);
  if (!entry) return <NotFound />;
  const suggestions = sortProducts(
    products.filter((product) => entry.rooms.some((room) => catalogValuesMatch(product.category, room))),
    "popular",
  ).slice(0, 4);
  const other = journalEntries.find((item) => item.slug !== entry.slug);
  return (
    <Layout>
      <main>
        <article>
          <header className="mx-auto max-w-[1440px] px-5 pt-6 lg:px-10 lg:pt-10">
            <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
              <Link to="/home" className="hover:text-foreground">Home</Link>
              <span className="mx-2">/</span>
              <span>Journal</span>
            </nav>
            <div className="mx-auto mt-10 max-w-3xl text-center">
              <p className="cc-enter-up text-[11px] font-bold tracking-[.2em] text-muted-foreground">{entry.kicker} · {entry.readMinutes} MIN READ</p>
              <h1 className="cc-enter-up mt-5 font-serif text-4xl leading-[1.04] tracking-[-.02em] sm:text-6xl" style={{ ["--i" as string]: 1 }}>{entry.title}</h1>
              <p className="cc-enter-up mx-auto mt-6 max-w-xl text-base leading-8 text-muted-foreground" style={{ ["--i" as string]: 2 }}>{entry.summary}</p>
            </div>
            <div data-reveal="scale" className="cc-media relative mt-12 h-[320px] overflow-hidden rounded-[2rem] bg-secondary sm:h-[480px] lg:h-[620px]">
              <ResilientImage src={entry.image} alt="" loading="eager" sizes="100vw" className="cc-kenburns absolute inset-0 h-full w-full object-cover" />
            </div>
          </header>
          <div className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
            {entry.sections.map((section, index) => (
              <section key={index} data-reveal className={index ? "mt-12" : ""}>
                {section.heading && <h2 className="font-serif text-3xl leading-tight">{section.heading}</h2>}
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className={`text-[17px] leading-8 text-foreground/80 ${section.heading ? "mt-4" : index === 0 ? "font-serif text-2xl leading-10 text-foreground first-letter:float-left first-letter:mr-3 first-letter:font-serif first-letter:text-7xl first-letter:leading-[.8]" : "mt-4"}`}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-24">
            <div data-reveal className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">SHOP THE NOTE</p>
                <h2 className="mt-3 font-serif text-4xl">Pieces that suit the idea.</h2>
              </div>
              <Link to={`/${entry.rooms[0] === "Bedroom" ? "bedroom" : "living-room"}`} className="cc-underline hidden text-sm font-semibold sm:inline-block">Explore the room</Link>
            </div>
            <ProductGrid className="mt-10" products={suggestions} pending={catalogPending} skeletons={4} />
          </div>
        </section>
        {other && (
          <section className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10">
            <Link to={`/journal/${other.slug}`} data-reveal className="group grid overflow-hidden rounded-[2rem] border border-border bg-card md:grid-cols-2">
              <span className="cc-media block h-64 overflow-hidden bg-secondary md:h-auto">
                <ResilientImage src={other.image.replace("w=1800", "w=1000")} alt="" className="h-full w-full object-cover transition duration-[1200ms] group-hover:scale-105" />
              </span>
              <span className="flex flex-col justify-center p-8 sm:p-12">
                <span className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">NEXT NOTE</span>
                <span className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">{other.title}</span>
                <span className="mt-4 text-sm leading-7 text-muted-foreground">{other.summary}</span>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">Read the note <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
              </span>
            </Link>
          </section>
        )}
      </main>
    </Layout>
  );
}

export function NotFound() {
  const { products, catalogPending } = useStore();
  const favourites = sortProducts(products, "popular").slice(0, 4);
  return (
    <Layout>
      <main>
        <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-10 lg:py-24">
          <div className="cc-enter-up">
            <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">ERROR 404 · PAGE NOT FOUND</p>
            <h1 className="mt-5 font-serif text-5xl leading-[1] tracking-[-.02em] sm:text-7xl">This room is still empty.</h1>
            <p className="mt-6 max-w-md text-base leading-8 text-muted-foreground">
              The page you were looking for has moved or never existed. Let’s find you somewhere comfortable to land.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/home" className="cc-press inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background hover:bg-[#35322e]">
                Back to home <ArrowRight size={15} />
              </Link>
              <Link to="/shop" className="cc-press inline-flex h-12 items-center rounded-full border border-border px-6 text-sm font-semibold hover:bg-secondary">
                Shop all pieces
              </Link>
            </div>
          </div>
          <div data-reveal="scale" className="cc-media relative h-[320px] overflow-hidden rounded-[2rem] bg-secondary sm:h-[440px]">
            <ResilientImage src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <span className="absolute bottom-6 left-6 font-serif text-8xl text-white/90">404</span>
          </div>
        </section>
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10">
            <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">CUSTOMER FAVOURITES</p>
            <h2 className="mt-3 font-serif text-4xl">Perhaps one of these?</h2>
            <ProductGrid className="mt-10" products={favourites} pending={catalogPending} skeletons={4} />
          </div>
        </section>
      </main>
    </Layout>
  );
}

import { getCachedContentPage } from "@/services/content/content.service";
