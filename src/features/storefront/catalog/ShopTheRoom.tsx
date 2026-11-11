import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ShoppingBag } from "lucide-react";
import { money, useStore, type Product } from "@/app/core";
import { ResilientImage } from "@/components/media/ResilientImage";
import { catalogValuesMatch, matchesCatalogSubcategory } from "@/lib/catalog/discovery";
import { primaryProductImage } from "@/lib/catalog/product-images";
import { navigationRooms, roomCollections, subcategoryProductMap } from "@/lib/catalog/room-collections";
import { sortProducts } from "@/lib/catalog/sort-products";

type RoomKey = (typeof navigationRooms)[number]["key"];
type RoomSet = { key: RoomKey; label: string; path: string; image: string; pieces: Array<{ part: string; product: Product }>; total: number };

/**
 * One in-stock customer favourite from each part of a room (a sofa, a coffee
 * table and a TV stand for the living room, and so on), offered as a ready
 * set. Prices are the pieces' own prices added together: no bundle discount
 * is implied. Adding the set uses the normal bag, so sign-in rules and stock
 * limits apply exactly as they do everywhere else.
 */
function buildRoomSets(products: Product[]): RoomSet[] {
  return navigationRooms.flatMap((room) => {
    const info = roomCollections[room.key];
    const inRoom = products.filter((product) => catalogValuesMatch(product.category, info.match) && (product.stockQuantity ?? 1) > 0);
    const pieces = Object.entries(info.groups as Record<string, readonly string[]>).flatMap(([part, types]) => {
      const candidates = inRoom.filter((product) => types.some((type) => matchesCatalogSubcategory(product, type, subcategoryProductMap[type] ?? [])));
      const pick = sortProducts(candidates, "popular")[0];
      return pick ? [{ part, product: pick }] : [];
    });
    if (pieces.length < 2) return [];
    return [{ key: room.key, label: room.label, path: room.path, image: info.image, pieces, total: pieces.reduce((sum, piece) => sum + piece.product.price, 0) }];
  });
}

export function ShopTheRoom() {
  const { products, add, cart } = useStore();
  const sets = useMemo(() => buildRoomSets(products), [products]);
  const [selected, setSelected] = useState<RoomKey>("living-room");
  const set = sets.find((item) => item.key === selected) ?? sets[0];
  if (!set) return null;
  const inBag = new Set(cart.map((line) => line.id));
  const allInBag = set.pieces.every((piece) => inBag.has(piece.product.id));
  const addSet = () => { for (const piece of set.pieces) if (!inBag.has(piece.product.id)) add(piece.product.id); };

  return (
    <section aria-labelledby="shop-the-room-title" className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-28">
      <div data-reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">SHOP THE ROOM</p>
          <h2 id="shop-the-room-title" className="mt-4 font-serif text-4xl tracking-[-.02em] sm:text-5xl lg:text-6xl">One room, already put together.</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            A customer favourite from each part of the room, chosen to sit well together. Take the whole set, or only the pieces you need.
          </p>
        </div>
        {sets.length > 1 && (
          <div role="group" aria-label="Choose a room" className="cc-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            {sets.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={item.key === set.key}
                onClick={() => setSelected(item.key)}
                className={`cc-press h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition-colors ${item.key === set.key ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div data-reveal="scale" className="mt-10 grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-soft)] lg:grid-cols-[1.05fr_.95fr]">
        <Link to={set.path} className="group relative block min-h-[280px] overflow-hidden bg-secondary sm:min-h-[380px] lg:min-h-[560px]" aria-label={`Browse all ${set.label.toLowerCase()} furniture`}>
          <ResilientImage
            key={set.key}
            src={set.image}
            alt=""
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover transition duration-[1600ms] group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <span className="absolute inset-x-6 bottom-6 text-white sm:inset-x-8 sm:bottom-8">
            <span className="block text-[11px] font-bold tracking-[.2em] text-white/80">THE {set.label.toUpperCase()} SET</span>
            <span className="mt-2 block font-serif text-3xl sm:text-4xl">{set.pieces.length} pieces · {money(set.total)}</span>
          </span>
        </Link>

        <div className="flex flex-col p-5 sm:p-8 lg:p-10">
          <ul className="grid gap-3">
            {set.pieces.map(({ part, product }) => (
              <li key={product.id}>
                <Link to={`/products/${product.id}`} className="group flex items-center gap-4 rounded-2xl border border-border bg-background/60 p-3 transition hover:border-foreground/40 hover:bg-background">
                  <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    <ResilientImage src={primaryProductImage(product)} alt="" sizes="80px" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{part}</span>
                    <span className="mt-1 block truncate text-base font-semibold">{product.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{product.subcategory}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">{money(product.price)}</span>
                    {inBag.has(product.id) && <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4a6443]"><Check size={12} aria-hidden="true" /> In bag</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-7">
            <div className="flex items-end justify-between gap-4 border-t border-border pt-5">
              <div>
                <p className="text-xs text-muted-foreground">Set total · {set.pieces.length} pieces</p>
                <p className="mt-1 font-serif text-3xl tabular-nums">{money(set.total)}</p>
              </div>
              <p className="max-w-[11rem] text-right text-[11px] leading-4 text-muted-foreground">Each piece at its regular price. Delivery is calculated at checkout.</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addSet}
                disabled={allInBag}
                className="cc-press inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-colors hover:bg-[#35322e] disabled:cursor-default disabled:bg-secondary disabled:text-muted-foreground"
              >
                {allInBag ? <><Check size={16} aria-hidden="true" /> Set is in your bag</> : <><ShoppingBag size={16} aria-hidden="true" /> Add the set to bag</>}
              </button>
              <Link to={set.path} className="cc-press inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-6 text-sm font-semibold hover:bg-secondary">
                See all {set.label.toLowerCase()} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
