import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Image as ImageIcon, Star, X } from "lucide-react";
import { ResilientImage } from "@/components/media/ResilientImage";
import { adminSupabase as supabase } from "@/services/supabase/client";
import { privateAvatarUrls } from "@/lib/shared/avatar-url";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { useAdminTableInvalidation } from "@/services/admin/use-table-invalidation";
import { formatDateTime, plural } from "@/lib/admin/format";
import { useAdminSession, Toast } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { usePresence } from "@/components/storefront/motion";
import { Avatar, BusyBar, Card, EmptyState, PageHeader, Pagination, Pill, Segmented, Skeleton, useNotice } from "@/components/admin/ui";

type ReviewRow = {
  id: string;
  rating: number;
  title: string;
  body: string;
  approved: boolean;
  image_urls: string[];
  image_paths: string[];
  created_at: string;
  profiles: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  products: { name: string } | null;
};
type ReviewFilter = "all" | "visible" | "hidden" | "photos";

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex gap-0.5 text-[#b0835a]" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => <Star key={index} size={size} fill={index < Math.round(rating) ? "currentColor" : "none"} strokeWidth={1.8} />)}
    </span>
  );
}

const storagePath = (value: string) => {
  const marker = "/storage/v1/object/public/review-images/";
  try {
    return decodeURIComponent(value.includes(marker) ? value.split(marker)[1].split("?")[0] : value);
  } catch {
    return "";
  }
};

