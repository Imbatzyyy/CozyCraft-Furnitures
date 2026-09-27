import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Grid2X2,
  ImagePlus,
  List,
  Minus,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  Warehouse,
  X,
} from "lucide-react";
import { productQualityGaps } from "@/lib/catalog/product-quality";
import { ResilientImage } from "@/components/media/ResilientImage";
import { primaryProductImage } from "@/lib/catalog/product-images";
import { adminSupabase as supabase } from "@/services/supabase/client";
import { parseDimensionSpecs, parseMaterialSpecs, serializeDimensionSpecs, serializeMaterialSpecs, type DimensionSpec, type MaterialSpec } from "@/lib/catalog/product-specs";
import { createProductId, productsShareCatalogIdentity } from "@/lib/catalog/product-identity";
import { clearAdminDraft, readAdminDraft, writeAdminDraft } from "@/lib/admin/admin-drafts";
import { formatDateTime, plural, relativeTime } from "@/lib/admin/format";
import { fallbackProducts, money, materialFor, subcategoryFor, useStore, Status, Toast, type ManagedProduct, type Product } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { confirmAction, promptAction } from "@/components/admin/confirm";
import {
  ActionMenu,
  Card,
  CardHeader,
  CopyButton,
  Dialog,
  EmptyState,
  LiveBadge,
  PageHeader,
  Pill,
  SearchField,
  Segmented,
  Sheet,
  StatStrip,
  useNotice,
} from "@/components/admin/ui";

import { catalogTaxonomy } from "../../../../supabase/functions/_shared/catalog-taxonomy";
export { catalogTaxonomy };

export const taxonomyGroups: Record<string, string[]> = {
  "Living room": ["Sofas", "Coffee Tables", "TV Stands"],
  Bedroom: ["Beds", "Wardrobes", "Nightstands"],
  "Dining room": ["Dining Tables", "Dining Chairs", "Dining Storage"],
};

export const initialManagedProducts: ManagedProduct[] = fallbackProducts.slice(0, 8).map((p, i) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  subcategory:
    p.category === "Living room"
      ? i === 0 ? "2-Seater Fabric Sofa" : i === 4 ? "Sectional Sofa" : i === 5 ? "Marble Coffee Table" : "Wooden TV Stand"
      : p.category === "Bedroom"
        ? i === 3 ? "Queen Size Bed" : i === 6 ? "2-Door Wardrobe" : "Modern Nightstand"
        : i === 2 ? "Luxury Velvet Dining Chairs" : "Extendable Dining Table",
  price: p.price,
  quantity: [4, 9, 18, 0, 11, 6, 5, 12][i] ?? 8,
  status: "Active",
  images: [...p.images],
  main: 0,
  material: materialFor(p.id),
  dimensions: p.dimensions,
}));

const productEditorDraftKey = "cozycraft:admin:product-editor:v1";
const categories = ["Living room", "Bedroom", "Dining room"];

const emptyManagedProduct = (category = "Living room", subcategory?: string): ManagedProduct => ({
  id: "",
  name: "",
  description: "",
  category,
  subcategory: subcategory && (catalogTaxonomy[category] ?? []).includes(subcategory) ? subcategory : catalogTaxonomy[category]?.[0] ?? catalogTaxonomy["Living room"][0],
  price: 0,
  quantity: 0,
  status: "Active",
  images: [],
  main: 0,
  material: "",
  dimensions: "",
});

const isManagedProductDraft = (value: unknown): value is ManagedProduct => {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ManagedProduct>;
  return (
    typeof draft.id === "string" &&
    typeof draft.name === "string" &&
    typeof draft.description === "string" &&
    typeof draft.category === "string" &&
    typeof draft.subcategory === "string" &&
    typeof draft.price === "number" &&
    typeof draft.quantity === "number" &&
    Array.isArray(draft.images)
  );
};

const toManaged = (p: Product): ManagedProduct => ({
  color: p.color,
  updatedAt: p.updatedAt,
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  subcategory: p.subcategory ?? subcategoryFor(p.id),
  price: p.price,
  quantity: p.stockQuantity ?? 0,
  status: p.status === "draft" ? "Draft" : p.status === "inactive" ? "Inactive" : "Active",
  images: [...p.images],
  main: p.mainImageIndex ?? 0,
  material: p.material ?? materialFor(p.id),
  dimensions: p.dimensions,
});

const storefrontPath = (category: string) => `/${category.toLowerCase().replace(/\s+/g, "-")}`;

type StockTone = "success" | "warning" | "danger";
const stockState = (quantity: number, threshold: number): { label: string; tone: StockTone } =>
  quantity <= 0 ? { label: "Sold out", tone: "danger" } : quantity <= threshold ? { label: "Low stock", tone: "warning" } : { label: "In stock", tone: "success" };

