import React, { useCallback, useEffect, useState } from "react";
import { productImageSources } from "@/lib/catalog/responsive-image";

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
  const responsive = productImageSources(src, optimize && import.meta.env.PROD && !originalFallback && !srcSet &&
    typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname));

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
    <img
      src={responsive?.src ?? src}
      srcSet={responsive?.srcSet ?? (originalFallback ? undefined : srcSet)}
      sizes={sizes ?? (responsive ? "(max-width: 768px) 100vw, 60vw" : undefined)}
      alt={alt}
      className={`cc-img ${className ?? ""}`}
      style={style}
      loading={loading}
      decoding={decoding}
      {...rest}
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
