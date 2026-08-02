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
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
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
  parseDimensionSpecs,
  parseMaterialSpecs,
} from "@/lib/product-specs";

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
} from "../../core";


export function Home() {
  const { products } = useStore();
  const slides = [
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
              <ImageWithFallback
                key={item.title}
                src={item.image}
                alt={item.title}
                className={`absolute inset-0 h-full w-full scale-[1.02] object-cover transition-all duration-[1600ms] ease-out ${index === active ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[1.06]"}`}
              />
            ))}
            <div className="absolute inset-0 bg-black/42" />
            <div className="absolute inset-x-0 top-[76px] h-px bg-white/25" />
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
                  <a
                    href="#shop"
                    className="rounded-full bg-[#f6f2eb] px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-white"
                  >
                    {slide.action}
                  </a>
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
            <ImageWithFallback
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
            <ImageWithFallback
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
      <ImageWithFallback
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

export function About() {
  const team = [
    { name: "Joylyn Campuso", role: "Product & Research", initials: "CJ" },
    {
      name: "Jacob Christopher Cañete",
      role: "Platform Development",
      initials: "JC",
    },
    {
      name: "Prince Balane",
      role: "Project Lead · Vision Ventures",
      initials: "PB",
      lead: true,
    },
    { name: "Angela Faith Suba", role: "Customer Experience", initials: "AS" },
    {
      name: "Hydee Mae Sumalinog",
      role: "Operations & Quality",
      initials: "HS",
    },
  ];
  return (
    <Layout>
      <main>
        <section className="mx-auto max-w-[1440px] px-5 py-5 lg:px-10">
          <div className="relative min-h-[590px] overflow-hidden rounded-[2rem] bg-[#282924]">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=88"
              alt="A quiet CozyCraft living space"
              className="absolute inset-0 h-full w-full object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1d1d1a]/85 via-[#1d1d1a]/45 to-transparent" />
            <div className="relative flex min-h-[590px] max-w-3xl flex-col justify-end p-7 text-[#f7f3eb] sm:p-14">
              <p className="text-[10px] font-bold tracking-[.22em] text-[#dfd4c7]">
                COZYCRAFT FURNITURES · EST. 2026
              </p>
              <h1 className="mt-5 font-serif text-5xl leading-[1.02] sm:text-7xl">
                Your home starts with the perfect furniture.
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#e3dcd2]">
                A more convenient, reliable way to discover, order, and bring
                home pieces made for everyday living.
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
                CozyCraft Furnitures was founded in 2026 by Vision
                Ventures—Prince Balane, Joylyn Campuso, Jacob Christopher
                Cañete, Angela Faith Suba, and Hydee Mae Sumalinog—with the
                project led by Prince Balane.
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
              <p className="max-w-sm text-sm leading-6 text-[#d4cdc2]">
                Photo spaces are ready for each member to customize when your
                official team images are available.
              </p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {team.map((member) => (
                <article
                  key={member.name}
                  className={`rounded-2xl border p-4 ${member.lead ? "border-[#c8ae8b] bg-[#3a3934] lg:col-span-1" : "border-white/10 bg-white/5"}`}
                >
                  <div className="grid aspect-square place-items-center rounded-xl bg-[#d4c3aa] font-serif text-4xl text-[#292a26]">
                    {member.initials}
                  </div>
                  <p className="mt-5 text-sm font-semibold">{member.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#c9c0b3]">
                    {member.role}
                  </p>
                  {member.lead && (
                    <span className="mt-4 inline-block rounded-full border border-[#c8ae8b]/60 px-2 py-1 text-[9px] font-bold tracking-[.12em] text-[#d8c3a6]">
                      TEAM LEADER
                    </span>
                  )}
                  <p className="mt-4 text-[10px] text-[#9f988f]">
                    Photo placeholder
                  </p>
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
      "Living Room": ["Sofas", "Coffee Tables", "TV Stands"],
      Bedroom: ["Beds", "Wardrobes", "Nightstands"],
      "Dining Room": ["Dining Tables", "Dining Chairs", "Dining Storage"],
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
  const { products } = useStore();
  const { room } = useParams();
  const current = room ?? useLocation().pathname.slice(1) ?? "living-room";
  const info =
    roomCollections[current as keyof typeof roomCollections] ??
    roomCollections["living-room"];
  const groups = Object.keys(info.groups);
  const [group, setGroup] = useState(groups[0]);
  const [subcategory, setSubcategory] = useState("");
  useEffect(() => {
    setGroup(groups[0]);
    setSubcategory("");
  }, [current]);
  const children =
    (info.groups as Record<string, readonly string[]>)[group] ?? [];
  const matchesSubcategory = (product: Product, value: string) =>
    product.subcategory === value ||
    (!product.subcategory &&
      (subcategoryProductMap[value] ?? []).includes(product.id));
  let items =
    info.match === "new"
      ? products.slice(0, 6)
      : products.filter((p) => p.category === info.match);
  if (info.match === "new")
    items = items.filter(
      (p) => p.category.toLowerCase() === group.toLowerCase(),
    );
  if (subcategory) {
    items = items.filter((product) =>
      matchesSubcategory(product, subcategory),
    );
  } else if (children.length) {
    items = items.filter((product) =>
      children.some((child) => matchesSubcategory(product, child)),
    );
  }
  return (
    <Layout>
      <main>
        <section className="mx-auto max-w-[1440px] px-5 pt-5 lg:px-10">
          <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-secondary">
            <ImageWithFallback
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
                onClick={() => setSubcategory("")}
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
      </main>
    </Layout>
  );
}

type ProductReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

const normalizeProductReviews = (
  rows: Array<Omit<ProductReview, "profiles"> & { profiles: ProductReview["profiles"] | Array<NonNullable<ProductReview["profiles"]>> }>,
): ProductReview[] => rows.map((row) => ({
  ...row,
  profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
}));

export function ProductPage() {
  const { productId } = useParams();
  const { add, toggle, saved, products, userId, orders } = useStore();
  const product = products.find((p) => p.id === productId) ?? products[0];
  const [photo, setPhoto] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewFilter, setReviewFilter] = useState("All");
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [existingReview, setExistingReview] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
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
          "id,rating,title,body,created_at,profiles!reviews_user_id_fkey(full_name)",
        )
        .eq("product_id", product.id)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (active) setReviews(normalizeProductReviews(data ?? []));
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          filter: `id=eq.${product.id}`,
        },
        loadReviews,
      )
      .subscribe();
    const interval = window.setInterval(loadReviews, 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
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
  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !userId ||
      !hasPurchased ||
      reviewBody.trim().length < 5 ||
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
          : "Your review was updated and remains hidden by moderation."),
    );
    if (!error) {
      setExistingReview(true);
      const { data: refreshedReviews } = await supabase
        .from("reviews")
        .select(
          "id,rating,title,body,created_at,profiles!reviews_user_id_fkey(full_name)",
        )
        .eq("product_id", product.id)
        .eq("approved", true)
        .order("created_at", { ascending: false });
      if (refreshedReviews) {
        setReviews(normalizeProductReviews(refreshedReviews));
      }
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
              <ImageWithFallback
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
                  <ImageWithFallback
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
                <span className="text-[#62755a]">● {product.stock}</span>
              </div>
            </div>
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
                {product.rating} average from {product.reviews} verified reviews
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
          {userId && hasPurchased ? (
            <form
              onSubmit={submitReview}
              className="mt-7 rounded-2xl border border-border bg-[#f4f0e9] p-5"
            >
              <p className="text-sm font-semibold">
                {existingReview
                  ? "Update your verified review"
                  : "Review your delivered purchase"}
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
                minLength={5}
                maxLength={2000}
                placeholder="Tell other customers about this piece"
                className="mt-3 min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm"
              />
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
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {review.profiles?.full_name || "CozyCraft customer"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verified customer ·{" "}
                      {new Date(review.created_at).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="flex gap-0.5 text-[#9d7b5b]">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={13}
                        fill={
                          index < review.rating ? "currentColor" : "none"
                        }
                      />
                    ))}
                  </span>
                </div>
                {review.title && (
                  <h3 className="mt-4 text-sm font-semibold">
                    {review.title}
                  </h3>
                )}
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {review.body}
                </p>
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
        {recentProducts.length>0&&<section className="mt-16 border-t border-border pt-10"><p className="text-[10px] font-bold tracking-[.17em] text-muted-foreground">CONTINUE BROWSING</p><div className="mt-3 flex items-end justify-between gap-4"><div><h2 className="font-serif text-4xl">Recently viewed.</h2><p className="mt-2 text-sm text-muted-foreground">Pick up where you left off on this or another signed-in device.</p></div><Link to="/home#shop" className="hidden text-xs font-semibold underline underline-offset-4 sm:block">Explore all products</Link></div><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{recentProducts.map((item)=><ProductCard key={item.id} product={item}/>)}</div></section>}
      </main>
    </Layout>
  );
}