type SortKey = "name" | "price" | "quantity" | "updated";

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export function ProductManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { adminProducts, saveProduct, deleteProduct, uploadProductImages, storeSettings } = useStore();
  const threshold = storeSettings.low_stock_threshold ?? 8;
  const items = useMemo(() => adminProducts.map(toManaged), [adminProducts]);
  const [view, setView] = useState<"grid" | "list">("list");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState("All categories");
  const [statusFilter, setStatusFilter] = useState<"all" | ManagedProduct["status"]>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "name", direction: 1 });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editing, setEditing] = useState<ManagedProduct | null>(() => readAdminDraft(productEditorDraftKey, isManagedProductDraft) ?? (location.pathname.endsWith("/new") ? emptyManagedProduct(searchParams.get("category") ?? undefined, searchParams.get("subcategory") ?? undefined) : null));
  const [editorOrigin, setEditorOrigin] = useState<string>(() => JSON.stringify(editing));
  const { notice, notify, clear } = useNotice();
  const [photoIndex, setPhotoIndex] = useState<{ id: string; name: string; status: "loading" | "error" | "done" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<ManagedProduct | null>(null);

  const indexPhotos = async (id: string, name: string) => {
    setPhotoIndex({ id, name, status: "loading" });
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("furniture-discovery", { body: { action: "index", productId: id } });
      setPhotoIndex((current) => (current?.id === id ? { ...current, status: invokeError || data?.error ? "error" : "done" } : current));
    } catch {
      setPhotoIndex((current) => (current?.id === id ? { ...current, status: "error" } : current));
    }
  };
  useEffect(() => {
    if (editing) writeAdminDraft(productEditorDraftKey, editing);
  }, [editing]);
  // Deep links: /admin/products?edit=<id> and /admin/products/new.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || editing) return;
    const item = items.find((product) => product.id === editId);
    if (item) openEditor(item);
  }, [searchParams, items]);
  useEffect(() => {
    if (location.pathname.endsWith("/new") && !editing) openEditor();
  }, [location.pathname]);

  const openEditor = (item?: ManagedProduct) => {
    const next = item ? { ...item, images: [...item.images] } : emptyManagedProduct(searchParams.get("category") ?? undefined, searchParams.get("subcategory") ?? undefined);
    setEditing(next);
    setEditorOrigin(JSON.stringify(next));
    setError("");
  };
  const finishEditor = () => {
    clearAdminDraft(productEditorDraftKey);
    setEditing(null);
    setError("");
    if (location.pathname.endsWith("/new")) navigate("/admin/products", { replace: true });
    else if (searchParams.has("edit")) {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  };
  const requestCloseEditor = async () => {
    if (editing && JSON.stringify(editing) !== editorOrigin) {
      const discard = await confirmAction({ title: "Discard your changes?", description: "This product has edits that haven’t been saved.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" });
      if (!discard) return;
    }
    finishEditor();
  };
  const save = async () => {
    if (!editing || saving) return;
    if (!editing.name.trim() || editing.description.trim().length < 10 || editing.images.length !== 4) {
      setError("Add a product name, a description of at least 10 characters, and exactly four product photos before saving.");
      return;
    }
    if (!(catalogTaxonomy[editing.category] ?? []).includes(editing.subcategory)) {
      setError("Choose a valid room category and product subcategory.");
      return;
    }
    const duplicate = items.find((item) => item.id !== editing.id && productsShareCatalogIdentity(item, editing));
    if (duplicate) {
      setError("");
      setDuplicateWarning(duplicate);
      return;
    }
    const isCreating = !editing.id;
    const result = {
      ...editing,
      id: editing.id || createProductId(editing, crypto.randomUUID()),
      name: editing.name.trim(),
      description: editing.description.trim(),
      material: serializeMaterialSpecs(parseMaterialSpecs(editing.material)),
      dimensions: serializeDimensionSpecs(parseDimensionSpecs(editing.dimensions)),
    };
    setSaving(true);
    const saveError = await saveProduct(result, { create: isCreating });
    setSaving(false);
    if (saveError) {
      if (saveError.includes("already exists")) {
        setError("");
        setDuplicateWarning(result);
      } else setError(saveError);
      return;
    }
    finishEditor();
    notify(`${result.name} ${isCreating ? "created" : "updated"}.`);
    void indexPhotos(result.id, result.name);
  };
  const upload = async (files: FileList | File[] | null) => {
    if (!files || !editing) return;
    const availableSlots = Math.max(0, 4 - editing.images.length);
    if (availableSlots === 0) {
      setError("The four-photo limit has been reached. Remove a photo before adding another.");
      return;
    }
    const list = Array.from(files).filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
    if (!list.length) {
      setError("Use JPG, PNG, or WebP photos up to 10 MB.");
      return;
    }
    const selectedFiles = list.slice(0, availableSlots);
    setUploading(selectedFiles.length);
    const urls = await uploadProductImages(selectedFiles);
    setUploading(0);
    setEditing((current) => (current ? { ...current, images: [...current.images, ...urls].slice(0, 4) } : current));
    if (!urls.length) setError("No photos were uploaded. Use JPG, PNG, or WebP files up to 10 MB.");
    else if (list.length > availableSlots) setError(`Only ${plural(availableSlots, "more photo")} could be added. Products are limited to four photos.`);
    else setError("");
  };

  const counts = useMemo(
    () => ({
      active: items.filter((item) => item.status === "Active").length,
      draft: items.filter((item) => item.status === "Draft").length,
      inactive: items.filter((item) => item.status === "Inactive").length,
      low: items.filter((item) => item.status === "Active" && item.quantity <= threshold).length,
    }),
    [items, threshold],
  );
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items
      .filter((item) => (category === "All categories" || item.category === category) && (statusFilter === "all" || item.status === statusFilter))
      .filter((item) => (stockFilter === "all" ? true : stockFilter === "out" ? item.quantity <= 0 : item.quantity <= threshold))
      .filter((item) => !term || `${item.name} ${item.description} ${item.subcategory} ${item.id}`.toLowerCase().includes(term))
      .sort((a, b) => {
        const value = sort.key === "name" ? a.name.localeCompare(b.name) : sort.key === "price" ? a.price - b.price : sort.key === "quantity" ? a.quantity - b.quantity : String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? ""));
        return value * sort.direction;
      });
  }, [items, category, statusFilter, stockFilter, query, sort, threshold]);
  const qualityItems = useMemo(() => items.map((item) => ({ item, gaps: productQualityGaps(item) })).filter(({ gaps }) => gaps.length), [items]);
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.id));
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((item) => item.id)));
  useEffect(() => {
    setSelected((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))));
  }, [items]);

  const setStatus = async (targets: ManagedProduct[], status: ManagedProduct["status"]) => {
    const failures: string[] = [];
    for (const item of targets) {
      if (item.status === status) continue;
      const issue = await saveProduct({ ...item, status });
      if (issue) failures.push(`${item.name}: ${issue}`);
    }
    return failures;
  };
  const toggleOne = async (item: ManagedProduct) => {
    const next = item.status === "Inactive" || item.status === "Draft" ? "Active" : "Inactive";
    if (next === "Inactive") {
      const confirmed = await confirmAction({ title: `Hide ${item.name}?`, description: "It will disappear from the storefront immediately. You can activate it again at any time.", confirmLabel: "Deactivate" });
      if (!confirmed) return;
    }
    const failures = await setStatus([item], next);
    if (failures.length) notify(failures[0], "error");
    else notify(`${item.name} is now ${next === "Active" ? "live in the storefront" : "hidden from customers"}.`, "success", { label: "Undo", onClick: () => void setStatus([{ ...item, status: next }], item.status) });
  };
  const bulkStatus = async (status: ManagedProduct["status"]) => {
    const targets = items.filter((item) => selected.has(item.id) && item.status !== status);
    if (!targets.length) {
      notify(`Every selected product is already ${status.toLowerCase()}.`, "info");
      return;
    }
    const confirmed = await confirmAction({
      title: `${status === "Active" ? "Publish" : "Hide"} ${plural(targets.length, "product")}?`,
      description: status === "Active" ? "They will appear in the storefront right away." : "They will be hidden from customers right away.",
      confirmLabel: status === "Active" ? "Publish products" : "Hide products",
    });
    if (!confirmed) return;
    setBulkBusy(true);
    const failures = await setStatus(targets, status);
    setBulkBusy(false);
    setSelected(new Set());
    if (failures.length) notify(`${targets.length - failures.length} updated. ${failures[0]}`, "error");
    else notify(`${plural(targets.length, "product")} ${status === "Active" ? "published" : "hidden"}.`);
  };
  const removeProduct = async (item: ManagedProduct) => {
    const confirmed = await confirmAction({
      title: `Delete ${item.name}?`,
      description: "This permanently removes the product, its photos and catalog placement. Orders that already include it are not affected.",
      eyebrow: "Permanent action",
      confirmLabel: "Delete product",
      tone: "danger",
      requireText: "DELETE",
    });
    if (!confirmed) return;
    const issue = await deleteProduct(item.id);
    if (issue) notify(issue, "error");
    else notify(`${item.name} deleted.`);
  };
  const duplicate = (item: ManagedProduct) => openEditor({ ...item, id: "", name: `${item.name} (copy)`, quantity: 0, status: "Draft", updatedAt: undefined });
  const sortBy = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key ? (current.direction === 1 ? -1 : 1) : key === "name" ? 1 : -1 }));
  const sortHeader = (key: SortKey, label: string, align = "") => (
    <th className={align} aria-sort={sort.key === key ? (sort.direction === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => sortBy(key)} data-active={sort.key === key} className="adm-sort">
        {label}
        {sort.key === key ? sort.direction === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ArrowUpDown size={11} className="opacity-50" />}
      </button>
    </th>
  );
  const menuFor = (item: ManagedProduct) => [
    { label: "Edit product", icon: Pencil, onSelect: () => openEditor(item) },
    { label: "Duplicate as draft", icon: Copy, onSelect: () => duplicate(item) },
    { label: "View in store", icon: ExternalLink, onSelect: () => window.open(`/products/${encodeURIComponent(item.id)}`, "_blank", "noopener") },
    { label: item.status === "Active" ? "Deactivate" : "Activate", icon: item.status === "Active" ? EyeOff : Eye, onSelect: () => void toggleOne(item) },
    { label: "Delete…", icon: Trash2, onSelect: () => void removeProduct(item), tone: "danger" as const },
  ];

  return (
    <AdminShell title="Products">
      {photoIndex && (
        <div role="status" className="cc-enter-fade mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs leading-5 shadow-[var(--adm-shadow-card)]">
          <span className="flex items-center gap-2">
            {photoIndex.status === "loading" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : photoIndex.status === "done" ? <CheckCircle2 size={15} className="text-success-ink" /> : <AlertTriangle size={15} className="text-warning-ink" />}
            {photoIndex.status === "loading" ? `Updating photo matching for ${photoIndex.name}…` : photoIndex.status === "done" ? `Photo matching is up to date for ${photoIndex.name}.` : `${photoIndex.name} was saved, but photo matching could not be updated.`}
          </span>
          <span className="flex gap-1.5">
            {photoIndex.status === "error" && <button type="button" className="adm-btn adm-btn-sm" onClick={() => void indexPhotos(photoIndex.id, photoIndex.name)}>Retry</button>}
            {photoIndex.status !== "loading" && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setPhotoIndex(null)}>Dismiss</button>}
          </span>
        </div>
      )}
      <PageHeader
        eyebrow="Catalog management"
        title="Products"
        description="Create, maintain, and publish the pieces shown across CozyCraft."
        meta={<LiveBadge live liveLabel="Live catalog · changes sync automatically" />}
        actions={<button onClick={() => openEditor()} className="adm-btn adm-btn-primary"><PackagePlus size={15} /> Add product</button>}
      >
        <StatStrip
          items={[
            { label: "Published", value: counts.active, note: "Visible in the storefront", icon: Eye, tone: "success" },
            { label: "Drafts", value: counts.draft, note: "Ready to review", icon: Pencil },
            { label: "Hidden", value: counts.inactive, note: "Not shown to customers", icon: EyeOff },
            { label: "Low stock", value: counts.low, note: `At or below ${threshold} units`, icon: Warehouse, tone: counts.low ? "warning" : "neutral", to: "/admin/inventory?filter=low" },
          ]}
        />
      </PageHeader>

      {qualityItems.length > 0 && (
        <details className="adm-card group mb-5 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-warning-soft text-warning-ink"><Star size={15} /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-[13px]">Catalog quality · {plural(qualityItems.length, "product")} to review</b>
              <span className="block text-[11px] text-muted-foreground">Helpful checks only — nothing is changed automatically.</span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto border-t border-border">
            {qualityItems.map(({ item, gaps }) => (
              <li key={item.id}>
                <button type="button" onClick={() => openEditor(item)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <span className="text-[13px] font-semibold">{item.name}</span>
                  <span className="flex flex-wrap gap-1">{gaps.map((gap) => <Pill key={gap} tone="warning">{gap}</Pill>)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card className="overflow-hidden">
        <div className="grid gap-2.5 border-b border-border p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <SearchField value={query} onChange={setQuery} label="Search products" placeholder="Search name, description, subcategory, or ID" />
          <div className="flex flex-wrap items-center gap-2">
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Room category" className="adm-select h-11 w-auto text-xs font-semibold">
              <option>All categories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)} aria-label="Stock level" className="adm-select h-11 w-auto text-xs font-semibold">
              <option value="all">Any stock</option>
              <option value="low">Low stock</option>
              <option value="out">Sold out</option>
            </select>
            <div className="flex rounded-xl border border-border p-1" role="group" aria-label="Layout">
              <button onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="List view" className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}><List size={16} /></button>
              <button onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grid view" className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}><Grid2X2 size={16} /></button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
          <Segmented
            label="Publishing status"
            value={statusFilter}
            onChange={setStatusFilter}
            items={[
              { value: "all", label: "All", count: items.length },
              { value: "Active", label: "Published", count: counts.active },
              { value: "Draft", label: "Drafts", count: counts.draft },
              { value: "Inactive", label: "Hidden", count: counts.inactive },
            ]}
          />
          <span className="adm-num text-[11px] text-muted-foreground">{plural(visible.length, "product")} shown</span>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={Package} title={items.length ? "No products match these filters." : "No products yet."} description={items.length ? "Try a different search or filter." : "Add your first product to start selling."} action={items.length ? <button className="adm-btn" onClick={() => { setQuery(""); setCategory("All categories"); setStatusFilter("all"); setStockFilter("all"); }}>Clear filters</button> : <button className="adm-btn adm-btn-primary" onClick={() => openEditor()}><PackagePlus size={14} /> Add product</button>} />
        ) : view === "list" ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="w-10"><input type="checkbox" className="adm-check" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all shown products" /></th>
                    {sortHeader("name", "Product")}
                    <th>Category</th>
                    {sortHeader("price", "Price", "adm-right")}
                    {sortHeader("quantity", "Stock", "adm-right")}
                    <th>Status</th>
                    {sortHeader("updated", "Updated")}
                    <th className="w-12"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const stock = stockState(item.quantity, threshold);
                    return (
                      <tr key={item.id} data-selected={selected.has(item.id)}>
                        <td><input type="checkbox" className="adm-check" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Select ${item.name}`} /></td>
                        <td>
                          <button type="button" onClick={() => openEditor(item)} className="group flex min-w-0 items-center gap-3 text-left">
                            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary"><ResilientImage src={item.images[item.main] || item.images[0] || ""} alt="" className="h-full w-full object-cover" /></span>
                            <span className="min-w-0">
                              <b className="block truncate text-[13px] group-hover:underline">{item.name}</b>
                              <span className="block max-w-xs truncate text-[11px] text-muted-foreground">{item.subcategory}</span>
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap text-muted-foreground">{item.category}</td>
                        <td className="adm-right adm-num font-semibold">{money(item.price)}</td>
                        <td className="adm-right"><span className={`adm-num font-semibold ${stock.tone === "danger" ? "text-danger-ink" : stock.tone === "warning" ? "text-warning-ink" : ""}`}>{item.quantity}</span></td>
                        <td><Status>{item.status}</Status></td>
                        <td className="whitespace-nowrap text-[11px] text-muted-foreground">{item.updatedAt ? relativeTime(item.updatedAt) : "—"}</td>
                        <td className="adm-right"><ActionMenu label={`Actions for ${item.name}`} items={menuFor(item)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {visible.map((item) => {
                const stock = stockState(item.quantity, threshold);
                return (
                  <li key={item.id} className={`flex items-center gap-3 px-3 py-3 ${selected.has(item.id) ? "bg-brand/20" : ""}`}>
                    <input type="checkbox" className="adm-check" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Select ${item.name}`} />
                    <button type="button" onClick={() => openEditor(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary"><ResilientImage src={item.images[item.main] || item.images[0] || ""} alt="" className="h-full w-full object-cover" /></span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13px]">{item.name}</b>
                        <span className="adm-num block text-xs font-semibold">{money(item.price)}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5"><Status>{item.status}</Status><Pill tone={stock.tone}>{item.quantity <= 0 ? "Sold out" : `${item.quantity} in stock`}</Pill></span>
                      </span>
                    </button>
                    <ActionMenu label={`Actions for ${item.name}`} items={menuFor(item)} />
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((item) => {
              const stock = stockState(item.quantity, threshold);
              return (
                <article className={`group relative overflow-hidden rounded-2xl border bg-card transition hover:shadow-[var(--adm-shadow-pop)] ${selected.has(item.id) ? "border-foreground" : "border-border"}`} key={item.id}>
                  <button type="button" onClick={() => openEditor(item)} className="block w-full text-left">
                    <span className="relative block aspect-[4/3] overflow-hidden bg-secondary"><ResilientImage src={item.images[item.main] || item.images[0] || ""} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /></span>
                    <span className="block p-3.5">
                      <span className="flex items-start justify-between gap-2"><b className="line-clamp-1 text-[13px]">{item.name}</b><b className="adm-num shrink-0 text-[13px]">{money(item.price)}</b></span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.category} · {item.subcategory}</span>
                      <span className="mt-2.5 flex flex-wrap items-center gap-1.5"><Status>{item.status}</Status><Pill tone={stock.tone}>{item.quantity <= 0 ? "Sold out" : `${item.quantity} in stock`}</Pill><span className="ml-auto text-[10.5px] text-muted-foreground">{item.images.length}/4 photos</span></span>
                    </span>
                  </button>
                  <span className="absolute left-2.5 top-2.5 rounded-md bg-card/90 p-1"><input type="checkbox" className="adm-check block" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Select ${item.name}`} /></span>
                  <span className="absolute right-2 top-2 rounded-lg bg-card/90"><ActionMenu label={`Actions for ${item.name}`} items={menuFor(item)} /></span>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {selected.size > 0 && (
        <div className="cc-enter-up fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-lg flex-wrap items-center gap-2 rounded-2xl bg-[#201f1d] p-2 pl-4 text-white shadow-[var(--adm-shadow-pop)] ring-1 ring-white/10 sm:bottom-5">
          <b className="adm-num mr-auto text-sm">{plural(selected.size, "product")} selected</b>
          <button type="button" disabled={bulkBusy} onClick={() => void bulkStatus("Active")} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"><Eye size={14} /> Publish</button>
          <button type="button" disabled={bulkBusy} onClick={() => void bulkStatus("Inactive")} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"><EyeOff size={14} /> Hide</button>
          <button type="button" onClick={() => setSelected(new Set())} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      <ProductEditor open={Boolean(editing)} product={editing} setProduct={(next) => setEditing(next)} upload={upload} uploading={uploading} save={save} saving={saving} close={() => void requestCloseEditor()} error={error} />
      <Dialog
        open={Boolean(duplicateWarning)}
        onClose={() => setDuplicateWarning(null)}
        eyebrow="Duplicate product"
        title="This product already exists."
        footer={<button type="button" onClick={() => setDuplicateWarning(null)} className="adm-btn adm-btn-primary">Return to the editor</button>}
      >
        {duplicateWarning && (
          <p className="text-sm leading-6 text-muted-foreground">
            <b className="text-foreground">{duplicateWarning.name}</b> is already saved in {duplicateWarning.category} → {duplicateWarning.subcategory}. The same name can exist in a different subcategory, but not twice in the same place.
          </p>
        )}
      </Dialog>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}

export function ProductEditor({
  open,
  product,
  setProduct,
  upload,
  uploading = 0,
  save,
  saving = false,
  close,
  error,
}: {
  open: boolean;
  product: ManagedProduct | null;
  setProduct: (p: ManagedProduct) => void;
  upload: (files: FileList | File[] | null) => void;
  uploading?: number;
  save: () => void;
  saving?: boolean;
  close: () => void;
  error: string;
}) {
  const [shown, setShown] = useState(product);
  useEffect(() => {
    if (product) setShown(product);
  }, [product]);
  const current = product ?? shown;
  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow="Catalog editor"
      title={current?.id ? `Edit ${current.name || "product"}` : "Add a product"}
      width="max-w-3xl"
      headerAction={current?.id ? <a href={`/products/${encodeURIComponent(current.id)}`} target="_blank" rel="noopener" className="adm-btn adm-btn-sm hidden sm:inline-flex"><ExternalLink size={13} /> View in store</a> : undefined}
      footer={
        current && (
          <div className="flex flex-col gap-2">
            {error && <p role="alert" className="cc-enter-fade rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-ink">{error}</p>}
            <div className="flex items-center justify-between gap-2">
              <span className="hidden text-[11px] text-muted-foreground sm:block">{current.images.length}/4 photos · drafts are kept in this browser if you leave</span>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={close} className="adm-btn">Cancel</button>
                <button type="button" onClick={save} disabled={saving || uploading > 0} className="adm-btn adm-btn-primary">
                  {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                  {saving ? "Saving…" : current.id ? "Save changes" : "Create product"}
                </button>
              </div>
            </div>
          </div>
        )
      }
    >
      {current && <ProductEditorFields key={current.id || "new"} product={current} setProduct={setProduct} upload={upload} uploading={uploading} />}
    </Sheet>
  );
}

function ProductEditorFields({ product, setProduct, upload, uploading }: { product: ManagedProduct; setProduct: (p: ManagedProduct) => void; upload: (files: FileList | File[] | null) => void; uploading: number }) {
  const [materials, setMaterials] = useState<MaterialSpec[]>(() => parseMaterialSpecs(product.material));
  const [dimensions, setDimensions] = useState<DimensionSpec[]>(() => parseDimensionSpecs(product.dimensions));
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const commitMaterials = (next: MaterialSpec[]) => {
    setMaterials(next);
    setProduct({ ...product, material: serializeMaterialSpecs(next) });
  };
  const commitDimensions = (next: DimensionSpec[]) => {
    setDimensions(next);
    setProduct({ ...product, dimensions: serializeDimensionSpecs(next) });
  };
  const removeImage = (index: number) => {
    const nextMain = index === product.main ? 0 : index < product.main ? product.main - 1 : product.main;
    setProduct({ ...product, images: product.images.filter((_, i) => i !== index), main: Math.max(0, nextMain) });
  };
  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= product.images.length || from === to) return;
    const images = [...product.images];
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    const mainImage = product.images[product.main];
    setProduct({ ...product, images, main: Math.max(0, images.indexOf(mainImage)) });
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) upload(event.dataTransfer.files);
  };
  const section = (title: string, description: string | null, children: ReactNode) => (
    <section className="border-b border-border px-4 py-5 last:border-b-0 sm:px-6">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
  return (
    <div>
      {section(
        "Basics",
        "What customers see first.",
        <div className="grid gap-4">
          <label className="adm-label">
            Product name
            <input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} className="adm-input font-normal" placeholder="e.g. Nara Lounge Chair" autoFocus={!product.id} />
          </label>
          <label className="adm-label">
            Description
            <textarea value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} rows={5} maxLength={2000} className="adm-textarea min-h-32 font-normal" placeholder="Describe the design, comfort, intended use, and distinctive qualities." aria-describedby="product-description-help" />
            <span id="product-description-help" className="adm-hint flex justify-between gap-4"><span>Shown on the product page and updated in realtime.</span><span className="adm-num">{product.description.length}/2000</span></span>
          </label>
        </div>,
      )}
      {section(
        "Photos",
        "Exactly four photos. Drag to reorder; the main photo leads in the storefront.",
        <div
          onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed p-3 transition-colors ${dragOver ? "border-foreground bg-brand/20" : "border-transparent"}`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {product.images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(event) => { if (dragIndex !== null) event.preventDefault(); }}
                onDrop={(event) => { if (dragIndex !== null) { event.preventDefault(); event.stopPropagation(); moveImage(dragIndex, index); setDragIndex(null); } }}
                className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl border-2 bg-secondary transition active:cursor-grabbing ${product.main === index ? "border-foreground" : "border-transparent"} ${dragIndex === index ? "opacity-40" : ""}`}
              >
                <ResilientImage src={image} alt={`Product photo ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                  <button type="button" onClick={() => setProduct({ ...product, main: index })} className={`rounded-md px-2 py-1 text-[9.5px] font-bold shadow-sm ${product.main === index ? "bg-foreground text-background" : "bg-card/95 text-foreground"}`}>{product.main === index ? "MAIN" : "Set main"}</button>
                  <span className="flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" onClick={() => moveImage(index, index - 1)} disabled={index === 0} className="grid h-6 w-6 place-items-center rounded-md bg-card/95 disabled:opacity-40" aria-label={`Move photo ${index + 1} earlier`}><ChevronLeft size={13} /></button>
                    <button type="button" onClick={() => moveImage(index, index + 1)} disabled={index === product.images.length - 1} className="grid h-6 w-6 place-items-center rounded-md bg-card/95 disabled:opacity-40" aria-label={`Move photo ${index + 1} later`}><ChevronRight size={13} /></button>
                  </span>
                </span>
                <button type="button" onClick={() => removeImage(index)} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-[#201f1d]/80 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label={`Remove photo ${index + 1}`}><X size={13} /></button>
              </div>
            ))}
            {Array.from({ length: uploading }, (_, index) => <div key={`uploading-${index}`} className="adm-skeleton grid aspect-square place-items-center rounded-xl"><span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" /></div>)}
            {product.images.length + uploading < 4 && (
              <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-xl border border-dashed border-line-strong bg-subtle text-center text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                <span className="grid justify-items-center gap-1.5 px-2"><ImagePlus size={20} /> <b className="font-semibold">Add photos</b><span className="hidden text-[10px] sm:block">or drop files here</span></span>
              </button>
            )}
          </div>
          <input ref={fileRef} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} multiple accept="image/jpeg,image/png,image/webp" type="file" className="hidden" />
          <p className={`mt-3 flex items-center gap-1.5 text-xs ${product.images.length === 4 ? "text-success-ink" : "text-warning-ink"}`}>
            {product.images.length === 4 ? <CheckCircle2 size={13} /> : <Upload size={13} />}
            <span className="adm-num">{product.images.length}/4 photos</span>
            {product.images.length === 4 ? "· ready" : product.images.length > 4 ? `· remove ${product.images.length - 4} to continue` : `· ${4 - product.images.length} more needed`}
          </p>
        </div>,
      )}
      {section(
        "Placement & pricing",
        null,
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="adm-label">
            Room category
            <select value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value, subcategory: catalogTaxonomy[e.target.value][0] })} className="adm-select font-normal">
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <span className="adm-hint">{taxonomyGroups[product.category]?.join(" · ")}</span>
          </label>
          <label className="adm-label">
            Subcategory
            <select value={product.subcategory} onChange={(e) => setProduct({ ...product, subcategory: e.target.value })} className="adm-select font-normal">
              {(catalogTaxonomy[product.category] ?? []).map((sub) => <option key={sub}>{sub}</option>)}
            </select>
            <span className="adm-hint">Matches the customer-facing collection filters.</span>
          </label>
          <label className="adm-label">
            Price
            <span className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
              <input value={product.price || ""} onChange={(e) => setProduct({ ...product, price: Number(e.target.value) })} type="number" min={0} inputMode="decimal" className="adm-input adm-num pl-8 font-normal" placeholder="0" />
            </span>
          </label>
          <label className="adm-label">
            {product.id ? "Stock on hand" : "Opening stock"}
            <input disabled={Boolean(product.id)} value={product.id ? product.quantity : product.quantity || ""} onChange={(e) => setProduct({ ...product, quantity: Number(e.target.value) })} type="number" min={0} inputMode="numeric" className="adm-input adm-num font-normal" placeholder="0" />
            {product.id && <span className="adm-hint">Use <Link to="/admin/inventory" className="font-semibold underline">Inventory</Link> to adjust stock with a recorded reason.</span>}
          </label>
          <div className="adm-label sm:col-span-2">
            Publishing
            <Segmented
              label="Publishing status"
              className="w-full [&>button]:flex-1 [&>button]:justify-center"
              value={product.status}
              onChange={(status) => setProduct({ ...product, status })}
              items={[
                { value: "Active", label: <><Eye size={13} /> Live</> },
                { value: "Draft", label: <><Pencil size={13} /> Draft</> },
                { value: "Inactive", label: <><EyeOff size={13} /> Hidden</> },
              ]}
            />
            <span className="adm-hint">{product.status === "Active" ? "Visible to customers in the selected collection right away." : product.status === "Draft" ? "Only admins can see it." : "Hidden from customers; kept for later."}</span>
          </div>
        </div>,
      )}
      {section(
        "Details",
        "Specifications shown on the product page.",
        <div className="grid gap-5">
          <label className="adm-label">
            Confirmed colour
            <input value={product.color ?? ""} maxLength={100} onChange={(event) => setProduct({ ...product, color: event.target.value })} placeholder="e.g. Dark grey, beige, or white / natural wood" className="adm-input font-normal" />
            <span className="adm-hint">The colour of the actual variant sold. Takes priority over photo-based suggestions in Find My Furniture.</span>
          </label>
          <fieldset className="grid gap-2.5">
            <div className="flex items-center justify-between">
              <legend className="text-[0.78rem] font-semibold">Finish &amp; materials</legend>
              <button type="button" onClick={() => commitMaterials([...materials, { type: "", description: "" }])} className="adm-btn adm-btn-sm"><Plus size={13} /> Add material</button>
            </div>
            <ul className="grid gap-2">
              {materials.map((material, index) => (
                <li key={index} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)_auto] items-center gap-2">
                  <input value={material.type} onChange={(event) => commitMaterials(materials.map((item, i) => (i === index ? { ...item, type: event.target.value } : item)))} className="adm-input font-semibold" placeholder="Material" aria-label={`Material type ${index + 1}`} />
                  <input value={material.description} onChange={(event) => commitMaterials(materials.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)))} className="adm-input font-normal" placeholder="e.g. Solid oak frame" aria-label={`Material description ${index + 1}`} />
                  <button type="button" onClick={() => commitMaterials(materials.filter((_, i) => i !== index))} disabled={materials.length === 1} className="adm-btn adm-btn-icon" aria-label={`Remove material ${index + 1}`}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </fieldset>
          <fieldset className="grid gap-2.5">
            <div className="flex items-center justify-between">
              <legend className="text-[0.78rem] font-semibold">Dimensions</legend>
              <button type="button" onClick={() => commitDimensions([...dimensions, { label: "", value: "", unit: "cm" }])} className="adm-btn adm-btn-sm"><Plus size={13} /> Add dimension</button>
            </div>
            <ul className="grid gap-2">
              {dimensions.map((dimension, index) => (
                <li key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(70px,.6fr)_84px_auto] items-center gap-2">
                  <input value={dimension.label} onChange={(event) => commitDimensions(dimensions.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))} className="adm-input font-semibold" placeholder={index === 0 ? "Width" : "Seat height"} aria-label={`Measurement name ${index + 1}`} />
                  <input value={dimension.value} onChange={(event) => commitDimensions(dimensions.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))} className="adm-input adm-num font-normal" placeholder="120" inputMode="decimal" aria-label={`Measurement value ${index + 1}`} />
                  <select value={dimension.unit} onChange={(event) => commitDimensions(dimensions.map((item, i) => (i === index ? { ...item, unit: event.target.value } : item)))} className="adm-select font-normal" aria-label={`Measurement unit ${index + 1}`}>
                    <option value="">Unit</option>
                    {["mm", "cm", "m", "in", "ft"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                  <button type="button" onClick={() => commitDimensions(dimensions.filter((_, i) => i !== index))} disabled={dimensions.length === 1} className="adm-btn adm-btn-icon" aria-label={`Remove dimension ${index + 1}`}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

type Movement = { id: number; product_id: string; previous_quantity: number; new_quantity: number; quantity_delta: number; reason: string; created_at: string };
const adjustmentReasons = { add: ["New warehouse delivery", "Stock count correction", "Customer return restocked"], remove: ["Damaged item", "Stock count correction", "Returned to supplier"] };

export function InventoryPage() {
  const { adminProducts, storeSettings } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const threshold = storeSettings.low_stock_threshold ?? 8;
  const { notice, notify, clear } = useNotice();
  const [adjustment, setAdjustment] = useState<{ id: string; direction: -1 | 1 } | null>(null);
  const [adjustmentUnits, setAdjustmentUnits] = useState("1");
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const filter = (["low", "out"].includes(searchParams.get("filter") ?? "") ? searchParams.get("filter") : "all") as "all" | "low" | "out";
  const setFilter = (value: "all" | "low" | "out") => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("filter");
    else next.set("filter", value);
    setSearchParams(next, { replace: true });
  };
  const [sort, setSort] = useState<"urgency" | "name" | "most">("urgency");
  const products = useMemo(() => adminProducts.map((product) => ({ id: product.id, name: product.name, category: product.category, subcategory: product.subcategory ?? "", quantity: product.stockQuantity ?? 0, status: product.status ?? "active", image: primaryProductImage(product) })), [adminProducts]);
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const lowCount = products.filter((item) => item.quantity > 0 && item.quantity <= threshold).length;
  const outCount = products.filter((item) => item.quantity <= 0).length;
  const totalUnits = products.reduce((sum, item) => sum + item.quantity, 0);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((item) => (filter === "all" ? true : filter === "out" ? item.quantity <= 0 : item.quantity <= threshold))
      .filter((item) => !term || `${item.name} ${item.category} ${item.subcategory} ${item.id}`.toLowerCase().includes(term))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "most" ? b.quantity - a.quantity : a.quantity - b.quantity || a.name.localeCompare(b.name)));
  }, [products, filter, query, sort, threshold]);
  const live = adjustment ? byId.get(adjustment.id) : undefined;
  const parsedUnits = Number(adjustmentUnits);
  const validUnits = Number.isInteger(parsedUnits) && parsedUnits > 0;
  const removalExceedsStock = Boolean(adjustment?.direction === -1 && live && validUnits && parsedUnits > live.quantity);
  const resultingStock = live && adjustment && validUnits ? live.quantity + adjustment.direction * parsedUnits : live?.quantity ?? 0;

  const loadMovements = useCallback(async () => {
    const { data } = await supabase.from("inventory_movements").select("id,product_id,previous_quantity,new_quantity,quantity_delta,reason,created_at").order("created_at", { ascending: false }).limit(12);
    setMovements((data ?? []) as Movement[]);
  }, []);
  useEffect(() => {
    void loadMovements();
    const channel = supabase.channel("admin-inventory-ledger").on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, () => void loadMovements()).subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMovements]);

  const openAdjustment = (id: string, direction: -1 | 1) => {
    setAdjustment({ id, direction });
    setAdjustmentUnits("1");
    setReason("");
  };
  const closeAdjustment = () => {
    if (!adjusting) setAdjustment(null);
  };
  const adjust = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!adjustment || !live) return;
    if (!validUnits) return notify("Enter a whole number of units greater than zero.", "error");
    if (removalExceedsStock) return notify(`You can remove at most ${plural(live.quantity, "unit")} from this product.`, "error");
    if (reason.trim().length < 3) return notify("Add a short reason for this stock adjustment.", "error");
    const delta = adjustment.direction * parsedUnits;
    setAdjusting(true);
    const { error } = await supabase.rpc("adjust_product_inventory", { p_product_id: live.id, p_delta: delta, p_reason: reason.trim() });
    setAdjusting(false);
    if (error) return notify(error.message, "error");
    notify(`${live.name}: ${plural(Math.abs(delta), "unit")} ${delta > 0 ? "added" : "removed"} · now ${live.quantity + delta} in stock.`);
    setAdjustment(null);
    await loadMovements();
  };

  return (
    <AdminShell title="Inventory">
      <PageHeader
        eyebrow="Live stock control"
        title="Inventory"
        description="Every adjustment updates the storefront immediately and is recorded in the ledger below."
        meta={<LiveBadge live liveLabel="Live stock" />}
      >
        <StatStrip
          items={[
            { label: "Units on hand", value: totalUnits, note: `Across ${plural(products.length, "product")}`, icon: Boxes },
            { label: "Low stock", value: lowCount, note: `1–${threshold} units left`, icon: AlertTriangle, tone: lowCount ? "warning" : "neutral", to: "/admin/inventory?filter=low" },
            { label: "Sold out", value: outCount, note: "Zero units available", icon: Archive, tone: outCount ? "danger" : "neutral", to: "/admin/inventory?filter=out" },
            { label: "Healthy", value: products.length - lowCount - outCount, note: `More than ${threshold} units`, icon: CheckCircle2, tone: "success" },
          ]}
        />
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.8fr)] xl:items-start">
        <Card className="overflow-hidden">
          <div className="grid gap-2.5 border-b border-border p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <SearchField value={query} onChange={setQuery} label="Search stock" placeholder="Search product, category, or ID" />
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort stock" className="adm-select h-11 w-auto text-xs font-semibold">
              <option value="urgency">Most urgent first</option>
              <option value="name">Name A–Z</option>
              <option value="most">Most stock first</option>
            </select>
          </div>
          <div className="border-b border-border px-3 py-2.5 sm:px-4">
            <Segmented label="Stock level" value={filter} onChange={setFilter} items={[{ value: "all", label: "All", count: products.length }, { value: "low", label: "Needs restock", count: lowCount + outCount }, { value: "out", label: "Sold out", count: outCount }]} />
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={Warehouse} title={filter === "all" ? "No products match your search." : "Nothing needs restocking."} description={filter === "all" ? "Try another name or ID." : "Every product is above the low-stock threshold."} />
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((item) => {
                const state = stockState(item.quantity, threshold);
                const fill = Math.min(100, (item.quantity / Math.max(threshold * 3, 1)) * 100);
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary"><ResilientImage src={item.image ?? ""} alt="" className="h-full w-full object-cover" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="truncate text-[13px]">{item.name}</b>
                        {item.status !== "active" && <Status>{item.status}</Status>}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">{item.category} · <span className="font-mono">{item.id}</span><CopyButton value={item.id} label="product ID" /></p>
                      <div className="mt-1.5 h-1.5 max-w-[14rem] overflow-hidden rounded-full bg-secondary">
                        <div className={`adm-bar-grow h-full rounded-full ${state.tone === "danger" ? "bg-danger-ink" : state.tone === "warning" ? "bg-[#d39a64]" : "bg-[#6f8a66]"}`} style={{ width: `${Math.max(item.quantity > 0 ? 4 : 0, fill)}%` }} />
                      </div>
                    </div>
                    <Pill tone={state.tone} className="hidden sm:inline-flex">{state.label}</Pill>
                    <div className="ml-auto flex h-10 items-center rounded-xl border border-border bg-card">
                      <button type="button" aria-label={`Remove units from ${item.name}`} title="Remove units" onClick={() => openAdjustment(item.id, -1)} disabled={item.quantity === 0} className="grid h-full w-10 place-items-center rounded-l-xl transition hover:bg-secondary disabled:opacity-30"><Minus size={14} /></button>
                      <span className={`adm-num min-w-12 px-1 text-center text-sm font-semibold ${state.tone === "danger" ? "text-danger-ink" : state.tone === "warning" ? "text-warning-ink" : ""}`}>{item.quantity}</span>
                      <button type="button" aria-label={`Add units to ${item.name}`} title="Add units" onClick={() => openAdjustment(item.id, 1)} className="grid h-full w-10 place-items-center rounded-r-xl transition hover:bg-secondary"><Plus size={14} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="overflow-hidden xl:sticky xl:top-[5.25rem]">
          <CardHeader eyebrow="Stock ledger" title="Recent movements" description="Manual, checkout, cancellation, and refund changes." />
          {movements === null ? (
            <div className="grid gap-2 p-4">{[0, 1, 2, 3].map((row) => <span key={row} className="adm-skeleton block h-11 w-full" />)}</div>
          ) : movements.length === 0 ? (
            <EmptyState icon={Warehouse} title="No stock movements yet." compact />
          ) : (
            <ul className="divide-y divide-border xl:max-h-[calc(100dvh-14rem)] xl:overflow-y-auto">
              {movements.map((movement) => {
                const product = byId.get(movement.product_id);
                return (
                  <li key={movement.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-secondary">{product?.image && <ResilientImage src={product.image} alt="" className="h-full w-full object-cover" />}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[12.5px]">{product?.name ?? movement.product_id}</b>
                      <p className="truncate text-[11px] text-muted-foreground">{movement.reason} · <time dateTime={movement.created_at} title={formatDateTime(movement.created_at)}>{relativeTime(movement.created_at)}</time></p>
                    </div>
                    <Pill tone={movement.quantity_delta > 0 ? "success" : "warning"} className="adm-num">{movement.quantity_delta > 0 ? "+" : "−"}{Math.abs(movement.quantity_delta)}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <Dialog
        open={Boolean(adjustment && live)}
        onClose={closeAdjustment}
        busy={adjusting}
        eyebrow="Inventory adjustment"
        title={adjustment?.direction === 1 ? "Add stock" : "Remove stock"}
        footer={
          <>
            <button type="button" onClick={closeAdjustment} disabled={adjusting} className="adm-btn">Cancel</button>
            <button type="button" onClick={() => void adjust()} disabled={adjusting || !validUnits || removalExceedsStock || reason.trim().length < 3} className="adm-btn adm-btn-primary">
              {adjusting ? "Saving…" : `${adjustment?.direction === 1 ? "Add" : "Remove"} ${validUnits ? plural(parsedUnits, "unit") : "units"}`}
            </button>
          </>
        }
      >
        {live && adjustment && (
          <form onSubmit={adjust}>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-subtle p-3">
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary"><ResilientImage src={live.image ?? ""} alt="" className="h-full w-full object-cover" /></span>
              <div className="min-w-0"><b className="block truncate text-sm">{live.name}</b><span className="text-[11px] text-muted-foreground">{live.category}</span></div>
            </div>
            <label className="adm-label mt-4" htmlFor="inventory-units">Number of units</label>
            <div className="mt-1.5 flex gap-2">
              <input id="inventory-units" autoFocus required type="number" inputMode="numeric" min={1} max={adjustment.direction < 0 ? live.quantity : undefined} step={1} value={adjustmentUnits} onChange={(event) => setAdjustmentUnits(event.target.value.replace(/[^0-9]/g, ""))} className="adm-input adm-num h-12 flex-1 text-lg font-semibold" />
              {[1, 5, 10].map((preset) => <button key={preset} type="button" onClick={() => setAdjustmentUnits(String(preset))} className={`adm-btn h-12 min-w-12 ${adjustmentUnits === String(preset) ? "!border-foreground" : ""}`}>{preset}</button>)}
            </div>
            {removalExceedsStock && <p className="mt-2 text-xs font-semibold text-danger-ink" role="alert">Only {plural(live.quantity, "unit")} can be removed.</p>}
            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-border text-center">
              <div className="p-3"><p className="adm-eyebrow">Current</p><p className="adm-num mt-1 text-xl font-semibold">{live.quantity}</p></div>
              <div className="border-x border-border p-3"><p className="adm-eyebrow">Change</p><p className={`adm-num mt-1 text-xl font-semibold ${adjustment.direction > 0 ? "text-success-ink" : "text-warning-ink"}`}>{validUnits ? `${adjustment.direction > 0 ? "+" : "−"}${parsedUnits}` : "—"}</p></div>
              <div className="bg-subtle p-3"><p className="adm-eyebrow">New stock</p><p className="adm-num mt-1 text-xl font-semibold">{validUnits && !removalExceedsStock ? resultingStock : "—"}</p></div>
            </div>
            <label className="adm-label mt-4" htmlFor="inventory-reason">Reason</label>
            <input id="inventory-reason" required minLength={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. New warehouse delivery" className="adm-input mt-1.5 font-normal" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {adjustmentReasons[adjustment.direction > 0 ? "add" : "remove"].map((option) => <button key={option} type="button" onClick={() => setReason(option)} data-active={reason === option} className="adm-chip !min-h-8 !text-[11px]">{option}</button>)}
            </div>
            <p className="adm-hint mt-3">One reason is recorded in the ledger for the whole adjustment.</p>
          </form>
        )}
      </Dialog>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

type CategoryRow = { id: number; name: string; slug: string; sort_order: number; active: boolean };

export function CategoriesPage() {
  const { adminProducts: products } = useStore();
  const [rows, setRows] = useState<CategoryRow[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { notice, notify, clear } = useNotice();
  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase.from("categories").select("id,name,slug,sort_order,active").order("sort_order");
    if (error) {
      notify(error.message, "error");
      setRows((current) => current ?? []);
      return;
    }
    setRows((data ?? []) as CategoryRow[]);
  }, [notify]);
  useEffect(() => {
    void loadCategories();
    const channel = supabase.channel("admin-categories").on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => void loadCategories()).subscribe();
    const refreshOnFocus = () => void loadCategories();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [loadCategories]);
  const categoriesWithStats = useMemo(
    () =>
      (rows ?? []).map((row) => {
        const categoryProducts = products.filter((product) => product.category === row.name);
        return {
          ...row,
          products: categoryProducts,
          image: (categoryProducts[0] ? primaryProductImage(categoryProducts[0]) : undefined) ?? (products[0] ? primaryProductImage(products[0]) : ""),
          live: categoryProducts.filter((product) => product.status === "active").length,
        };
      }),
    [rows, products],
  );
  const selected = categoriesWithStats.find((category) => category.id === activeId) ?? categoriesWithStats[0];
  const subcategories = useMemo(() => {
    if (!selected) return [];
    const known = catalogTaxonomy[selected.name] ?? [];
    const used = Array.from(new Set(selected.products.map((product) => product.subcategory).filter((name): name is string => Boolean(name))));
    return Array.from(new Set([...known, ...used])).map((name) => {
      const inSub = selected.products.filter((product) => product.subcategory === name);
      return { name, count: inSub.length, live: inSub.filter((product) => product.status === "active").length };
    });
  }, [selected]);
  const [showEmpty, setShowEmpty] = useState(false);
  const shownSubs = showEmpty ? subcategories : subcategories.filter((sub) => sub.count > 0);

  const createCategory = async () => {
    const name = await promptAction({
      title: "New room category",
      label: "Category name",
      placeholder: "e.g. Home office",
      description: "It appears in the storefront once products are assigned to it.",
      confirmLabel: "Create category",
      validate: (value) => (value.length < 3 ? "Use at least 3 characters." : categoriesWithStats.some((category) => category.name.toLowerCase() === value.toLowerCase()) ? "That category already exists." : null),
    });
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("categories").insert({ name, slug, sort_order: categoriesWithStats.length + 1, active: true });
    if (error) notify(error.message, "error");
    else {
      notify(`${name} created.`);
      await loadCategories();
    }
  };
  const move = async (index: number, direction: -1 | 1) => {
    const list = [...categoriesWithStats];
    const target = index + direction;
    if (target < 0 || target >= list.length || busy) return;
    const a = list[index];
    const b = list[target];
    setBusy(true);
    setRows((current) => current && current.map((row) => (row.id === a.id ? { ...row, sort_order: b.sort_order } : row.id === b.id ? { ...row, sort_order: a.sort_order } : row)).sort((x, y) => x.sort_order - y.sort_order));
    const [first, second] = await Promise.all([
      supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    setBusy(false);
    if (first.error || second.error) {
      notify((first.error ?? second.error)!.message, "error");
      await loadCategories();
    } else notify(`${a.name} moved ${direction < 0 ? "up" : "down"} in the storefront menu.`);
  };
  const toggleCategory = async () => {
    if (!selected) return;
    const confirmed = await confirmAction({
      title: selected.active ? `Hide ${selected.name} from the storefront?` : `Show ${selected.name} in the storefront?`,
      description: selected.active ? "The room disappears from customer navigation. Its products keep their own publishing status." : "The room returns to customer navigation right away.",
      confirmLabel: selected.active ? "Hide category" : "Show category",
    });
    if (!confirmed) return;
    const { error } = await supabase.from("categories").update({ active: !selected.active }).eq("id", selected.id);
    if (error) notify(error.message, "error");
    else {
      notify(`${selected.name} is now ${selected.active ? "hidden from" : "visible in"} the storefront.`);
      await loadCategories();
    }
  };
  const toggleSub = async (name: string, live: boolean, count: number) => {
    if (!selected) return;
    const confirmed = await confirmAction({
      title: live ? `Hide every ${name} product?` : `Publish every ${name} product?`,
      description: live ? `${plural(count, "product")} in ${selected.name} → ${name} will be hidden from customers.` : `${plural(count, "product")} in ${selected.name} → ${name} will go live in the storefront.`,
      confirmLabel: live ? "Hide products" : "Publish products",
      tone: live ? "danger" : "default",
    });
    if (!confirmed) return;
    const { error } = await supabase.from("products").update({ status: live ? "inactive" : "active" }).eq("category", selected.name).eq("subcategory", name);
    if (error) notify(error.message, "error");
    else notify(`${name} ${live ? "hidden from" : "published to"} the storefront.`);
  };

  return (
    <AdminShell title="Categories">
      <PageHeader
        eyebrow="Catalog architecture"
        title="Categories"
        description="Shape how customers discover the collection, from room-level navigation to the smallest browse path."
        actions={<button onClick={() => void createCategory()} className="adm-btn adm-btn-primary"><Plus size={15} /> New category</button>}
      />
      {rows === null ? (
        <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><span className="adm-skeleton block h-72 w-full rounded-[1.25rem]" /><span className="adm-skeleton block h-72 w-full rounded-[1.25rem]" /></div>
      ) : !selected ? (
        <Card><EmptyState icon={Boxes} title="No categories yet." description="Create the first room to organize the catalog." action={<button onClick={() => void createCategory()} className="adm-btn adm-btn-primary"><Plus size={14} /> New category</button>} /></Card>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
            <Card className="overflow-hidden">
              <CardHeader eyebrow="Storefront menu" title="Collection map" description={`${plural(products.length, "product")} across ${plural(categoriesWithStats.length, "room")} · order matches the storefront`} />
              <ol className="divide-y divide-border">
                {categoriesWithStats.map((category, index) => {
                  const active = category.id === selected.id;
                  return (
                    <li key={category.id} className={`relative flex items-center gap-2 pr-2 transition-colors ${active ? "bg-brand/25" : "hover:bg-subtle"}`}>
                      {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-foreground" aria-hidden="true" />}
                      <button type="button" onClick={() => setActiveId(category.id)} aria-current={active ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left">
                        <span className="adm-num w-5 text-[11px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary"><ResilientImage src={category.image} alt="" className="h-full w-full object-cover" /></span>
                        <span className="min-w-0 flex-1">
                          <b className="flex items-center gap-2 text-[13px]">{category.name}{!category.active && <Pill tone="neutral">Hidden</Pill>}</b>
                          <span className="block text-[11px] text-muted-foreground">{plural(category.products.length, "product")} · {category.live} live</span>
                        </span>
                      </button>
                      <span className="flex flex-col">
                        <button type="button" onClick={() => void move(index, -1)} disabled={index === 0 || busy} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30" aria-label={`Move ${category.name} up`}><ArrowUp size={13} /></button>
                        <button type="button" onClick={() => void move(index, 1)} disabled={index === categoriesWithStats.length - 1 || busy} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30" aria-label={`Move ${category.name} down`}><ArrowDown size={13} /></button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
            <Card key={selected.id} className="adm-swap overflow-hidden">
              <div className="relative h-44 overflow-hidden bg-secondary sm:h-52">
                <ResilientImage src={selected.image} alt={selected.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-5 text-white">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/75">Room category · /{selected.slug}</p>
                    <h2 className="mt-1 font-serif text-[2rem] leading-none">{selected.name}</h2>
                  </div>
                  <Pill tone={selected.active ? "success" : "neutral"} dot>{selected.active ? "Live in storefront" : "Hidden"}</Pill>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[["Products", selected.products.length], ["Subcategories used", subcategories.filter((sub) => sub.count > 0).length], ["Live now", selected.live]].map(([label, value]) => (
                  <div key={label} className="p-4 text-center"><p className="adm-num font-serif text-[1.7rem] leading-none">{value}</p><p className="adm-eyebrow mt-1.5">{label}</p></div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                <button type="button" onClick={() => void toggleCategory()} className="adm-btn">{selected.active ? <><EyeOff size={14} /> Hide category</> : <><Eye size={14} /> Show category</>}</button>
                <a href={storefrontPath(selected.name)} target="_blank" rel="noopener" className="adm-btn"><ExternalLink size={14} /> Preview in store</a>
                <Link to={`/admin/products/new?category=${encodeURIComponent(selected.name)}`} className="adm-btn adm-btn-primary"><PackagePlus size={14} /> Add product here</Link>
              </div>
            </Card>
          </div>
          <Card className="mt-5 overflow-hidden">
            <CardHeader
              eyebrow="Browse paths"
              title={`${selected.name} subcategories`}
              description="Subcategories come from each product’s placement. Visibility changes apply to every product inside."
              action={<label className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><input type="checkbox" className="adm-check" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} /> Show empty</label>}
            />
            {shownSubs.length === 0 ? (
              <EmptyState icon={Package} title="No products in this room yet." action={<Link to={`/admin/products/new?category=${encodeURIComponent(selected.name)}`} className="adm-btn adm-btn-primary"><PackagePlus size={14} /> Add the first product</Link>} compact />
            ) : (
              <ul className="grid overflow-hidden sm:grid-cols-2 xl:grid-cols-3">
                {shownSubs.map((sub) => (
                  <li key={sub.name} className="flex flex-col gap-3 bg-card p-4 shadow-[0_0_0_0.5px_var(--border)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b className="block text-[13px]">{sub.name}</b>
                        <span className="text-[11px] text-muted-foreground">{sub.count ? `${plural(sub.count, "product")} · ${sub.live} live` : "No products yet"}</span>
                      </div>
                      {sub.count > 0 && <Pill tone={sub.live ? "success" : "neutral"}>{sub.live ? "Live" : "Hidden"}</Pill>}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {sub.count > 0 && <button type="button" onClick={() => void toggleSub(sub.name, sub.live > 0, sub.count)} className="adm-btn adm-btn-sm">{sub.live ? <><EyeOff size={12} /> Hide all</> : <><Eye size={12} /> Publish all</>}</button>}
                      {sub.count > 0 && <a href={`${storefrontPath(selected.name)}?type=${encodeURIComponent(sub.name)}`} target="_blank" rel="noopener" className="adm-btn adm-btn-sm"><ExternalLink size={12} /> Preview</a>}
                      <Link to={`/admin/products/new?category=${encodeURIComponent(selected.name)}&subcategory=${encodeURIComponent(sub.name)}`} className="adm-btn adm-btn-ghost adm-btn-sm"><Plus size={12} /> Add product <ArrowRight size={11} /></Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}