export function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const { notice, notify, clear } = useNotice();
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [gallery, setGallery] = useState<{ reviewId: string; index: number } | null>(null);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<string | null>(null);
  const { userId, workspaceReady } = useAdminSession();
  const result = useAdminQuery<{ rows: ReviewRow[]; total: number; allCount: number; visible: number; hidden: number; photos: number; average: number }>(
    "admin_review_page",
    { p_filter: filter, p_page: page },
    workspaceReady,
    userId,
    { keepPrevious: true },
  );
  useAdminTableInvalidation(["reviews"], result.reload, workspaceReady);
  useEffect(() => {
    setPage(1);
    setGallery(null);
  }, [filter]);
  useEffect(() => {
    if (result.data && !result.refreshing) setPage((current) => Math.min(current, Math.max(1, Math.ceil(result.data!.total / 10))));
  }, [result.data, result.refreshing]);
  useEffect(() => {
    let live = true;
    if (!result.data) return;
    const normalized = (result.data.rows ?? []).map((row) => ({
      ...row,
      image_urls: Array.isArray(row.image_paths) ? row.image_paths.filter(Boolean) : [],
      profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
      products: Array.isArray(row.products) ? row.products[0] ?? null : row.products,
    })) as ReviewRow[];
    void (async () => {
      const signedAvatars = await privateAvatarUrls(normalized.map((review) => review.profiles?.avatar_url), supabase);
      const photoPaths = normalized.flatMap((review) => review.image_urls.map(storagePath)).filter(Boolean);
      const photos = photoPaths.length ? await supabase.storage.from("review-images").createSignedUrls(photoPaths, 300) : { data: [] };
      const photoMap = new Map((photos.data ?? []).map((photo) => [photo.path, photo.signedUrl]));
      if (live)
        setReviews(
          normalized.map((review, index) => ({
            ...review,
            image_urls: review.image_urls.map((value) => photoMap.get(storagePath(value)) ?? "").filter(Boolean),
            profiles: review.profiles ? { ...review.profiles, avatar_url: signedAvatars[index] } : null,
          })),
        );
    })().catch(() => {
      if (live) notify("Review images could not be refreshed. Try again.", "error");
    });
    return () => {
      live = false;
    };
  }, [result.data, notify]);

  const setReviewVisibility = async (id: string, visible: boolean, allowUndo = true) => {
    setPending(id);
    const { error } = await supabase.from("reviews").update({ approved: visible }).eq("id", id);
    setPending(null);
    if (error) {
      notify(error.message, "error");
      return;
    }
    setReviews((current) => current.map((review) => (review.id === id ? { ...review, approved: visible } : review)));
    notify(visible ? "Review restored to the storefront." : "Review hidden from the storefront.", "success", allowUndo ? { label: "Undo", onClick: () => void setReviewVisibility(id, !visible, false) } : undefined);
    result.reload();
  };
  const average = Number(result.data?.average ?? 0);
  const galleryReview = gallery ? reviews.find((review) => review.id === gallery.reviewId) ?? null : null;
  const viewer = usePresence(Boolean(gallery && galleryReview?.image_urls[gallery.index]), 200);
  useEffect(() => {
    if (!gallery) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGallery(null);
      const count = galleryReview?.image_urls.length ?? 0;
      if (!count) return;
      if (event.key === "ArrowLeft") setGallery((current) => current && { ...current, index: (current.index - 1 + count) % count });
      if (event.key === "ArrowRight") setGallery((current) => current && { ...current, index: (current.index + 1) % count });
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [gallery, galleryReview]);

  return (
    <AdminShell title="Reviews">
      <PageHeader
        eyebrow="Customer voice"
        title="Reviews"
        description="Reviews publish immediately. Monitor feedback here and hide content only when it breaks CozyCraft content standards."
        actions={
          result.data && (
            <div className="adm-card flex items-center gap-3 px-4 py-2.5">
              <span className="adm-num font-serif text-[1.9rem] leading-none">{average.toFixed(1)}</span>
              <span>
                <Stars rating={average} size={13} />
                <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{plural(result.data.allCount, "review")}</span>
              </span>
            </div>
          )
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
          <Segmented
            label="Filter reviews"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "all", label: "All", count: result.data?.allCount },
              { value: "visible", label: "Visible", count: result.data?.visible },
              { value: "hidden", label: "Hidden", count: result.data?.hidden },
              { value: "photos", label: "With photos", count: result.data?.photos },
            ]}
          />
        </div>
        <BusyBar active={result.refreshing} />
        {result.error && !reviews.length && <EmptyState title="Reviews could not be loaded." description={result.error} action={<button onClick={result.reload} className="adm-btn adm-btn-primary">Try again</button>} />}
        {!result.data && !result.error ? (
          <div className="grid gap-3 border-t border-border p-4">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-32 w-full" />)}</div>
        ) : (
          <ul className={`divide-y divide-border border-t border-border transition-opacity ${result.refreshing ? "opacity-60" : ""}`}>
            {reviews.map((review) => {
              const author = review.profiles?.full_name || review.profiles?.email || "Customer";
              return (
                <li key={review.id} className={`adm-swap p-4 sm:p-5 ${review.approved ? "" : "bg-subtle/70"}`}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={author} src={review.profiles?.avatar_url} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="truncate text-sm">{author}</b>
                            <Stars rating={review.rating} />
                            {review.approved ? <Pill tone="success" dot>Visible</Pill> : <Pill tone="neutral" dot>Hidden</Pill>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground"><b className="font-semibold text-foreground">{review.products?.name || "Product"}</b> · {formatDateTime(review.created_at)}</p>
                        </div>
                      </div>
                      <h3 className="mt-3 font-serif text-[1.35rem] leading-snug">{review.title || "Customer feedback"}</h3>
                      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">“{review.body || "No written feedback provided."}”</p>
                      {review.image_urls.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {review.image_urls.map((url, index) => (
                            <button key={`${review.id}-${index}`} onClick={() => setGallery({ reviewId: review.id, index })} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-secondary sm:h-24 sm:w-24" aria-label={`Open review photo ${index + 1}`}>
                              <ResilientImage src={url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                              <span className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><Eye size={16} /></span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => void setReviewVisibility(review.id, !review.approved)} disabled={pending === review.id} className={`adm-btn shrink-0 ${review.approved ? "" : "adm-btn-primary"}`}>
                      {review.approved ? <EyeOff size={14} /> : <Eye size={14} />}
                      {pending === review.id ? "Saving…" : review.approved ? "Hide review" : "Restore review"}
                    </button>
                  </div>
                </li>
              );
            })}
            {result.data && !reviews.length && !result.error && (
              <li>
                <EmptyState icon={filter === "photos" ? ImageIcon : Star} title={filter === "all" ? "No customer reviews yet." : "No reviews match this view."} description={filter === "all" ? "New reviews and photos will appear here automatically." : "Try another filter."} />
              </li>
            )}
          </ul>
        )}
        {result.data && <Pagination page={page} total={result.data.total} size={10} onChange={setPage} busy={result.refreshing} label="Review pages" />}
      </Card>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
      {viewer.mounted && galleryReview && gallery && createPortal(
        <div data-state={viewer.state} className="cc-backdrop fixed inset-0 z-[300] grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Customer review photo viewer" onMouseDown={(event) => { if (event.target === event.currentTarget) setGallery(null); }}>
          <section data-state={viewer.state} className="cc-dialog relative flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] bg-[#171614] text-white shadow-2xl sm:rounded-[2rem]">
            <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{galleryReview.products?.name || "Product review"}</p>
                <p className="mt-0.5 text-[10.5px] text-white/60">Photo {gallery.index + 1} of {galleryReview.image_urls.length} · {galleryReview.profiles?.full_name || "Customer"}</p>
              </div>
              <button onClick={() => setGallery(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close photo viewer"><X size={18} /></button>
            </header>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:p-5">
              <ResilientImage key={gallery.index} src={galleryReview.image_urls[gallery.index]} alt={`${galleryReview.products?.name || "Product"} review photo ${gallery.index + 1}`} className="adm-swap max-h-[70dvh] w-auto max-w-full object-contain" />
              {galleryReview.image_urls.length > 1 && (
                <>
                  <button onClick={() => setGallery((current) => current && { ...current, index: (current.index - 1 + galleryReview.image_urls.length) % galleryReview.image_urls.length })} className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-black/60 hover:bg-black/80" aria-label="Previous photo"><ChevronLeft /></button>
                  <button onClick={() => setGallery((current) => current && { ...current, index: (current.index + 1) % galleryReview.image_urls.length })} className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-black/60 hover:bg-black/80" aria-label="Next photo"><ChevronRight /></button>
                </>
              )}
            </div>
            <footer className="flex flex-col justify-between gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <p className="line-clamp-2 text-xs leading-5 text-white/70">{galleryReview.body}</p>
              <button onClick={() => { void setReviewVisibility(galleryReview.id, !galleryReview.approved); setGallery(null); }} className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black">{galleryReview.approved ? "Hide review" : "Restore review"}</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </AdminShell>
  );
}
