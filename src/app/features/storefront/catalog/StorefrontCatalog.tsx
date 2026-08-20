import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
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
import { selectNewArrivals } from "@/lib/catalog/new-arrivals";
import {
  filterByPriceRange,
  STOREFRONT_MAX_PRICE,
} from "@/lib/catalog/price-range";
import {
  catalogValuesMatch,
  matchesCatalogSearch,
  matchesCatalogSubcategory,
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
import { productMainImageIndex } from "@/lib/catalog/product-images";
import { exactStockAvailability } from "@/lib/catalog/stock-availability";
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
  Empty,
  ConfirmSignOut,
  Status,
  ManagedProduct,
  Toast,
  Metric,
  Splash,
  ShopSignInPrompt
} from "@/app/core";


export function Home() {
  const { products } = useStore();
  const fallbackSlides = [
    {
      eyebrow: "THE 2026 COLLECTION",
      title: "Furniture that makes home feel complete.",
      copy: "Considered pieces for the rooms that carry your everyday rituals.",
      image:
        "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?auto=format&fit=crop&w=1800&q=88",
      action: "Shop collection",
    },
    {
      eyebrow: "THE LIVING EDIT",
      title: "Room to settle into.",
      copy: "Soft forms, honest materials, and a slower point of view for the everyday living room.",
      image:
        "https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1800&q=88",
      action: "Explore living room",
    },
    {
      eyebrow: "NEW ARRIVALS",
      title: "A softer shape of modern.",
      copy: "Discover new pieces made to grow more beautiful with each season at home.",
      image:
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=88",
      action: "Discover the edit",
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
        path: banner.cta_path,
      }))
    : fallbackSlides.map((slide) => ({ ...slide, path: "#shop" }));
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setActive((v) => (v + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const slide = slides[active];
  const move = (direction: number) =>
    setActive((v) => (v + direction + slides.length) % slides.length);
  return (
    <Layout immersive>
      <main>
        <section>
          <div className="relative min-h-screen overflow-hidden bg-[#171614]">
            {slides.map((item, index) => (
              <ResilientImage
                key={item.title}
                src={item.image}
                alt={item.title}
                className={`absolute inset-0 h-full w-full scale-[1.02] object-cover transition-all duration-[1600ms] ease-out ${index === active ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[1.06]"}`}
              />
            ))}
            <div className="absolute inset-0 bg-black/42" />
            <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col justify-end px-7 pb-24 pt-32 text-[#f8f6f1] sm:px-14 sm:pb-28">
              <div className="max-w-3xl">
                <div className="mb-6 flex items-center gap-3">
                  <span className="h-px w-10 bg-[#d6c1a5]" />
                  <p className="text-[10px] font-bold tracking-[.23em] text-[#f4eadf]">
                    {slide.eyebrow}
                  </p>
                </div>
                <h1 className="max-w-2xl font-[Playfair_Display] text-5xl leading-[.96] tracking-[-.045em] sm:text-7xl lg:text-[5.8rem]">
                  {slide.title}
                </h1>
                <div className="mt-7 flex max-w-xl items-start gap-5">
                  <span className="mt-2 h-8 w-px bg-white/55" />
                  <p className="text-sm leading-6 text-white/85">
                    {slide.copy}
                  </p>
                </div>
                <div className="mt-9 flex flex-wrap items-center gap-5">
                  <Link
                    to={slide.path}
                    className="rounded-full bg-[#f6f2eb] px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-white"
                  >
                    {slide.action}
                  </Link>
                  <a
                    href="#collections"
                    className="text-sm font-semibold underline underline-offset-4"
                  >
                    Explore rooms
                  </a>
                </div>
              </div>
            </div>
            <div className="absolute bottom-9 left-7 flex items-center gap-4 text-white sm:left-14">
              <span className="font-mono text-[11px]">0{active + 1}</span>
              <div className="flex gap-2">
                {slides.map((_, i) => (
                  <button
                    onClick={() => setActive(i)}
                    key={i}
                    aria-label={`Show slide ${i + 1}`}
                    className={`h-px transition-all ${active === i ? "w-12 bg-white" : "w-5 bg-white/50 hover:bg-white"}`}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] text-white/60">
                0{slides.length}
              </span>
            </div>
            <div className="absolute bottom-9 right-7 flex items-center gap-2 text-white sm:right-14">
              <span className="mr-3 hidden text-[10px] font-bold tracking-[.17em] text-white/70 sm:block">
                CHAPTER {active + 1}
              </span>
              <button
                onClick={() => move(-1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/60 bg-black/15 transition hover:bg-white hover:text-foreground"
                aria-label="Previous hero slide"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => move(1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/60 bg-black/15 transition hover:bg-white hover:text-foreground"
                aria-label="Next hero slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
        <section
          id="collections"
          className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-24 [&>div:last-child>a]:rounded-[1.75rem] [&>div:last-child>a]:shadow-[0_14px_36px_rgba(35,31,27,.10)]"
        >
          <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
            SHOP BY ROOM
          </p>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="font-[Playfair_Display] text-4xl tracking-[-.025em] sm:text-5xl">
              Begin with a feeling.
            </h2>
            <a
              href="#shop"
              className="hidden text-sm font-semibold underline underline-offset-4 sm:block"
            >
              Shop all pieces
            </a>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-12">
            <Room
              span="md:col-span-6"
              title="Living room"
              text="Sofas, tables & quiet corners"
              image="https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1000&q=85"
            />
            <Room
              span="md:col-span-3"
              title="Bedroom"
              text="Rest, made considered"
              image="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85"
            />
            <Room
              span="md:col-span-3"
              title="Dining room"
              text="Gather beautifully"
              image="https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=900&q=85"
            />
          </div>
        </section>
        <section id="shop" className="border-y border-border bg-card">
          <div className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-24">
            <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
              THE EDIT
            </p>
            <h2 className="mt-4 font-[Playfair_Display] text-4xl tracking-[-.025em] sm:text-5xl">
              Designed to be lived with.
            </h2>
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
              {products.map((p) => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          </div>
        </section>
        <section
          id="new"
          className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-24"
        >
          <div className="grid overflow-hidden rounded-[2rem] bg-[#cbb8a1] shadow-[0_14px_36px_rgba(35,31,27,.10)] lg:grid-cols-2">
            <div className="flex min-h-[400px] flex-col justify-between p-8 sm:p-14">
              <div>
                <p className="text-[10px] font-bold tracking-[.18em]">
                  THE NEW ARRIVALS
                </p>
                <h2 className="mt-5 max-w-md font-[Playfair_Display] text-4xl leading-[1.02] tracking-[-.035em] sm:text-5xl">
                  A softer shape of modern.
                </h2>
              </div>
              <Link
                to="/new-arrivals"
                className="inline-flex w-fit items-center gap-2 border-b border-foreground pb-1 text-sm font-semibold"
              >
                Discover the edit <ArrowRight size={16} />
              </Link>
            </div>
            <ResilientImage
              src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1100&q=85"
              alt="Neutral living room"
              className="h-[400px] w-full object-cover"
            />
          </div>
        </section>
        <section className="bg-[#272421] text-[#f4f2ee]">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 lg:grid-cols-[.75fr_1.25fr] lg:px-10 lg:py-28">
            <div>
              <p className="text-[10px] font-bold tracking-[.2em] text-[#f4f2ee]/55">
                MATERIAL STUDY / 01
              </p>
              <h2 className="mt-6 font-[Playfair_Display] text-4xl leading-[1.03] tracking-[-.035em] sm:text-5xl">
                Made to become part of the room.
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <p className="text-base leading-8 text-[#f4f2ee]/75">
                We look for materials that soften, deepen, and earn their place
                over time. Natural timber, tactile fabric, and finishes chosen
                for the life that happens around them.
              </p>
              <div className="border-l border-[#f4f2ee]/25 pl-6">
                <p className="font-[Playfair_Display] text-4xl">100%</p>
                <p className="mt-2 text-sm leading-6 text-[#f4f2ee]/60">
                  thoughtful sourcing
                  <br />
                  in every collection
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1440px] px-5 py-20 lg:px-10 lg:py-28">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <ResilientImage
              src="https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1400&q=86"
              alt="A restful CozyCraft bedroom space"
              className="h-[540px] w-full rounded-[2rem] object-cover shadow-[0_14px_36px_rgba(35,31,27,.10)]"
            />
            <div className="flex flex-col justify-between rounded-[2rem] bg-secondary p-8 shadow-[0_14px_36px_rgba(35,31,27,.06)] lg:p-10">
              <div>
                <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
                  AT HOME WITH COZYCRAFT
                </p>
                <h2 className="mt-5 font-[Playfair_Display] text-4xl leading-[1.06] tracking-[-.03em]">
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
                  className="mt-6 inline-flex items-center gap-2 border-b border-foreground pb-1 text-sm font-semibold"
                >
                  Our story <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-20 lg:grid-cols-[1fr_.9fr] lg:px-10 lg:py-24">
            <div>
              <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
                FROM THE STUDIO
              </p>
              <h2 className="mt-5 max-w-xl font-[Playfair_Display] text-4xl leading-[1.02] tracking-[-.035em] sm:text-5xl">
                Small notes on making a more personal home.
              </h2>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              <article className="bg-card p-6">
                <p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">
                  GUIDE / 06.26
                </p>
                <h3 className="mt-12 font-[Playfair_Display] text-2xl">
                  How to layer texture in a quieter space.
                </h3>
                <a
                  href="#shop"
                  className="mt-7 inline-flex items-center gap-2 text-xs font-semibold"
                >
                  Read note <ArrowRight size={14} />
                </a>
              </article>
              <article className="bg-card p-6">
                <p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">
                  JOURNAL / 06.26
                </p>
                <h3 className="mt-12 font-[Playfair_Display] text-2xl">
                  A room shaped around the evening light.
                </h3>
                <a
                  href="#shop"
                  className="mt-7 inline-flex items-center gap-2 text-xs font-semibold"
                >
                  Read note <ArrowRight size={14} />
                </a>
              </article>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1440px] px-5 py-20 lg:px-10 lg:py-28">
          <div className="flex flex-col items-start justify-between gap-7 border-y border-foreground py-10 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
                KEEP IN TOUCH
              </p>
              <h2 className="mt-4 max-w-xl font-[Playfair_Display] text-4xl tracking-[-.03em]">
                New pieces and quieter ideas, sent occasionally.
              </h2>
            </div>
            <div className="flex w-full max-w-sm border-b border-foreground">
              <input
                type="email"
                name="newsletter-email"
                aria-label="Email address for CozyCraft updates"
                autoComplete="email"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Your email address"
              />
              <button type="button" className="text-sm font-semibold">Join</button>
            </div>
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
      className={`group relative h-[340px] overflow-hidden ${span}`}
    >
      <ResilientImage
        src={image}
        alt={title}
        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-x-6 bottom-6 text-white">
        <h3 className="font-[Playfair_Display] text-3xl">{title}</h3>
        <p className="mt-1 text-xs text-white/85">{text}</p>
      </div>
    </Link>
  );
}

export function StaticContentPage() {
  const slug = useLocation().pathname.replace(/^\//, "") || "contact";
  const [content, setContent] = useState<ContentPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setContent(null);
    setIsLoading(true);
    const load = () => void getContentPage(slug, true)
      .then(setContent)
      .catch(() => setContent(null))
      .finally(() => setIsLoading(false));
    load();
    const channel = supabase.channel(`storefront-content-${slug}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "content_pages", filter: `slug=eq.${slug}` },
      () => { clearContentCache(slug); load(); },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [slug]);
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

  if (slug === "faq") {
    return <FaqInformationPage content={page} sections={sections} />;
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
  return <ContactInformationPage content={page} sections={sections} />;
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
}: {
  content: ContentPage;
  sections: ManagedContentSection[];
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
        <section className="mx-auto max-w-[1440px] px-5 pb-5 pt-6 sm:px-7 lg:px-10 lg:pb-10 lg:pt-10">
          <div className="grid overflow-hidden rounded-[2rem] border border-black/10 bg-[#22231f] text-white shadow-[0_26px_80px_rgba(32,30,25,.14)] lg:min-h-[510px] lg:grid-cols-[1.08fr_.92fr]">
            <div className="flex min-w-0 flex-col justify-between p-7 sm:p-10 lg:p-14">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#d8c6aa]">
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
                  <p className="text-[10px] font-bold uppercase tracking-[.24em] text-black/45">
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
}: {
  content: ContentPage;
  sections: ManagedContentSection[];
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
        <section className="border-b border-black/10">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:px-7 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:items-end lg:px-10 lg:py-24">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
                <HelpCircle size={20} />
              </div>
              <p className="mt-8 text-[10px] font-bold uppercase tracking-[.28em] text-black/45">
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
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/45">
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
                <p className="text-[10px] font-bold uppercase tracking-[.22em] text-black/40">
                  Answers, clearly
                </p>
                <h2 className="mt-2 font-serif text-3xl tracking-[-.03em] sm:text-4xl">
                  What customers ask us.
                </h2>
              </div>
              <span className="shrink-0 text-sm text-black/45">{filtered.length} results</span>
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
              <p className="mt-9 text-[10px] font-bold uppercase tracking-[.28em] text-black/48">
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
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-black/40">On this page</p>
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
              <p className="text-[10px] font-bold tracking-[.22em] text-[#dfd4c7]">
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
          <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
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
                <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
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
                <article key={number} className="bg-[#f7f4ee] p-6">
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
          <div className="grid gap-10 lg:grid-cols-[1fr_.8fr]">
            <div>
              <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
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
                <p className="text-[10px] font-bold tracking-[.2em] text-[#c9c0b3]">
                  VISION VENTURES
                </p>
                <h2 className="mt-4 font-serif text-4xl">Meet the team.</h2>
              </div>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {team.map((member) => (
                <article
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
                    <span className="mt-4 inline-block rounded-full border border-[#c8ae8b]/60 px-2 py-1 text-[9px] font-bold tracking-[.12em] text-[#d8c3a6]">
                      TEAM LEADER
                    </span>
                  )}
                  {!member.image && (
                    <p className="mt-4 text-[10px] text-[#9f988f]">
                      Photo placeholder
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1120px] px-5 py-20 text-center">
          <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
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

export const roomCollections = {
  "living-room": {
    title: "Living room",
    eyebrow: "THE LIVING EDIT",
    copy: "Pieces for the room that holds the most life.",
    image:
      "https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1800&q=88",
    groups: {
      Sofas: [
        "2-Seater Fabric Sofa",
        "3-Seater Fabric Sofa",
        "Sectional Sofa",
        "Recliner Sofa",
        "Sofa Bed",
      ],
      "Coffee Tables": [
        "Wooden Coffee Table",
        "Glass Coffee Table",
        "Round Coffee Table",
        "Storage Coffee Table",
        "Marble Coffee Table",
      ],
      "TV Stands": [
        "Wooden TV Stand",
        "Floating TV Stand",
        "Corner TV Stand",
        "TV Cart",
        "Modern TV Stand",
      ],
    },
    match: "Living room",
  },
  bedroom: {
    title: "Bedroom",
    eyebrow: "REST, MADE CONSIDERED",
    copy: "A slower start and a softer finish to every day.",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1800&q=88",
    groups: {
      Beds: [
        "Single Size Bed",
        "Double Size Bed",
        "Queen Size Bed",
        "King Size Bed",
        "Bunk Bed",
      ],
      Wardrobes: [
        "2-Door Wardrobe",
        "3-Door Wardrobe",
        "Sliding Door Wardrobe",
        "Walk-in Wardrobe",
        "Corner Wardrobe",
      ],
      Nightstands: [
        "Wooden Nightstand",
        "Modern Nightstand",
        "Floating Nightstand",
        "Nightstand with Drawer",
        "Metal Nightstand",
      ],
    },
    match: "Bedroom",
  },
  "dining-room": {
    title: "Dining room",
    eyebrow: "GATHER BEAUTIFULLY",
    copy: "A collection for shared plates, long stories, and everyday ceremony.",
    image:
      "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1800&q=88",
    groups: {
      "Dining Tables": [
        "Extendable Dining Table",
        "Marble Top Dining Table",
        "Glass Dining Table",
        "Wooden Ornate Dining Table",
        "Metal Industrial Dining Table",
      ],
      "Dining Chairs": [
        "Wooden Ornate Dining Chairs",
        "Modern Plastic Dining Chairs",
        "Metal Industrial Dining Chairs",
        "Molded Resin Dining Chairs",
        "Luxury Velvet Dining Chairs",
      ],
      "Dining Storage": [
        "Dining Hutch Cabinet",
        "Buffet Cabinet",
        "Pantry Cabinets",
        "Wine Storage Cabinet",
        "Serving Trolleys",
      ],
    },
    match: "Dining room",
  },
  "new-arrivals": {
    title: "New arrivals",
    eyebrow: "JUST IN THE ROOM",
    copy: "Fresh forms and thoughtful finishes for a home still becoming itself.",
    image:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=88",
    groups: {
      All: [],
      "Living room": [],
      Bedroom: [],
      "Dining room": [],
    },
    match: "new",
  },
} as const;

export const subcategoryProductMap: Record<string, string[]> = {
  "2-Seater Fabric Sofa": ["mara"],
  "3-Seater Fabric Sofa": ["mara"],
  "Sectional Sofa": ["hugo"],
  "Recliner Sofa": ["mara"],
  "Sofa Bed": ["hugo"],
  "Wooden Coffee Table": ["nilo"],
  "Round Coffee Table": ["nilo"],
  "Storage Coffee Table": ["nilo"],
  "Marble Coffee Table": ["nilo"],
  "Wooden TV Stand": ["lino"],
  "Floating TV Stand": ["lino"],
  "Corner TV Stand": ["lino"],
  "TV Cart": ["lino"],
  "Modern TV Stand": ["lino"],
  "Single Size Bed": ["santo"],
  "Double Size Bed": ["santo"],
  "Queen Size Bed": ["santo"],
  "King Size Bed": ["santo"],
  "Bunk Bed": ["santo"],
  "2-Door Wardrobe": ["sola"],
  "3-Door Wardrobe": ["sola"],
  "Sliding Door Wardrobe": ["sola"],
  "Walk-in Wardrobe": ["sola"],
  "Corner Wardrobe": ["sola"],
  "Wooden Nightstand": ["milo"],
  "Modern Nightstand": ["milo"],
  "Floating Nightstand": ["milo"],
  "Nightstand with Drawer": ["milo"],
  "Metal Nightstand": ["milo"],
  "Extendable Dining Table": ["arco"],
  "Marble Top Dining Table": ["arco"],
  "Glass Dining Table": ["arco"],
  "Wooden Ornate Dining Table": ["arco"],
  "Metal Industrial Dining Table": ["arco"],
  "Wooden Ornate Dining Chairs": ["noma"],
  "Modern Plastic Dining Chairs": ["noma"],
  "Metal Industrial Dining Chairs": ["noma"],
  "Molded Resin Dining Chairs": ["noma"],
  "Luxury Velvet Dining Chairs": ["noma"],
  "Dining Hutch Cabinet": ["vera"],
  "Buffet Cabinet": ["vera"],
  "Pantry Cabinets": ["vera"],
  "Wine Storage Cabinet": ["vera"],
  "Serving Trolleys": ["vera"],
};

export function CollectionPage() {
  const { products, userId } = useStore();
  const { room } = useParams();
  const current = room ?? useLocation().pathname.slice(1) ?? "living-room";
  const info =
    roomCollections[current as keyof typeof roomCollections] ??
    roomCollections["living-room"];
  const collectionGroups = Object.keys(info.groups);
  const groups = info.match === "new" ? collectionGroups : ["All", ...collectionGroups];
  const [group, setGroup] = useState("All");
  const [subcategory, setSubcategory] = useState("");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [minimumPrice, setMinimumPrice] = useState(0);
  const [maximumPrice, setMaximumPrice] = useState(STOREFRONT_MAX_PRICE);
  const [sort, setSort] = useState<ProductSort>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [synonyms, setSynonyms] = useState<SearchSynonym[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>(() => readComparedProductIds());
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
    setGroup("All");
    setSubcategory("");
    setQuery("");
    setAvailability("all");
    setMaterialFilter("all");
    setMinimumPrice(0);
    setMaximumPrice(STOREFRONT_MAX_PRICE);
    setSort("featured");
  }, [current]);
  const children =
    group === "All"
      ? []
      : (info.groups as Record<string, readonly string[]>)[group] ?? [];
  const matchesSubcategory = (product: Product, value: string) =>
    matchesCatalogSubcategory(
      product,
      value,
      subcategoryProductMap[value] ?? [],
    );
  const collectionItems =
    info.match === "new"
      ? selectNewArrivals(products, group)
      : products.filter((p) => catalogValuesMatch(p.category, info.match));
  let items = collectionItems;
  const searchActive = Boolean(query.trim());
  if (!searchActive && subcategory) {
    items = items.filter((product) =>
      matchesSubcategory(product, subcategory),
    );
  } else if (!searchActive && info.match !== "new" && children.length) {
    items = items.filter((product) =>
      children.some((child) => matchesSubcategory(product, child)),
    );
  }
  const expandedQuery = expandCatalogQuery(query, synonyms);
  if (query.trim()) {
    items = items.filter((product) => matchesCatalogSearch(product, expandedQuery));
  }
  if (availability === "in-stock") items = items.filter((product) => (product.stockQuantity ?? 1) > 8);
  if (availability === "low-stock") items = items.filter((product) => (product.stockQuantity ?? 99) > 0 && (product.stockQuantity ?? 99) <= 8);
  if (materialFilter !== "all") {
    const materialAliases: Record<string, string[]> = {
      Wood: ["wood", "oak", "ash", "walnut", "veneer", "hardwood", "timber"],
      Fabric: ["fabric", "linen", "upholstery", "weave", "bouclé", "velvet"],
      Metal: ["metal", "steel", "brass", "aluminium", "aluminum"],
      Stone: ["stone", "marble", "travertine", "granite"],
      Leather: ["leather"],
    };
    items = items.filter((product) => {
      const source = (product.material || materialFor(product.id)).toLowerCase();
      return (materialAliases[materialFilter] ?? [materialFilter.toLowerCase()]).some((term) => source.includes(term));
    });
  }
  items = filterByPriceRange(items, minimumPrice, maximumPrice);
  items = sortProducts(items, sort);
  const searchSuggestions = query.trim().length >= 2
    ? collectionItems.filter((product) => matchesCatalogSearch(product, expandedQuery)).slice(0, 6)
    : [];
  useEffect(() => {
    if (!userId || query.trim().length < 2) return;
    const timeout = window.setTimeout(() => {
      void recordCatalogSearch(query, items.length, current).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [current, items.length, query, userId]);
  const materialOptions = ["Wood", "Fabric", "Metal", "Stone", "Leather"];
  const priceRangeActive =
    minimumPrice > 0 || maximumPrice < STOREFRONT_MAX_PRICE;
  const activeFilterCount = [query.trim(), availability !== "all", materialFilter !== "all", priceRangeActive].filter(Boolean).length;
  const clearFilters = () => {
    setQuery("");
    setAvailability("all");
    setMaterialFilter("all");
    setMinimumPrice(0);
    setMaximumPrice(STOREFRONT_MAX_PRICE);
  };
  return (
    <Layout>
      <main>
        <section className="mx-auto max-w-[1440px] px-5 pt-5 lg:px-10">
          <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-secondary">
            <ResilientImage
              src={info.image}
              alt={info.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/42" />
            <div className="relative mx-auto flex min-h-[420px] max-w-[1440px] flex-col justify-end px-7 py-12 text-white sm:px-12">
              <p className="text-[10px] font-bold tracking-[.2em]">
                {info.eyebrow}
              </p>
              <h1 className="mt-5 font-[Playfair_Display] text-4xl tracking-[-.04em] sm:text-7xl">
                {info.title}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/80">
                {info.copy}
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1440px] px-5 py-12 lg:px-10 lg:py-16">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_10px_30px_rgba(33,31,29,0.04)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  EXPLORE {info.title.toUpperCase()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {groups.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setGroup(item);
                        setSubcategory("");
                      }}
                      className={`rounded-full px-4 py-2.5 text-xs font-semibold transition ${group === item ? "bg-foreground text-background shadow-sm" : "border border-border bg-[#faf9f6] hover:bg-secondary"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {items.length} pieces
              </p>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative min-w-0 flex-1">
                  <label className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-border bg-background px-4">
                    <Search size={16} className="shrink-0 text-muted-foreground" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${info.title.toLowerCase()} pieces`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  {query.trim().length >= 2 && (
                    <div className="absolute inset-x-0 top-[calc(100%+.35rem)] z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                      {searchSuggestions.length ? searchSuggestions.map((suggestion) => (
                        <Link key={suggestion.id} to={`/products/${suggestion.id}`} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-secondary">
                          <ResilientImage src={suggestion.images[productMainImageIndex(suggestion)]} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{suggestion.name}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{suggestion.subcategory || suggestion.category}</span></span>
                          <span className="text-xs font-semibold">{money(suggestion.price)}</span>
                        </Link>
                      )) : (
                        <div className="px-4 py-4 text-xs text-muted-foreground"><p className="font-semibold text-foreground">No exact match yet</p><p className="mt-1">Try a room, material, product type, or clear the filters.</p></div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-semibold md:hidden"><SlidersHorizontal size={15} />Filters{activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[9px] text-background">{activeFilterCount}</span>}</button>
                  <select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value as ProductSort)} className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-xs font-semibold md:w-48">
                    <option value="featured">Featured</option><option value="newest">Newest</option><option value="popular">Most popular</option><option value="name-asc">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Highest rated</option>
                  </select>
                </div>
              </div>
              <div className={`${filtersOpen ? "grid" : "hidden"} mt-3 gap-3 rounded-2xl bg-secondary/55 p-3 sm:grid-cols-3 md:grid`}>
                <label className="grid gap-1.5 text-[10px] font-bold tracking-[.1em] text-muted-foreground">AVAILABILITY<select value={availability} onChange={(event) => setAvailability(event.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-normal text-foreground"><option value="all">All availability</option><option value="in-stock">In stock</option><option value="low-stock">Low stock</option></select></label>
                <label className="grid gap-1.5 text-[10px] font-bold tracking-[.1em] text-muted-foreground">MATERIAL<select value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-normal text-foreground"><option value="all">All materials</option>{materialOptions.map((material) => <option key={material} value={material}>{material}</option>)}</select></label>
                <fieldset className="grid gap-2 rounded-xl border border-border bg-card px-3 py-2 text-foreground">
                  <legend className="px-1 text-[10px] font-bold tracking-[.1em] text-muted-foreground">PRICE RANGE</legend>
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
                    <span>From {money(minimumPrice)}</span>
                    <span>To {money(maximumPrice)}</span>
                  </div>
                  <label className="grid grid-cols-[2.5rem_1fr] items-center gap-2 text-[10px] font-bold text-muted-foreground">
                    FROM
                    <input
                      type="range"
                      aria-label="Minimum price"
                      min={0}
                      max={STOREFRONT_MAX_PRICE}
                      step={1_000}
                      value={minimumPrice}
                      onChange={(event) =>
                        setMinimumPrice(
                          Math.min(Number(event.target.value), maximumPrice),
                        )
                      }
                      className="w-full accent-foreground"
                    />
                  </label>
                  <label className="grid grid-cols-[2.5rem_1fr] items-center gap-2 text-[10px] font-bold text-muted-foreground">
                    TO
                    <input
                      type="range"
                      aria-label="Maximum price"
                      min={0}
                      max={STOREFRONT_MAX_PRICE}
                      step={1_000}
                      value={maximumPrice}
                      onChange={(event) =>
                        setMaximumPrice(
                          Math.max(Number(event.target.value), minimumPrice),
                        )
                      }
                      className="w-full accent-foreground"
                    />
                  </label>
                </fieldset>
              </div>
              {activeFilterCount > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold"><span className="text-muted-foreground">ACTIVE FILTERS</span>{query && <span className="rounded-full bg-secondary px-3 py-1.5">Search: {query}</span>}{availability !== "all" && <span className="rounded-full bg-secondary px-3 py-1.5">{availability === "in-stock" ? "In stock" : "Low stock"}</span>}{materialFilter !== "all" && <span className="rounded-full bg-secondary px-3 py-1.5">{materialFilter}</span>}{priceRangeActive && <span className="rounded-full bg-secondary px-3 py-1.5">{money(minimumPrice)}–{money(maximumPrice)}</span>}<button onClick={clearFilters} className="px-2 py-1.5 underline underline-offset-4">Clear all</button></div>}
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-3 text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                {group.toUpperCase()} TYPES
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSubcategory("")}
                  className={`rounded-lg px-3 py-2 text-xs transition ${!subcategory ? "bg-secondary font-semibold" : "hover:bg-secondary"}`}
                >
                  All {group}
                </button>
                {children.map((child) => (
                  <button
                    onClick={() => setSubcategory(child)}
                    key={child}
                    className={`rounded-lg px-3 py-2 text-xs transition ${subcategory === child ? "bg-secondary font-semibold" : "hover:bg-secondary"}`}
                  >
                    {child}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {subcategory && (
            <div className="mt-6 flex items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm">
              <span>
                Showing <b>{subcategory}</b>
              </span>
              <button
                onClick={() => { setSubcategory(""); clearFilters(); }}
                className="text-xs font-semibold underline underline-offset-4"
              >
                Clear filter
              </button>
            </div>
          )}
          {items.length ? (
            <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="grid min-h-[280px] place-items-center text-center">
              <div>
                <p className="font-[Playfair_Display] text-3xl">
                  More pieces are arriving soon.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Join the studio notes to be first to know.
                </p>
              </div>
            </div>
          )}
        </section>
        {compareIds.length > 0 && (
          <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-[#201f1d] px-4 py-3 text-white shadow-2xl md:bottom-5">
            <Scale size={18} className="shrink-0" />
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold">Compare {compareIds.length} of 4 products</p><p className="mt-0.5 truncate text-[10px] text-white/60">Price, size, finish, ratings, and stock side by side.</p></div>
            <Link to="/compare" className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#201f1d]">Compare</Link>
            <button type="button" onClick={() => writeComparedProductIds([])} className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-label="Clear comparison"><X size={14}/></button>
          </div>
        )}
      </main>
    </Layout>
  );
}

export function ComparePage() {
  const { products } = useStore();
  const [ids, setIds] = useState<string[]>(() => readComparedProductIds());
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
  const rows = [
    ["Price", (product: Product) => money(product.price)],
    ["Room", (product: Product) => product.category],
    ["Product type", (product: Product) => product.subcategory || subcategoryFor(product.id)],
    ["Finish", (product: Product) => product.color],
    ["Materials", (product: Product) => parseMaterialSpecs(product.material || materialFor(product.id)).map((item) => `${item.type}: ${item.description}`).join(" · ")],
    ["Dimensions", (product: Product) => parseDimensionSpecs(product.dimensions).map((item) => `${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`).join(" · ") || "Details coming soon"],
    ["Customer rating", (product: Product) => `${product.rating} / 5 (${product.reviews} reviews)`],
    ["Availability", (product: Product) => exactStockAvailability(product.stockQuantity, product.stock)],
  ] as const;
  return <Layout><main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10 lg:py-16">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">PRODUCT COMPARISON</p><h1 className="mt-3 font-serif text-4xl sm:text-6xl">Choose with confidence.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Compare up to four pieces using the catalog data already loaded on this device.</p></div>{ids.length > 0 && <button type="button" onClick={() => writeComparedProductIds([])} className="text-xs font-semibold underline underline-offset-4">Clear comparison</button>}</div>
    {compared.length ? <div className="mt-9 overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr><th className="w-40 border-b border-r border-border bg-secondary/55 p-4 text-xs">Product</th>{compared.map((product) => <th key={product.id} className="min-w-[220px] border-b border-r border-border p-4 last:border-r-0"><div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary"><ResilientImage src={product.images[productMainImageIndex(product)]} alt={product.name} className="h-full w-full object-cover"/><button type="button" onClick={() => toggleComparedProduct(product.id)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/95 shadow" aria-label={`Remove ${product.name}`}><X size={14}/></button></div><Link to={`/products/${product.id}`} className="mt-3 block text-sm font-semibold hover:underline">{product.name}</Link></th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th className="border-b border-r border-border bg-secondary/35 p-4 align-top text-xs">{label}</th>{compared.map((product) => <td key={product.id} className="border-b border-r border-border p-4 align-top text-xs leading-5 text-muted-foreground last:border-r-0">{value(product)}</td>)}</tr>)}</tbody></table></div> : <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center"><Scale className="mx-auto text-muted-foreground"/><h2 className="mt-4 font-serif text-3xl">Your comparison is empty.</h2><p className="mt-2 text-sm text-muted-foreground">Use the scale icon on any product card to add a piece.</p><Link to="/living-room" className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">Browse products</Link></div>}
  </main></Layout>;
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
  image_urls: Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [],
}));

export function ProductPage() {
  const { productId } = useParams();
  const { add, toggle, saved, products, userId, orders, storeSettings } = useStore();
  const product = products.find((p) => p.id === productId) ?? products[0];
  const [photo, setPhoto] = useState(() => productMainImageIndex(product));
  const [quantity, setQuantity] = useState(1);
  const [reviewFilter, setReviewFilter] = useState("All");
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [existingReview, setExistingReview] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewGallery, setReviewGallery] = useState<{ reviewId: string; index: number } | null>(null);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryServiceArea[]>([]);
  const [deliveryAreaCode, setDeliveryAreaCode] = useState("");
  const [roomWidth, setRoomWidth] = useState("");
  const [roomDepth, setRoomDepth] = useState("");
  const [alerts, setAlerts] = useState<string[]>([]);
  const [alertBusy, setAlertBusy] = useState("");
  const [alertNotice, setAlertNotice] = useState("");
  const [compared, setCompared] = useState(() => readComparedProductIds().includes(product.id));
  const nav = useNavigate();
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
  const dimensionNumber = (labels: string[]) => {
    const item = dimensionItems.find((dimension) => {
      const normalizedLabel = dimension.label.trim().toLocaleLowerCase();
      return labels.some(
        (label) => normalizedLabel === label || normalizedLabel.startsWith(`${label} `),
      );
    });
    const firstNumber = item ? String(item.value).match(/-?\d+(?:\.\d+)?/)?.[0] : undefined;
    return firstNumber ? Number(firstNumber) : Number.NaN;
  };
  const productWidth = dimensionNumber(["width", "w"]);
  const productDepth = dimensionNumber(["depth", "length", "d"]);
  const fitChecked = Number(roomWidth) > 0 && Number(roomDepth) > 0 && Number.isFinite(productWidth) && Number.isFinite(productDepth);
  const fitsRoom = fitChecked && productWidth <= Number(roomWidth) && productDepth <= Number(roomDepth);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      const stored=JSON.parse(window.localStorage.getItem(key)??"[]") as unknown;
      const ids=Array.isArray(stored)?stored.filter((id):id is string=>typeof id==="string"):[];
      const next=[product.id,...ids.filter((id)=>id!==product.id)].slice(0,8);
      window.localStorage.setItem(key,JSON.stringify(next));
      if(active)setRecentProductIds(next.filter((id)=>id!==product.id).slice(0,4));
    };
    void remember();
    return()=>{active=false;};
  },[product.id,userId]);
  const recentProducts=recentProductIds.map((id)=>products.find((item)=>item.id===id)).filter((item):item is Product=>Boolean(item));
  useEffect(() => {
    let active = true;
    const loadReviews = () => {
      void supabase
        .from("reviews")
        .select(
          "id,rating,title,body,reviewer_display_name,image_urls,created_at",
        )
        .eq("product_id", product.id)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (active) setReviews(normalizeProductReviews((data ?? []) as ProductReview[]));
        });
    };
    loadReviews();
    const channel = supabase
      .channel(`product-reviews-${product.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reviews",
          filter: `product_id=eq.${product.id}`,
        },
        loadReviews,
      )
      .subscribe();
    window.addEventListener("focus", loadReviews);
    return () => {
      active = false;
      window.removeEventListener("focus", loadReviews);
      void supabase.removeChannel(channel);
    };
  }, [product.id]);
  useEffect(() => {
    if (!userId) {
      setExistingReview(false);
      return;
    }
    let active = true;
    void supabase
      .from("reviews")
      .select("rating,title,body")
      .eq("user_id", userId)
      .eq("product_id", product.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setExistingReview(true);
        setReviewRating(data.rating);
        setReviewTitle(data.title ?? "");
        setReviewBody(data.body ?? "");
      });
    return () => {
      active = false;
    };
  }, [product.id, userId]);
  const visibleReviews =
    reviewFilter === "All"
      ? reviews
      : reviews.filter((review) => review.rating === Number(reviewFilter));
  const hasPurchased = orders.some(
    (order) =>
      order.status === "delivered" &&
      order.order_items.some(
        (item) =>
          item.product_id === product.id ||
          item.product_name.trim().toLowerCase() ===
            product.name.trim().toLowerCase(),
      ),
  );
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
    const published = Array.isArray(data) ? data[0]?.approved : true;
    setReviewNotice(
      error?.message ??
        (published
          ? existingReview
            ? "Your verified review was updated."
            : "Your verified review is now published."
          : "Your review was saved and is awaiting moderation."),
    );
    if (!error) {
      setExistingReview(true);
      const { data: refreshedReviews } = await supabase
        .from("reviews")
        .select(
          "id,rating,title,body,reviewer_display_name,image_urls,created_at",
        )
        .eq("product_id", product.id)
        .eq("approved", true)
        .order("created_at", { ascending: false });
      if (refreshedReviews) {
        setReviews(normalizeProductReviews(refreshedReviews as ProductReview[]));
      }
    }
  };
  const reviewAverage = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
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
  const toggleAlert = async (type: "back_in_stock" | "price_drop") => {
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
  return (
    <Layout>
      <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10 lg:py-10">
        <button
          onClick={() => nav(-1)}
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"
        >
          <ArrowLeft size={15} />
          Back to collection
        </button>
        <div className="grid gap-9 lg:grid-cols-[1.1fr_.9fr] lg:gap-14">
          <section>
            <div className="aspect-[.93] overflow-hidden bg-secondary">
              <ResilientImage
                src={product.images[photo]}
                alt={`${product.name}, view ${photo + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {product.images.map((image, i) => (
                <button
                  onClick={() => setPhoto(i)}
                  key={image}
                  className={`aspect-square overflow-hidden border-2 ${photo === i ? "border-foreground" : "border-transparent"}`}
                >
                  <ResilientImage
                    src={image}
                    alt={`${product.name} alternate view ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Select an image to explore every view.
            </p>
          </section>
          <section className="lg:pt-4">
            <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
              {product.category.toUpperCase()} <span className="px-1">/</span>{" "}
              {(product.subcategory || subcategoryFor(product.id)).toUpperCase()}
            </p>
            <h1 className="mt-3 font-[Playfair_Display] text-4xl leading-none tracking-[-.035em] sm:text-5xl">
              {product.name}
            </h1>
            <div className="mt-5 flex items-center gap-3">
              <p className="text-xl font-semibold">{money(product.price)}</p>
              <span className="flex items-center gap-1 text-xs">
                <Star size={14} fill="currentColor" />
                {product.rating}{" "}
                <span className="text-muted-foreground">
                  ({product.reviews} reviews)
                </span>
              </span>
            </div>
            <p className="mt-7 max-w-lg text-sm leading-7 text-muted-foreground">
              {product.description}
            </p>
            <div className="mt-8 border-y border-border py-5 text-sm">
              <div className="grid gap-3 py-3 sm:grid-cols-[auto_1fr] sm:gap-5">
                <span className="text-muted-foreground">Finish / Material</span>
                <ul className="w-full space-y-2 sm:justify-self-end sm:max-w-[75%]">
                  {materialItems.map((material, index) => (
                    <li key={`${material.type}-${index}`} className="grid grid-cols-[10px_minmax(0,1fr)] gap-x-2 gap-y-1 sm:grid-cols-[10px_minmax(0,.8fr)_minmax(0,1.2fr)]">
                      <span aria-hidden="true">•</span>
                      <strong>{material.type || "Material"}</strong>
                      <span className="col-start-2 break-words text-left text-muted-foreground sm:col-start-auto sm:text-right">
                        {material.description || (index === 0 ? product.color : "")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3 py-3 sm:grid-cols-[auto_1fr] sm:gap-5">
                <span className="text-muted-foreground">Dimensions</span>
                <ul className="w-full space-y-2 sm:justify-self-end sm:max-w-[75%]">
                  {dimensionItems.map((dimension, index) => (
                    <li key={`${dimension.label}-${index}`} className="grid grid-cols-[10px_minmax(0,1fr)_auto] gap-2">
                      <span aria-hidden="true">•</span>
                      <strong>{dimension.label || "Measurement"}</strong>
                      <span className="text-right text-muted-foreground">
                        {dimension.value}{dimension.unit ? ` ${dimension.unit}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Availability</span>
                <span
                  className={outOfStock ? "text-[#9a493f]" : lowStock ? "text-[#8b6b36]" : "text-[#62755a]"}
                  aria-label={`Availability: ${stockAvailability}`}
                >
                  ● {stockAvailability}
                </span>
              </div>
            </div>
            <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
              <section>
                <div className="flex items-center gap-2"><Truck size={16}/><h2 className="text-xs font-semibold">Delivery estimate</h2></div>
                <select value={deliveryAreaCode} onChange={(event) => setDeliveryAreaCode(event.target.value)} className="mt-3 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" aria-label="Delivery area">
                  {deliveryAreas.map((area) => <option key={area.id} value={area.area_code}>{area.name}</option>)}
                </select>
                {selectedDeliveryArea && deliveryWindow && <div className="mt-3 text-[11px] leading-5 text-muted-foreground"><p className="font-semibold text-foreground">{deliveryWindow.earliest.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}–{deliveryWindow.latest.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</p><p>{deliveryFee === 0 ? "Free delivery" : `${money(deliveryFee ?? 0)} estimated delivery`} · {selectedDeliveryArea.assembly_available ? "Assembly available" : "Assembly guidance included"}</p></div>}
              </section>
              <section className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <div className="flex items-center gap-2"><Scale size={16}/><h2 className="text-xs font-semibold">Will it fit?</h2></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[9px] font-bold tracking-[.1em] text-muted-foreground">ROOM WIDTH (CM)<input inputMode="decimal" value={roomWidth} onChange={(event) => setRoomWidth(event.target.value.replace(/[^0-9.]/g, ""))} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground" placeholder="e.g. 300"/></label><label className="text-[9px] font-bold tracking-[.1em] text-muted-foreground">ROOM DEPTH (CM)<input inputMode="decimal" value={roomDepth} onChange={(event) => setRoomDepth(event.target.value.replace(/[^0-9.]/g, ""))} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground" placeholder="e.g. 250"/></label></div>
                {fitChecked && <p className={`mt-3 text-[11px] font-semibold ${fitsRoom ? "text-[#56714f]" : "text-[#8b5c46]"}`}>{fitsRoom ? `Fits with about ${Math.round(Number(roomWidth) - productWidth)} cm width and ${Math.round(Number(roomDepth) - productDepth)} cm depth clearance.` : `This piece needs at least ${productWidth} × ${productDepth} cm. Recheck your room and access path.`}</p>}
                {!Number.isFinite(productWidth) && <p className="mt-3 text-[10px] text-muted-foreground">Detailed width and depth measurements are still being prepared.</p>}
              </section>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => { const result = toggleComparedProduct(product.id); setCompared(result.ids.includes(product.id)); setAlertNotice(result.limitReached ? "Compare up to four products. Remove one first." : result.added ? "Added to comparison." : "Removed from comparison."); }} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${compared ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}><Scale size={14}/>{compared ? "In comparison" : "Compare"}</button>
              {outOfStock && <button type="button" disabled={alertBusy === "back_in_stock"} onClick={() => void toggleAlert("back_in_stock")} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${alerts.includes("back_in_stock") ? "border-[#6d8065] bg-[#e7eee3] text-[#50664b]" : "border-border bg-card"}`}><Bell size={14}/>{alerts.includes("back_in_stock") ? "Back-in-stock alert on" : "Notify when available"}</button>}
              <button type="button" disabled={alertBusy === "price_drop"} onClick={() => void toggleAlert("price_drop")} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${alerts.includes("price_drop") ? "border-[#6d8065] bg-[#e7eee3] text-[#50664b]" : "border-border bg-card"}`}><Bell size={14}/>{alerts.includes("price_drop") ? "Price alert on" : "Alert me at 10% off"}</button>
            </div>
            {alertNotice && <p className="mt-2 text-[10px] font-semibold text-muted-foreground" role="status">{alertNotice}</p>}
            <div className="mt-7 flex gap-3">
              <div className="flex h-12 items-center border border-border bg-card">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="grid h-full w-11 place-items-center"
                  aria-label={`Decrease ${product.name} quantity`}
                >
                  <Minus size={15} />
                </button>
                <span className="w-8 text-center text-sm">{quantity}</span>
                <button
                  onClick={() =>
                    setQuantity(
                      stockLimit === null
                        ? quantity + 1
                        : Math.min(stockLimit, quantity + 1),
                    )
                  }
                  disabled={atStockLimit}
                  className="grid h-full w-11 place-items-center disabled:cursor-not-allowed disabled:opacity-30"
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
                onClick={() => add(product.id, quantity)}
                disabled={outOfStock}
                className="flex h-12 flex-1 items-center justify-center gap-2 bg-foreground text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingBag size={17} />
                {outOfStock ? "Out of stock" : "Add to bag"}
              </button>
              <button
                onClick={() => toggle(product.id)}
                className="grid h-12 w-12 place-items-center border border-border"
                aria-label="Add to wishlist"
              >
                <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <div className="border border-border p-4">
                <ShieldCheck size={18} />
                <p className="mt-3 font-semibold">Made to last</p>
                <p className="mt-1 leading-5 text-muted-foreground">
                  Built with enduring materials.
                </p>
              </div>
              <div className="border border-border p-4">
                <Package size={18} />
                <p className="mt-3 font-semibold">Careful delivery</p>
                <p className="mt-1 leading-5 text-muted-foreground">
                  White-glove options available.
                </p>
              </div>
            </div>
          </section>
        </div>
        <section aria-label="Product services and care" className="mt-12 grid gap-3 lg:grid-cols-3">
          {[
            [Package, "Delivery & assembly", "Furniture is carefully prepared for delivery. Order tracking appears in your account, with assembly guidance included when applicable."],
            [ShieldCheck, "Care & quality", "Follow the included material-care instructions to protect the finish. Contact CozyCraft Care if a piece arrives with an issue."],
            [CreditCard, "Secure payment", "Choose cash on delivery, card, or GCash during checkout. Online payments are processed through PayMongo’s secure checkout."],
          ].map(([Icon, title, copy]) => (
            <details className="group rounded-2xl border border-border bg-card p-5 open:shadow-sm" key={title as string}>
              <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">{typeof Icon !== "string" && <Icon size={16} />}</span><span className="flex-1">{title as string}</span><ChevronDown size={15} className="transition group-open:rotate-180" /></summary>
              <p className="mt-4 text-xs leading-6 text-muted-foreground">{copy as string}</p>
            </details>
          ))}
        </section>
        <section
          id="reviews"
          className="mt-16 scroll-mt-24 border-t border-border pt-10"
        >
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold tracking-[.17em] text-muted-foreground">
                CUSTOMER REVIEWS
              </p>
              <h2 className="mt-3 font-serif text-4xl">
                Loved in real homes.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {reviews.length
                  ? `${reviewAverage.toFixed(1)} average from ${reviews.length} verified review${reviews.length === 1 ? "" : "s"}`
                  : "Approved customer reviews will appear here in realtime"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["All", "5", "4", "3", "2", "1"].map((filter) => (
                <button
                  onClick={() => setReviewFilter(filter)}
                  key={filter}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    reviewFilter === filter
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  {filter === "All"
                    ? "All reviews"
                    : `${filter} star${filter === "1" ? "" : "s"}`}
                </button>
              ))}
            </div>
          </div>
          {userId && mayReview ? (
            <form
              onSubmit={submitReview}
              className="mt-7 rounded-2xl border border-border bg-[#f4f0e9] p-5"
            >
              <p className="text-sm font-semibold">
                {existingReview
                  ? `Update your ${hasPurchased ? "verified " : ""}review`
                  : hasPurchased ? "Review your delivered purchase" : "Review this product"}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[130px_1fr]">
                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(Number(event.target.value))}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm"
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option value={rating} key={rating}>
                      {rating} stars
                    </option>
                  ))}
                </select>
                <input
                  value={reviewTitle}
                  onChange={(event) => setReviewTitle(event.target.value)}
                  placeholder="Review title"
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm"
                />
              </div>
              <textarea
                value={reviewBody}
                onChange={(event) => setReviewBody(event.target.value)}
                required
                minLength={storeSettings.review_settings.minimum_length}
                maxLength={storeSettings.review_settings.maximum_length}
                placeholder="Tell other customers about this piece"
                className="mt-3 min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">{reviewBody.length}/{storeSettings.review_settings.maximum_length} characters · minimum {storeSettings.review_settings.minimum_length}{storeSettings.review_settings.approval_required ? " · reviewed before publishing" : ""}</p>
              <button
                disabled={submittingReview}
                className="mt-3 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingReview
                  ? "Saving review..."
                  : existingReview
                    ? "Update review"
                    : "Publish review"}
              </button>
              {reviewNotice && (
                <p className="mt-3 text-xs font-semibold text-[#56714f]">
                  {reviewNotice}
                </p>
              )}
            </form>
          ) : userId ? (
            <p className="mt-7 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
              Review submission becomes available after this product is delivered.
            </p>
          ) : null}
          <div className="mt-7 grid gap-3 lg:grid-cols-2">
            {visibleReviews.map((review) => (
              <article
                key={review.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_28px_rgba(45,39,32,.04)]"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ded4c6] text-xs font-bold uppercase">{review.reviewer_display_name.slice(0, 2)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">@{review.reviewer_display_name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Verified customer</p>
                      </div>
                    </div>
                    <span className="flex shrink-0 gap-0.5 text-[#9d7b5b]" aria-label={`${review.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? "currentColor" : "none"}/>) }
                    </span>
                  </div>
                  {review.title && <h3 className="mt-4 text-sm font-semibold">{review.title}</h3>}
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.body}</p>
                  <time dateTime={review.created_at} className="mt-4 block border-t border-border pt-3 text-[11px] text-muted-foreground">Reviewed {new Date(review.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                </div>
                {review.image_urls.length > 0 && <div className="border-t border-border bg-[#f4f0e9] p-4"><p className="mb-3 text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">Photos from this home</p><div className={`grid gap-2 ${review.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>{review.image_urls.map((url, index) => <button key={`${review.id}-${index}`} onClick={() => setReviewGallery({ reviewId: review.id, index })} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary" aria-label={`View photo ${index + 1} from ${review.reviewer_display_name}'s review`}><ResilientImage src={url} alt={`${review.reviewer_display_name}'s product review photo ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/><span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white"><Eye size={14}/></span></button>)}</div></div>}
              </article>
            ))}
          </div>
          {!visibleReviews.length && (
            <p className="mt-8 rounded-2xl bg-secondary p-6 text-center text-sm text-muted-foreground">
              {reviews.length
                ? "No reviews match this star rating yet."
                : "No approved customer reviews yet. Be the first to share your experience."}
            </p>
          )}
        </section>
        {reviewGallery && galleryReview?.image_urls[reviewGallery.index] && createPortal(<div className="fixed inset-0 z-[300] grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Customer review photo" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewGallery(null); }}><section className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] bg-[#171614] text-white shadow-2xl"><header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-semibold">@{galleryReview.reviewer_display_name}</p><p className="mt-0.5 text-[10px] text-white/60">Review photo {reviewGallery.index + 1} of {galleryReview.image_urls.length}</p></div><button onClick={() => setReviewGallery(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10" aria-label="Close review photo"><X size={18}/></button></header><div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:p-5"><ResilientImage src={galleryReview.image_urls[reviewGallery.index]} alt={`${galleryReview.reviewer_display_name}'s review photo ${reviewGallery.index + 1}`} className="max-h-[76dvh] w-auto max-w-full object-contain"/>{galleryReview.image_urls.length > 1 && <><button onClick={() => setReviewGallery((current) => current && ({ ...current, index: (current.index - 1 + galleryReview.image_urls.length) % galleryReview.image_urls.length }))} className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-black/65" aria-label="Previous review photo"><ChevronLeft/></button><button onClick={() => setReviewGallery((current) => current && ({ ...current, index: (current.index + 1) % galleryReview.image_urls.length }))} className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-black/65" aria-label="Next review photo"><ChevronRight/></button></>}</div><footer className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-white/70 sm:px-5">{galleryReview.body}</footer></section></div>, document.body)}
        {recentProducts.length>0&&<section className="mt-16 border-t border-border pt-10"><p className="text-[10px] font-bold tracking-[.17em] text-muted-foreground">CONTINUE BROWSING</p><div className="mt-3 flex items-end justify-between gap-4"><div><h2 className="font-serif text-4xl">Recently viewed.</h2><p className="mt-2 text-sm text-muted-foreground">Pick up where you left off on this or another signed-in device.</p></div><Link to="/home#shop" className="hidden text-xs font-semibold underline underline-offset-4 sm:block">Explore all products</Link></div><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{recentProducts.map((item)=><ProductCard key={item.id} product={item}/>)}</div></section>}
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t border-border bg-card/97 px-4 py-3 shadow-[0_-10px_30px_rgba(35,31,27,.12)] backdrop-blur md:hidden">
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-0.5 text-sm font-bold">{money(product.price)}</p></div>
          <button onClick={() => toggle(product.id)} aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border"><Heart size={17} fill={isSaved ? "currentColor" : "none"} /></button>
          <button onClick={() => add(product.id, quantity)} disabled={outOfStock} className="h-11 rounded-xl bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-50">{outOfStock ? "Out of stock" : "Add to bag"}</button>
        </div>
      </main>
    </Layout>
  );
}
