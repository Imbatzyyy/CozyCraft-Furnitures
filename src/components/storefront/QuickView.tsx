import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Heart, Minus, Plus, ShoppingBag, X } from "lucide-react";
import type { Product } from "@/app/core";
import { ResilientImage } from "@/components/media/ResilientImage";
import { productMainImageIndex } from "@/lib/catalog/product-images";
import { friendlyAvailability } from "@/lib/catalog/stock-availability";
import { usePresence } from "./motion";
import { StarRating } from "./StarRating";

type QuickViewProps = {
  product: Product;
  open: boolean;
  onClose: () => void;
  saved: boolean;
  onToggleSaved: () => void;
  onAdd: (quantity: number) => void;
  money: (value: number) => string;
};

/** A focused preview of a product without leaving the collection. */
export function QuickView({ product, open, onClose, saved, onToggleSaved, onAdd, money }: QuickViewProps) {
  const presence = usePresence(open, 260);
  const images = product.images.filter(Boolean);
  const [index, setIndex] = useState(() => productMainImageIndex(product));
  const [quantity, setQuantity] = useState(1);
  const stockLimit = typeof product.stockQuantity === "number" ? Math.max(0, product.stockQuantity) : null;
  const soldOut = stockLimit === 0;
  const lowStock = stockLimit !== null && stockLimit > 0 && (stockLimit <= 8 || product.stock === "Low stock");

  useEffect(() => {
    if (!open) return;
    setIndex(productMainImageIndex(product));
    setQuantity(1);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keys = (event: KeyboardEvent) => {
      if (images.length < 2) return;
      if (event.key === "ArrowRight") setIndex((current) => (current + 1) % images.length);
      if (event.key === "ArrowLeft") setIndex((current) => (current - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", keys);
    };
    // Reset only when the dialog opens for this product.
  }, [open, product.id]);

  if (!presence.mounted) return null;
  const move = (step: number) => setIndex((current) => (current + step + images.length) % images.length);

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close quick view"
        data-state={presence.state}
        onClick={onClose}
        className="cc-backdrop absolute inset-0 bg-[#171614]/55 backdrop-blur-[3px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`quick-view-${product.id}`}
        data-state={presence.state}
        className="cc-quickview relative grid max-h-[92dvh] w-full overflow-hidden rounded-t-[1.75rem] bg-[#fbfaf7] shadow-[var(--shadow-overlay)] md:max-h-[min(88dvh,760px)] md:max-w-5xl md:grid-cols-[1.05fr_.95fr] md:rounded-[1.75rem]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          data-dialog-close
          className="cc-press absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/95 shadow-md hover:bg-white"
        >
          <X size={18} />
        </button>
        <div className="relative bg-secondary">
          <div className="cc-media relative aspect-[5/4] md:aspect-auto md:h-full md:min-h-[520px]">
            {images.length > 0 && (
              <ResilientImage
                key={images[index]}
                src={images[index]}
                alt={`${product.name}, view ${index + 1} of ${images.length}`}
                loading="eager"
                sizes="(max-width: 768px) 100vw, 50vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="cc-press absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow hover:bg-white"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => move(1)} aria-label="Next image" className="cc-press absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow hover:bg-white"><ChevronRight size={18} /></button>
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5" aria-hidden="true">
                {images.map((image, dot) => (
                  <span key={`${image}-${dot}`} className={`h-1.5 rounded-full bg-white shadow transition-all duration-500 ${dot === index ? "w-6" : "w-1.5 opacity-60"}`} />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex min-h-0 flex-col overflow-y-auto p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            {product.category} · {product.subcategory || "Collection piece"}
          </p>
          <h2 id={`quick-view-${product.id}`} className="mt-3 pr-10 font-serif text-3xl leading-[1.05] sm:text-4xl">{product.name}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-2xl font-semibold tabular-nums">{money(product.price)}</p>
            {product.reviews > 0 ? <StarRating value={Number(product.rating)} count={product.reviews} showValue /> : <span className="text-xs text-muted-foreground">No reviews yet</span>}
          </div>
          <p className={`mt-4 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${soldOut ? "bg-[var(--tone-danger-bg)] text-[var(--tone-danger-fg)]" : lowStock ? "bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)]" : "bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {friendlyAvailability(product.stockQuantity, product.stock)}
          </p>
          <p className="mt-5 line-clamp-5 text-sm leading-7 text-muted-foreground">{product.description}</p>
          {product.color && <p className="mt-4 text-sm"><span className="text-muted-foreground">Finish · </span>{product.color}</p>}
          <div className="mt-auto pt-7">
            <div className="flex gap-2.5">
              <div className="flex h-12 items-center rounded-xl border border-border bg-white">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || soldOut} aria-label={`Decrease ${product.name} quantity`} className="grid h-full w-11 place-items-center disabled:opacity-30"><Minus size={15} /></button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                <button type="button" onClick={() => setQuantity((value) => stockLimit === null ? value + 1 : Math.min(stockLimit, value + 1))} disabled={soldOut || (stockLimit !== null && quantity >= stockLimit)} aria-label={`Increase ${product.name} quantity`} className="grid h-full w-11 place-items-center disabled:opacity-30"><Plus size={15} /></button>
              </div>
              <button
                type="button"
                disabled={soldOut}
                onClick={() => { onClose(); onAdd(quantity); }}
                className="cc-press flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background hover:bg-[#35322e] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ShoppingBag size={16} /> {soldOut ? "Sold out" : "Add to bag"}
              </button>
              <button
                type="button"
                onClick={onToggleSaved}
                aria-pressed={saved}
                aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                className="cc-press grid h-12 w-12 place-items-center rounded-xl border border-border bg-white hover:bg-secondary"
              >
                <Heart size={18} fill={saved ? "currentColor" : "none"} className={saved ? "cc-pop text-[#9a4f46]" : ""} />
              </button>
            </div>
            <Link to={`/products/${product.id}`} onClick={onClose} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
              View full details <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
