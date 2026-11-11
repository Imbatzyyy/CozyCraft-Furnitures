import React, { useCallback, useEffect, useState } from "react";
import { editorialImageSources, productImageSources } from "@/lib/catalog/responsive-image";

const ERROR_IMAGE_SOURCE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==";

export function ResilientImage(
  props: React.ImgHTMLAttributes<HTMLImageElement> & { optimize?: boolean },
) {
  const [didError, setDidError] = useState(false);
  const [originalFallback, setOriginalFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDidError(false);
    setOriginalFallback(false);
    setLoaded(false);
  }, [props.src]);

  // Cached images can finish before React attaches onLoad; mark them at once
  // so the storefront fade-in never hides an image that is already decoded.
  const markIfComplete = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  const {
    src,
    alt,
    style,
    className,
    loading = "lazy",
    decoding = "async",
    srcSet,
    sizes,
    onError,
    onLoad,
    optimize = true,
    ...rest
  } = props;
  const productSources = productImageSources(src, optimize && import.meta.env.PROD && !originalFallback && !srcSet &&
    typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname));
  // Editorial photography: smaller renditions of the same picture for small
  // screens. Without an explicit `sizes` the browser assumes full width, so
  // this can only ever reduce what is downloaded, never soften an image.
  const editorialSources = productSources || !optimize || originalFallback || srcSet ? null : editorialImageSources(src);
  const responsive = productSources ?? editorialSources;

  if (didError) {
    return (
      <div
        className={`inline-block bg-gray-100 text-center align-middle ${className ?? ""}`}
        style={style}
      >
        <div className="flex h-full w-full items-center justify-center">
          <img
            src={ERROR_IMAGE_SOURCE}
            alt={alt ?? ""}
            loading={loading}
            decoding={decoding}
            {...rest}
            data-loaded=""
          />
        </div>
      </div>
    );
  }

  return (
    // Attribute order matters. React 18 sets attributes in this order, and
    // Safari and Firefox start fetching the moment `src` is set: with `src`
    // first they download the full-size file AND the chosen smaller one, and
    // ignore `loading="lazy"`. So everything that decides WHAT and WHEN to
    // load comes before `src`.
    <img
      loading={loading}
      decoding={decoding}
      sizes={sizes ?? (productSources ? "(max-width: 768px) 100vw, 60vw" : editorialSources ? "100vw" : undefined)}
      srcSet={responsive?.srcSet ?? (originalFallback ? undefined : srcSet)}
      {...rest}
      alt={alt}
      className={`cc-img ${className ?? ""}`}
      style={style}
      src={responsive?.src ?? src}
      ref={markIfComplete}
      data-loaded={loaded ? "" : undefined}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        if (responsive) setOriginalFallback(true);
        else { setDidError(true); onError?.(event); }
      }}
    />
  );
}
