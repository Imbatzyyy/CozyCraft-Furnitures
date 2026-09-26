import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import type { Product, Store } from "@/app/core";
import { ResilientImage } from "@/components/media/ResilientImage";
import { primaryProductImage } from "@/lib/catalog/product-images";
import { usePresence, useCountUp } from "./motion";

type MiniCartProps = {
  store: Store;
  money: (value: number) => string;
};

/** Slide-over bag confirmation that opens whenever a piece is added. */
export function MiniCart({ store, money }: MiniCartProps) {
  const { cart, products, qty, remove, miniCartOpen = false, miniCartHighlight, closeMiniCart } = store;
  const location = useLocation();
  const presence = usePresence(miniCartOpen, 280);

  useEffect(() => {
    closeMiniCart?.();
    // Navigating anywhere (including the drawer's own links) closes it.
  }, [location.key]);

  useEffect(() => {
    if (!miniCartOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [miniCartOpen]);

  const lines = useMemo(
    () =>
      cart.flatMap((line) => {
        const product = products.find((item) => item.id === line.id);
        return product ? [{ product, quantity: line.quantity, selected: line.selectedForCheckout }] : [];
      }),
    [cart, products],
  );
  const ordered = useMemo(() => {
    const highlight = lines.find((line) => line.product.id === miniCartHighlight);
    return highlight ? [highlight, ...lines.filter((line) => line !== highlight)] : lines;
  }, [lines, miniCartHighlight]);
  const selected = lines.filter((line) => line.selected);
  const subtotal = selected.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const animatedSubtotal = useCountUp(subtotal);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const pairings = useMemo(() => {
    const inBag = new Set(lines.map((line) => line.product.id));
    const rooms = new Set(lines.map((line) => line.product.category));
    return products
      .filter((product) => !inBag.has(product.id) && rooms.has(product.category) && product.stockQuantity !== 0)
      .sort((a, b) => b.reviews - a.reviews || Number(b.rating) - Number(a.rating))
      .slice(0, 2);
  }, [lines, products]);
  const justAdded = Boolean(miniCartHighlight && lines.some((line) => line.product.id === miniCartHighlight));

  if (!presence.mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close bag preview"
        data-state={presence.state}
        onClick={closeMiniCart}
        className="cc-backdrop absolute inset-0 bg-[#171614]/45 backdrop-blur-[3px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="mini-cart-title"
        data-state={presence.state}
        className="cc-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-[#fbfaf7] text-foreground shadow-[var(--shadow-overlay)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-[1.75rem]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden="true" />
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-3 md:px-7 md:pt-7">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">
              {justAdded ? (
                <>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  Added to your bag
                </>
              ) : (
                "Your bag"
              )}
            </p>
            <h2 id="mini-cart-title" className="mt-2 font-serif text-3xl leading-tight">
              {count ? `${count} ${count === 1 ? "piece" : "pieces"} waiting.` : "Your bag is empty."}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeMiniCart}
            aria-label="Close bag preview"
            data-dialog-close
            className="cc-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-white hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-7">
          {ordered.length ? (
            <ul className="cc-stagger grid gap-3">
              {ordered.map(({ product, quantity, selected: isSelected }) => {
                const highlighted = product.id === miniCartHighlight;
                const atLimit = typeof product.stockQuantity === "number" && quantity >= product.stockQuantity;
                return (
                  <li
                    key={product.id}
                    className={`flex gap-3.5 rounded-2xl border p-3 transition-colors ${highlighted ? "border-[#cdbfa9] bg-white shadow-[var(--shadow-soft)]" : "border-transparent bg-transparent"}`}
                  >
                    <Link to={`/products/${product.id}`} className="cc-media h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      <ResilientImage src={primaryProductImage(product)} alt="" className="h-full w-full object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/products/${product.id}`} className="line-clamp-2 text-sm font-semibold leading-5 hover:underline">
                            {product.name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.subcategory || product.category}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">{money(product.price * quantity)}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex h-9 items-center rounded-full border border-border bg-white">
                          <button
                            type="button"
                            onClick={() => (quantity <= 1 ? remove(product.id) : qty(product.id, quantity - 1))}
                            aria-label={quantity <= 1 ? `Remove ${product.name}` : `Decrease ${product.name} quantity`}
                            className="grid h-full w-9 place-items-center rounded-full hover:bg-secondary"
                          >
                            {quantity <= 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                          </button>
                          <span className="w-6 text-center text-xs font-semibold tabular-nums" aria-live="polite">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => qty(product.id, quantity + 1)}
                            disabled={atLimit}
                            aria-label={atLimit ? `Maximum available stock reached for ${product.name}` : `Increase ${product.name} quantity`}
                            className="grid h-full w-9 place-items-center rounded-full hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        {!isSelected && <span className="text-[11px] text-muted-foreground">Not in checkout</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid place-items-center py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary"><ShoppingBag size={20} /></span>
              <p className="mt-4 text-sm text-muted-foreground">Pieces you add will gather here.</p>
            </div>
          )}

          {pairings.length > 0 && (
            <section className="mt-6 border-t border-border pt-5" aria-labelledby="mini-cart-pairings">
              <p id="mini-cart-pairings" className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">Pairs well with</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {pairings.map((product: Product) => (
                  <Link key={product.id} to={`/products/${product.id}`} className="group block">
                    <span className="cc-media block aspect-[4/5] overflow-hidden rounded-xl bg-secondary">
                      <ResilientImage src={primaryProductImage(product)} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                    </span>
                    <span className="mt-2 block truncate text-xs font-semibold">{product.name}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{money(product.price)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="border-t border-border bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-7 md:pb-7">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Selected subtotal</span>
            <span className="text-xl font-semibold tabular-nums">{money(Math.round(animatedSubtotal))}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Delivery is calculated from your saved address at checkout.</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Link to="/cart" className="cc-press grid h-12 place-items-center rounded-xl border border-border text-sm font-semibold hover:bg-secondary">
              View bag
            </Link>
            {selected.length ? (
              <Link
                to={`/checkout?items=${selected.map((line) => line.product.id).join(",")}`}
                className="cc-press flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background hover:bg-[#35322e]"
              >
                Checkout <ArrowRight size={15} />
              </Link>
            ) : (
              <button type="button" onClick={closeMiniCart} className="cc-press h-12 rounded-xl bg-foreground text-sm font-semibold text-background">
                Keep browsing
              </button>
            )}
          </div>
          {selected.length > 0 && (
            <button type="button" onClick={closeMiniCart} className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline">
              Continue shopping
            </button>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
