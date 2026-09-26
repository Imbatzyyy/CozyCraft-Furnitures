import { useEffect, useRef, useState } from "react";
import { ResilientImage } from "@/components/media/ResilientImage";

const CARD_IMAGE_SIZES = "(max-width: 640px) calc(50vw - 1.5rem), (max-width: 1024px) calc(50vw - 2rem), 25vw";

type ProductCardPreviewProps = {
  images: string[];
  name: string;
  mainIndex: number;
  hovered: boolean;
};

/** Keep the cover mounted while the on-demand alternate loads and decodes. */
export function ProductCardPreview(props: ProductCardPreviewProps) {
  // A catalog update must not reuse the readiness state of a different photo.
  return <PreviewImages key={JSON.stringify([props.mainIndex, props.images])} {...props} />;
}

function PreviewImages({ images, name, mainIndex, hovered }: ProductCardPreviewProps) {
  const coverIndex = images[mainIndex] ? mainIndex : 0;
  const alternateIndex = images.length > 1
    ? Array.from({ length: images.length - 1 }, (_, offset) => (coverIndex + offset + 1) % images.length)
      .find((index) => images[index] && images[index] !== images[coverIndex])
    : undefined;
  const [requested, setRequested] = useState(false);
  const [previewAllowed, setPreviewAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const loadGeneration = useRef(0);

  useEffect(() => () => { loadGeneration.current += 1; }, []);

  useEffect(() => {
    setPreviewAllowed(false);
    if (!hovered || alternateIndex === undefined) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Download only one alternate, and only after deliberate hover intent.
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      setRequested(true);
      setPreviewAllowed(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hovered, alternateIndex]);

  const showingAlternate = hovered && previewAllowed && ready;
  const visibleIndex = showingAlternate ? alternateIndex : coverIndex;

  return <>
    <ResilientImage
      src={images[coverIndex]}
      alt={`${name}, view ${coverIndex + 1}`}
      aria-hidden={showingAlternate || undefined}
      sizes={CARD_IMAGE_SIZES}
      className="h-full w-full object-cover"
    />
    {requested && alternateIndex !== undefined && <ResilientImage
      src={images[alternateIndex]}
      alt={showingAlternate ? `${name}, view ${alternateIndex + 1}` : ""}
      aria-hidden={!showingAlternate || undefined}
      loading="eager"
      sizes={CARD_IMAGE_SIZES}
      className={`pointer-events-none absolute inset-0 h-full w-full object-cover motion-safe:transition-opacity motion-safe:duration-200 ${showingAlternate ? "opacity-100" : "opacity-0"}`}
      onLoad={async (event) => {
        const image = event.currentTarget;
        const generation = ++loadGeneration.current;
        // onLoad alone may precede the browser's first decoded paint.
        try { await image.decode?.(); } catch { /* Older browsers can reject decode for an already loaded image. */ }
        if (generation === loadGeneration.current && image.complete && image.naturalWidth > 0) setReady(true);
      }}
      onError={() => {
        loadGeneration.current += 1;
        setReady(false);
      }}
    />}
    {images.length > 1 && <div aria-hidden="true" className="absolute bottom-3.5 left-3.5 flex gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,.35)]">
      {images.map((_, index) => <span
        key={index}
        className={`h-1.5 rounded-full transition-all ${index === visibleIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
      />)}
    </div>}
  </>;
}
