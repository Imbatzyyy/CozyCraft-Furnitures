import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, CreditCard, Heart, MapPin, MessageCircle, Package, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import type { Product } from "@/app/core";
import type { DbOrder } from "@/services/supabase/client";
import { ResilientImage } from "@/components/media/ResilientImage";
import { primaryProductImage } from "@/lib/catalog/product-images";

const orderJourney: Array<{ key: DbOrder["status"]; label: string }> = [
  { key: "pending", label: "Placed" },
  { key: "processing", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

type AccountOverviewProps = {
  name: string;
  orders: DbOrder[];
  orderCount: number;
  savedProducts: Product[];
  cartCount: number;
  addressCount: number;
  money: (value: number) => string;
  openTab: (tab: string) => void;
};

/** The first thing a customer sees in My Account: what needs their attention. */
export function AccountOverview({ name, orders, orderCount, savedProducts, cartCount, addressCount, money, openTab }: AccountOverviewProps) {
  const navigate = useNavigate();
  const latest = orders[0];
  const step = latest ? orderJourney.findIndex((item) => item.key === latest.status) : -1;
  const cancelled = latest?.status === "cancelled";
  const stats: Array<[typeof Package, string, string | number, () => void]> = [
    [Package, "Orders", orderCount, () => openTab("Orders")],
    [Heart, "Saved pieces", savedProducts.length, () => navigate("/wishlist")],
    [ShoppingBag, "In your bag", cartCount, () => navigate("/cart")],
    [MapPin, "Addresses", addressCount, () => openTab("Addresses")],
  ];
  return (
    <div className="grid gap-6">
      <div className="cc-enter-up">
        <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">OVERVIEW</p>
        <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Your home, at a glance.</h2>
        <p className="mt-2 text-sm text-muted-foreground">{name ? `${name.split(" ")[0]}, here` : "Here"} is everything waiting for you, in one calm place.</p>
      </div>

      <div className="cc-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([Icon, label, value, open]) => (
          <button
            key={label}
            type="button"
            onClick={open}
            className="cc-press group flex flex-col items-start rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-foreground/30 hover:bg-white"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground/80"><Icon size={16} /></span>
            <span className="mt-4 font-serif text-3xl tabular-nums">{value}</span>
            <span className="mt-0.5 flex w-full items-center justify-between text-xs text-muted-foreground">
              {label}
              <ArrowRight size={13} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </span>
          </button>
        ))}
      </div>

      <section className="cc-enter-up overflow-hidden rounded-[1.5rem] border border-border bg-background" style={{ ["--i" as string]: 2 }} aria-labelledby="overview-latest-order">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h3 id="overview-latest-order" className="text-sm font-semibold">Latest order</h3>
          {latest && (
            <button type="button" onClick={() => openTab("Orders")} className="text-xs font-semibold underline-offset-4 hover:underline">
              All orders
            </button>
          )}
        </div>
        {latest ? (
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex -space-x-3">
                  {latest.order_items.slice(0, 3).map((item) => (
                    <span key={item.id} className="h-14 w-12 overflow-hidden rounded-xl border-2 border-background bg-secondary">
                      {item.image_url ? <ResilientImage src={item.image_url} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">#{latest.order_number}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(latest.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" })} · {latest.order_items.length} {latest.order_items.length === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              <p className="text-lg font-semibold tabular-nums">{money(Number(latest.total))}</p>
            </div>
            {cancelled ? (
              <p className="mt-5 rounded-xl bg-[var(--tone-danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--tone-danger-fg)]">This order was cancelled.</p>
            ) : (
              <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Order progress">
                {orderJourney.map((item, index) => {
                  const done = index <= step;
                  return (
                    <li key={item.key} className="min-w-0" aria-current={index === step ? "step" : undefined}>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-foreground transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: done ? "100%" : "0%", transitionDelay: `${index * 90}ms` }} />
                      </span>
                      <span className={`mt-2 hidden items-center gap-1 truncate text-[11px] sm:flex ${index === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {done && index < step && <Check size={11} strokeWidth={3} className="shrink-0 text-[var(--tone-success-fg)]" />}
                        <span className="truncate">{item.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {!cancelled && step >= 0 && (
              <p className="mt-3 text-xs font-semibold sm:hidden">
                {orderJourney[step].label} <span className="font-normal text-muted-foreground">· step {step + 1} of {orderJourney.length}</span>
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link to={`/orders?order=${encodeURIComponent(latest.id)}`} className="cc-press inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-xs font-semibold text-background hover:bg-[#35322e]">
                Track order <ArrowRight size={14} />
              </Link>
              <button type="button" onClick={() => openTab("Support")} className="cc-press inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:bg-secondary">
                <MessageCircle size={14} /> Get help
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="text-sm text-muted-foreground">No orders yet — your first delivery will be tracked here.</p>
            <Link to="/shop" className="cc-press inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-xs font-semibold text-background">Start shopping <ArrowRight size={14} /></Link>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <section className="cc-enter-up rounded-[1.5rem] border border-border bg-background p-5" style={{ ["--i" as string]: 3 }} aria-labelledby="overview-saved">
          <div className="flex items-center justify-between gap-3">
            <h3 id="overview-saved" className="text-sm font-semibold">Saved for later</h3>
            <Link to="/wishlist" className="text-xs font-semibold underline-offset-4 hover:underline">View wishlist</Link>
          </div>
          {savedProducts.length ? (
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {savedProducts.slice(0, 4).map((product) => (
                <Link key={product.id} to={`/products/${product.id}`} className="group block min-w-0">
                  <span className="cc-media block aspect-[4/5] overflow-hidden rounded-xl bg-secondary">
                    <ResilientImage src={primaryProductImage(product)} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  </span>
                  <span className="mt-1.5 block truncate text-[11px] font-semibold">{product.name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Tap the heart on any piece to keep it here.</p>
          )}
        </section>
        <button
          type="button"
          onClick={() => openTab("Home Circle")}
          className="cc-enter-up cc-press group relative overflow-hidden rounded-[1.5rem] bg-[#292a26] p-6 text-left text-[#f7f3eb]"
          style={{ ["--i" as string]: 4 }}
        >
          <span className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_80%_30%,rgba(194,162,123,.4),transparent_60%)]" />
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10"><Sparkles size={17} /></span>
          <span className="relative mt-5 block text-[11px] font-bold tracking-[.18em] text-white/60">HOME CIRCLE</span>
          <span className="relative mt-2 block font-serif text-2xl leading-snug">Points, tiers and rewards for your home.</span>
          <span className="relative mt-4 inline-flex items-center gap-1.5 text-xs font-semibold">See my rewards <ArrowUpRight size={14} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {([
          [CreditCard, "Payment preference", "Choose how you like to pay", "Payments"],
          [ShieldCheck, "Security", "Password, devices and sign-in", "Change password"],
          [MessageCircle, "CozyCraft Care", "Questions about an order", "Support"],
        ] as const).map(([Icon, title, text, tab]) => (
          <button key={title} type="button" onClick={() => openTab(tab)} className="cc-press group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left hover:bg-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary"><Icon size={16} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{text}</span></span>
            <ArrowRight size={15} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
