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
import { createPortal } from "react-dom";
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
import { ResilientImage } from "@/app/components/media/ResilientImage";
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
  serializeDimensionSpecs,
  serializeMaterialSpecs,
  type DimensionSpec,
  type MaterialSpec,
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

import { AdminShell } from "./shell";

export const catalogTaxonomy: Record<string, string[]> = {
  "Living room": [
    "2-Seater Fabric Sofa",
    "3-Seater Fabric Sofa",
    "Sectional Sofa",
    "Recliner Sofa",
    "Sofa Bed",
    "Wooden Coffee Table",
    "Glass Coffee Table",
    "Round Coffee Table",
    "Storage Coffee Table",
    "Marble Coffee Table",
    "Wooden TV Stand",
    "Floating TV Stand",
    "Corner TV Stand",
    "TV Cart",
    "Modern TV Stand",
  ],
  Bedroom: [
    "Single Size Bed",
    "Double Size Bed",
    "Queen Size Bed",
    "King Size Bed",
    "Bunk Bed",
    "2-Door Wardrobe",
    "3-Door Wardrobe",
    "Sliding Door Wardrobe",
    "Walk-in Wardrobe",
    "Corner Wardrobe",
    "Wooden Nightstand",
    "Modern Nightstand",
    "Floating Nightstand",
    "Nightstand with Drawer",
    "Metal Nightstand",
  ],
  "Dining room": [
    "Extendable Dining Table",
    "Marble Top Dining Table",
    "Glass Dining Table",
    "Wooden Ornate Dining Table",
    "Metal Industrial Dining Table",
    "Wooden Ornate Dining Chairs",
    "Modern Plastic Dining Chairs",
    "Metal Industrial Dining Chairs",
    "Molded Resin Dining Chairs",
    "Luxury Velvet Dining Chairs",
    "Dining Hutch Cabinet",
    "Buffet Cabinet",
    "Pantry Cabinets",
    "Wine Storage Cabinet",
    "Serving Trolleys",
  ],
};

export const taxonomyGroups: Record<string, string[]> = {
  "Living room": ["Sofas", "Coffee Tables", "TV Stands"],
  Bedroom: ["Beds", "Wardrobes", "Nightstands"],
  "Dining room": ["Dining Tables", "Dining Chairs", "Dining Storage"],
};

export const initialManagedProducts: ManagedProduct[] = fallbackProducts
  .slice(0, 8)
  .map((p, i) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    subcategory:
      p.category === "Living room"
        ? i === 0
          ? "2-Seater Fabric Sofa"
          : i === 4
            ? "Sectional Sofa"
            : i === 5
              ? "Marble Coffee Table"
              : "Wooden TV Stand"
        : p.category === "Bedroom"
          ? i === 3
            ? "Queen Size Bed"
            : i === 6
              ? "2-Door Wardrobe"
              : "Modern Nightstand"
          : i === 2
            ? "Luxury Velvet Dining Chairs"
            : "Extendable Dining Table",
    price: p.price,
    quantity: [4, 9, 18, 0, 11, 6, 5, 12][i] ?? 8,
    status: "Active",
    images: [...p.images],
    main: 0,
    material: materialFor(p.id),
    dimensions: p.dimensions,
  }));

export function ProductManager() {
  const location = useLocation();
  const { adminProducts, saveProduct, deleteProduct, uploadProductImages } = useStore();
  const toManaged = (p: Product): ManagedProduct => ({ id:p.id, name:p.name, description:p.description, category:p.category, subcategory:p.subcategory ?? subcategoryFor(p.id), price:p.price, quantity:p.stockQuantity ?? 0, status:p.status === "draft" ? "Draft" : p.status === "inactive" ? "Inactive" : "Active", images:[...p.images], main:p.mainImageIndex ?? 0, material:p.material ?? materialFor(p.id), dimensions:p.dimensions });
  const [items, setItems] = useState<ManagedProduct[]>(adminProducts.map(toManaged));
  useEffect(() => setItems(adminProducts.map(toManaged)), [adminProducts]);
  const [view, setView] = useState<"grid" | "list">("list");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All categories");
  const [editing, setEditing] = useState<ManagedProduct | null>(
    location.pathname.endsWith("/new")
      ? {
          id: "",
          name: "",
          description: "",
          category: "Living room",
          subcategory: catalogTaxonomy["Living room"][0],
          price: 0,
          quantity: 0,
          status: "Active",
          images: [],
          main: 0,
          material: "",
          dimensions: "",
        }
      : null,
  );
  const [menu, setMenu] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const showForm = (item?: ManagedProduct) => {
    setEditing(
      item
        ? { ...item, images: [...item.images] }
        : {
            id: "",
            name: "",
            description: "",
            category: "Living room",
            subcategory: catalogTaxonomy["Living room"][0],
            price: 0,
            quantity: 0,
            status: "Active",
            images: [],
            main: 0,
            material: "",
            dimensions: "",
          },
    );
    setError("");
  };
  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || editing.description.trim().length < 10 || editing.images.length < 1) { setError("Add a product name, a description of at least 10 characters, and at least one image before saving."); return; }
    if (!(catalogTaxonomy[editing.category] ?? []).includes(editing.subcategory)) {
      setError("Choose a valid room category and product subcategory.");
      return;
    }
    const result = {
      ...editing,
      id:
        editing.id ||
        editing.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
      name: editing.name.trim(),
      description: editing.description.trim(),
      material: serializeMaterialSpecs(parseMaterialSpecs(editing.material)),
      dimensions: serializeDimensionSpecs(parseDimensionSpecs(editing.dimensions)),
    };
    const saveError = await saveProduct(result);
    if (saveError) { setError(saveError); return; }
    setItems((current) => current.some(i=>i.id===result.id) ? current.map(i=>i.id===result.id?result:i) : [result,...current]);
    setEditing(null); setNotice(result.name + (editing.id ? " updated." : " created."));
  };
  const upload = async (files: FileList | null) => {
    if (!files || !editing) return;
    const urls = await uploadProductImages(files);
    setEditing((current) => current ? { ...current, images:[...current.images,...urls].slice(0,8) } : current);
    if (!urls.length) setError("No images were uploaded. Use JPG, PNG, or WebP files up to 10 MB.");
  };
  const visible = items.filter(
    (item) =>
      (filter === "All categories" || item.category === filter) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const action = async (type: string, item: ManagedProduct) => {
    setMenu(null);
    if (type === "edit") showForm(item);
    if (type === "delete") { const issue = await deleteProduct(item.id); if (issue) setNotice(issue); else { setItems(current=>current.filter(i=>i.id!==item.id)); setNotice(item.name+" deleted."); } }
    if (type === "toggle") { const next = { ...item, status:(item.status==="Inactive"?"Active":"Inactive") as ManagedProduct["status"] }; const issue = await saveProduct(next); if (issue) setNotice(issue); else { setItems(current=>current.map(i=>i.id===item.id?next:i)); setNotice(item.name+" status updated."); } }
  };
  return (
    <AdminShell title="Products">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            CATALOG MANAGEMENT
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">
            Products
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create, maintain, and publish the pieces shown across CozyCraft.
          </p>
        </div>
        <button
          onClick={() => showForm()}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          <PackagePlus size={16} />
          Add product
        </button>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Published products"
          value={String(items.filter((i) => i.status === "Active").length)}
          note="Visible in the storefront"
        />
        <Metric
          label="Draft products"
          value={String(items.filter((i) => i.status === "Draft").length)}
          note="Ready to review"
        />
        <Metric
          label="Low-stock alerts"
          value={String(items.filter((i) => i.quantity < 6).length)}
          note="Requires attention"
        />
      </div>
      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_25px_rgba(33,31,29,.035)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-[#fcfbf8] px-3">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full bg-transparent text-sm outline-none"
              placeholder="Search product name"
            />
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs"
          >
            <option>All categories</option>
            <option>Living room</option>
            <option>Bedroom</option>
            <option>Dining room</option>
          </select>
          <div className="flex rounded-xl border border-border p-1">
            <button
              onClick={() => setView("list")}
              className={`grid h-8 w-8 place-items-center rounded-lg ${view === "list" ? "bg-secondary" : ""}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`grid h-8 w-8 place-items-center rounded-lg ${view === "grid" ? "bg-secondary" : ""}`}
            >
              <Grid2X2 size={16} />
            </button>
          </div>
        </div>
        {view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left">
              <thead className="bg-[#faf9f6] text-[10px] tracking-[.12em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">PRODUCT</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>STOCK</th>
                  <th>STATUS</th>
                  <th className="px-5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ResilientImage
                          src={item.images[item.main] || ""}
                          alt=""
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                        <div>
                          <b className="text-sm">{item.name}</b>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {item.subcategory}
                          </p>
                          <p className="mt-1 max-w-sm truncate text-[11px] text-muted-foreground">
                            {item.description || "No product description yet"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-xs">{item.category}</td>
                    <td className="py-3 text-xs">{money(item.price)}</td>
                    <td className="py-3 text-xs">{item.quantity} units</td>
                    <td className="py-3">
                      <Status>{item.status}</Status>
                    </td>
                    <td className="relative px-5 py-3">
                      <button
                        onClick={() =>
                          setMenu(menu === item.id ? null : item.id)
                        }
                        className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {menu === item.id && (
                        <ActionMenu item={item} action={action} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <article
                className="rounded-2xl border border-border p-3"
                key={item.id}
              >
                <div className="relative aspect-[1.25] overflow-hidden rounded-xl bg-secondary">
                  <ResilientImage
                    src={item.images[item.main] || ""}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => setMenu(menu === item.id ? null : item.id)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-card/95"
                  >
                    <MoreHorizontal size={17} />
                  </button>
                  {menu === item.id && (
                    <ActionMenu item={item} action={action} />
                  )}
                </div>
                <div className="mt-3 flex justify-between gap-2">
                  <div>
                    <b className="text-sm">{item.name}</b>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.category} · {item.subcategory}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {money(item.price)}
                    </p>
                  </div>
                  <Status>{item.status}</Status>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {item.quantity} units · {item.images.length} images
                </p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.description || "No product description yet"}
                </p>
              </article>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>{visible.length} products shown</span>
          <button
            onClick={() => setNotice("Product list refreshed.")}
            className="font-semibold text-foreground"
          >
            Refresh
          </button>
        </div>
      </section>
      {editing && (
        <ProductEditor
          product={editing}
          setProduct={setEditing}
          upload={upload}
          save={save}
          close={() => setEditing(null)}
          error={error}
        />
      )}{" "}
      {notice && <Toast message={notice} close={() => setNotice("")} />}
    </AdminShell>
  );
}

export function ActionMenu({
  item,
  action,
}: {
  item: ManagedProduct;
  action: (type: string, item: ManagedProduct) => void;
}) {
  return (
    <div className="absolute right-4 top-11 z-30 w-40 rounded-xl border border-border bg-card p-1.5 shadow-xl">
      <button
        onClick={() => action("edit", item)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-secondary"
      >
        <Pencil size={14} />
        Edit product
      </button>
      <button
        onClick={() => action("toggle", item)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-secondary"
      >
        <Archive size={14} />
        {item.status === "Inactive" ? "Activate" : "Deactivate"}
      </button>
      <button
        onClick={() => action("delete", item)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-secondary"
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
}

export function ProductEditor({
  product,
  setProduct,
  upload,
  save,
  close,
  error,
}: {
  product: ManagedProduct;
  setProduct: (p: ManagedProduct) => void;
  upload: (files: FileList | null) => void;
  save: () => void;
  close: () => void;
  error: string;
}) {
  const pick = (index: number) => setProduct({ ...product, main: index });
  const [materials, setMaterials] = useState<MaterialSpec[]>(() =>
    parseMaterialSpecs(product.material),
  );
  const [dimensions, setDimensions] = useState<DimensionSpec[]>(() =>
    parseDimensionSpecs(product.dimensions),
  );
  const commitMaterials = (next: MaterialSpec[]) => {
    setMaterials(next);
    setProduct({
      ...product,
      material: serializeMaterialSpecs(next),
    });
  };
  const updateMaterial = (index: number, patch: Partial<MaterialSpec>) =>
    commitMaterials(
      materials.map((material, itemIndex) =>
        itemIndex === index ? { ...material, ...patch } : material,
      ),
    );
  const addMaterial = () =>
    commitMaterials([...materials, { type: "", description: "" }]);
  const removeMaterial = (index: number) =>
    commitMaterials(materials.filter((_, itemIndex) => itemIndex !== index));
  const commitDimensions = (next: DimensionSpec[]) => {
    setDimensions(next);
    setProduct({
      ...product,
      dimensions: serializeDimensionSpecs(next),
    });
  };
  const updateDimension = (index: number, patch: Partial<DimensionSpec>) =>
    commitDimensions(
      dimensions.map((dimension, itemIndex) =>
        itemIndex === index ? { ...dimension, ...patch } : dimension,
      ),
    );
  const addDimension = () =>
    commitDimensions([
      ...dimensions,
      { label: "", value: "", unit: "cm" },
    ]);
  const removeDimension = (index: number) =>
    commitDimensions(dimensions.filter((_, itemIndex) => itemIndex !== index));
  const remove = (index: number) =>
    setProduct({
      ...product,
      images: product.images.filter((_, i) => i !== index),
      main: Math.max(0, Math.min(product.main, index - 1)),
    });
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-[#201f1d]/40 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-editor-title"
    >
      <div className="h-full w-full max-w-3xl overflow-y-auto rounded-3xl bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              CATALOG EDITOR
            </p>
            <h3 id="product-editor-title" className="mt-1 text-xl font-semibold">
              {product.id ? "Edit product" : "Add product"}
            </h3>
          </div>
          <button
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-xl hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Product name
              <input
                value={product.name}
                onChange={(e) =>
                  setProduct({ ...product, name: e.target.value })
                }
                className="h-11 rounded-xl border border-border px-3 font-normal"
                placeholder="e.g. Nara Lounge Chair"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Product description
              <textarea
                value={product.description}
                onChange={(event) =>
                  setProduct({ ...product, description: event.target.value })
                }
                rows={5}
                maxLength={2000}
                className="min-h-32 resize-y rounded-xl border border-border px-3 py-3 font-normal leading-6"
                placeholder="Describe the product's design, comfort, intended use, and distinctive qualities."
                aria-describedby="product-description-help"
              />
              <span
                id="product-description-help"
                className="flex justify-between gap-4 text-[10px] font-normal text-muted-foreground"
              >
                <span>Shown in the customer product-details page and updated in realtime.</span>
                <span>{product.description.length}/2000</span>
              </span>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Room category
              <select
                value={product.category}
                onChange={(e) => {
                  const category = e.target.value;
                  setProduct({
                    ...product,
                    category,
                    subcategory: catalogTaxonomy[category][0],
                  });
                }}
                className="h-11 rounded-xl border border-border bg-card px-3 font-normal"
              >
                <option>Living room</option>
                <option>Bedroom</option>
                <option>Dining room</option>
              </select>
              <span className="text-[10px] font-normal text-muted-foreground">
                {taxonomyGroups[product.category]?.join(" · ")}
              </span>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Product subcategory
              <select
                value={product.subcategory}
                onChange={(e) =>
                  setProduct({ ...product, subcategory: e.target.value })
                }
                className="h-11 rounded-xl border border-border bg-card px-3 font-normal"
              >
                {(catalogTaxonomy[product.category] ?? []).map((sub) => (
                  <option key={sub}>{sub}</option>
                ))}
              </select>
              <span className="text-[10px] font-normal text-muted-foreground">
                Matches the customer-facing collection filters
              </span>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Price (PHP)
              <input
                value={product.price || ""}
                onChange={(e) =>
                  setProduct({ ...product, price: Number(e.target.value) })
                }
                type="number"
                className="h-11 rounded-xl border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Stock quantity
              <input
                value={product.quantity || ""}
                onChange={(e) =>
                  setProduct({ ...product, quantity: Number(e.target.value) })
                }
                type="number"
                className="h-11 rounded-xl border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Publishing status
              <select
                value={product.status}
                onChange={(e) =>
                  setProduct({
                    ...product,
                    status: e.target.value as ManagedProduct["status"],
                  })
                }
                className="h-11 rounded-xl border border-border bg-card px-3 font-normal"
              >
                <option value="Active">Active — visible to customers</option>
                <option value="Draft">Draft — admin only</option>
                <option value="Inactive">Inactive — hidden from customers</option>
              </select>
              <span className="text-[10px] font-normal text-muted-foreground">
                New products default to Active and appear in the selected room
                collection immediately.
              </span>
            </label>
            <fieldset className="grid gap-3 text-sm font-semibold sm:col-span-2">
              <div className="flex items-center justify-between">
                <legend>Finish / Materials</legend>
                <button
                  type="button"
                  onClick={addMaterial}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  <Plus size={13} />
                  Add material
                </button>
              </div>
              <p className="text-[10px] font-normal text-muted-foreground">
                Add one material per bullet. Its type appears in bold beside its description.
              </p>
              <ul className="grid gap-2">
                {materials.map((material, index) => (
                  <li
                    key={index}
                    className="grid grid-cols-[12px_minmax(0,.75fr)_minmax(0,1.25fr)_36px] items-center gap-2"
                  >
                    <span className="text-center text-lg leading-none">•</span>
                    <input
                      value={material.type}
                      onChange={(event) => updateMaterial(index, { type: event.target.value })}
                      className="h-11 min-w-0 rounded-xl border border-border px-3 font-semibold"
                      placeholder="Material type"
                      aria-label={`Material type ${index + 1}`}
                    />
                    <input
                      value={material.description}
                      onChange={(event) => updateMaterial(index, { description: event.target.value })}
                      className="h-11 min-w-0 rounded-xl border border-border px-3 font-normal"
                      placeholder="e.g. Solid oak frame"
                      aria-label={`Material description ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeMaterial(index)}
                      disabled={materials.length === 1}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Remove material ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
            <fieldset className="grid gap-3 text-sm font-semibold sm:col-span-2">
              <div className="flex items-center justify-between">
                <legend>Dimensions</legend>
                <button
                  type="button"
                  onClick={addDimension}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  <Plus size={13} />
                  Add dimension
                </button>
              </div>
              <p className="text-[10px] font-normal text-muted-foreground">
                Add each measurement as a separate bullet. These appear as a
                list on the customer product page.
              </p>
              <ul className="grid gap-2">
                {dimensions.map((dimension, index) => (
                  <li
                    key={index}
                    className="grid grid-cols-[12px_minmax(0,1fr)_minmax(90px,.65fr)_90px_36px] items-center gap-2"
                  >
                    <span className="text-center text-lg leading-none">•</span>
                    <input
                      value={dimension.label}
                      onChange={(event) => updateDimension(index, { label: event.target.value })}
                      className="h-11 min-w-0 rounded-xl border border-border px-3 font-semibold"
                      placeholder={index === 0 ? "Width" : "Seat height"}
                      aria-label={`Measurement name ${index + 1}`}
                    />
                    <input
                      value={dimension.value}
                      onChange={(event) => updateDimension(index, { value: event.target.value })}
                      className="h-11 min-w-0 rounded-xl border border-border px-3 font-normal"
                      placeholder="120"
                      inputMode="decimal"
                      aria-label={`Measurement value ${index + 1}`}
                    />
                    <select
                      value={dimension.unit}
                      onChange={(event) => updateDimension(index, { unit: event.target.value })}
                      className="h-11 rounded-xl border border-border bg-card px-2 font-normal"
                      aria-label={`Measurement unit ${index + 1}`}
                    >
                      <option value="">Unit</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="in">in</option>
                      <option value="ft">ft</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeDimension(index)}
                      disabled={dimensions.length === 1}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Remove dimension ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
          <div className="mt-7">
            <div className="flex items-end justify-between">
              <div>
                <h4 className="font-semibold">Product images</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload at least 4 photos. Select one as the main storefront
                  view.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold">
                <Upload size={14} />
                Add photos
                <input
                  onChange={(e) => upload(e.target.files)}
                  multiple
                  accept="image/*"
                  type="file"
                  className="hidden"
                />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {product.images.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 ${product.main === index ? "border-foreground" : "border-transparent"}`}
                >
                  <ResilientImage
                    src={image}
                    alt={`Product upload ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => pick(index)}
                    className="absolute bottom-1 left-1 rounded-md bg-card/95 px-2 py-1 text-[9px] font-bold"
                  >
                    {product.main === index ? "MAIN" : "Set main"}
                  </button>
                  <button
                    onClick={() => remove(index)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-[#201f1d]/80 text-white"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-secondary text-center text-xs text-muted-foreground">
                <ImagePlus size={18} />
                <span className="px-2">
                  Add image
                  <input
                    onChange={(e) => upload(e.target.files)}
                    multiple
                    accept="image/*"
                    type="file"
                    className="hidden"
                  />
                </span>
              </label>
            </div>
            <p
              className={`mt-3 text-xs ${product.images.length >= 4 ? "text-[#5b744f]" : "text-[#9a6047]"}`}
            >
              {product.images.length}/4 minimum images uploaded
            </p>
          </div>
          {error && (
            <p className="mt-5 rounded-xl bg-[#f4e4de] px-4 py-3 text-sm text-[#984f3d]">
              {error}
            </p>
          )}
          <div className="mt-7 flex justify-end gap-3 border-t border-border pt-5">
            <button
              onClick={close}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
            >
              {product.id ? "Save changes" : "Create product"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function InventoryPage() {
  const { adminProducts } = useStore();
  const [notice, setNotice] = useState("");
  const [adjustment, setAdjustment] = useState<{item:ManagedProduct;delta:number}|null>(null);
  const [reason, setReason] = useState("");
  const [movements, setMovements] = useState<Array<{id:number;product_id:string;previous_quantity:number;new_quantity:number;quantity_delta:number;reason:string;created_at:string}>>([]);
  const items = adminProducts.map((p): ManagedProduct => ({ id:p.id,name:p.name,description:p.description,category:p.category,subcategory:p.subcategory??subcategoryFor(p.id),price:p.price,quantity:p.stockQuantity??0,status:p.status==="draft"?"Draft":p.status==="inactive"?"Inactive":"Active",images:p.images,main:p.mainImageIndex??0,material:p.material??"",dimensions:p.dimensions }));
  const low = items.filter(item=>item.quantity<=8);
  const loadMovements = useCallback(async () => { const {data}=await supabase.from("inventory_movements").select("id,product_id,previous_quantity,new_quantity,quantity_delta,reason,created_at").order("created_at",{ascending:false}).limit(12); setMovements((data??[]) as typeof movements); },[]);
  useEffect(()=>{ void loadMovements(); const channel=supabase.channel("admin-inventory-ledger").on("postgres_changes",{event:"*",schema:"public",table:"inventory_movements"},()=>void loadMovements()).subscribe(); return()=>{void supabase.removeChannel(channel);}; },[loadMovements]);
  const adjust = async () => { if(!adjustment||reason.trim().length<3){setNotice("Add a short reason for this stock adjustment.");return;} const {error}=await supabase.rpc("adjust_product_inventory",{p_product_id:adjustment.item.id,p_delta:adjustment.delta,p_reason:reason.trim()}); if(error){setNotice(error.message);return;} setNotice(adjustment.item.name+" stock updated and recorded."); setAdjustment(null); setReason(""); await loadMovements(); };
  return <AdminShell title="Inventory"><div className="flex justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">LIVE STOCK CONTROL</p><h2 className="mt-2 text-3xl font-semibold">Inventory board</h2><p className="mt-2 text-sm text-muted-foreground">Every adjustment updates the customer storefront immediately and is recorded below.</p></div></div><div className="mt-7 grid gap-4 lg:grid-cols-[1fr_.8fr]"><section className="rounded-2xl bg-[#282522] p-6 text-white"><p className="text-[10px] font-bold tracking-[.16em] text-[#d8c7b0]">REORDER FOCUS</p><p className="mt-4 font-serif text-4xl">{low.length} pieces need attention.</p><p className="mt-3 text-sm text-white/65">Products at eight units or below are marked low stock in the shop.</p></section><section className="rounded-2xl border border-border bg-card p-6"><p className="text-xs text-muted-foreground">WAREHOUSE TOTAL</p><p className="mt-4 text-4xl font-semibold">{items.reduce((sum,item)=>sum+item.quantity,0)}</p><p className="mt-2 text-sm text-muted-foreground">units across {items.length} products</p></section></div><section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><b>Live stock adjustments</b></div>{items.map(item=><div key={item.id} className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm">{item.name}</b><p className="mt-1 text-xs text-muted-foreground">{item.category} · {item.id}</p></div><div className="flex items-center gap-4"><Status>{item.quantity===0?"Out of stock":item.quantity<=8?"Low stock":"Active"}</Status><div className="flex h-9 items-center rounded-xl border border-border"><button aria-label={`Decrease ${item.name} stock`} onClick={()=>setAdjustment({item,delta:-1})} disabled={item.quantity===0} className="grid h-full w-9 place-items-center disabled:opacity-30"><Minus size={14}/></button><span className="w-9 text-center text-sm font-semibold">{item.quantity}</span><button aria-label={`Increase ${item.name} stock`} onClick={()=>setAdjustment({item,delta:1})} className="grid h-full w-9 place-items-center"><Plus size={14}/></button></div></div></div>)}</section><section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><b>Recent inventory activity</b><p className="mt-1 text-xs text-muted-foreground">A traceable ledger of manual, checkout, cancellation, and refund stock changes.</p></div>{movements.length===0?<p className="p-5 text-sm text-muted-foreground">No stock movements recorded yet.</p>:movements.map(move=><div key={move.id} className="grid gap-2 border-b border-border px-5 py-4 text-sm sm:grid-cols-[1fr_auto_auto]"><div><b>{items.find(item=>item.id===move.product_id)?.name??move.product_id}</b><p className="mt-1 text-xs text-muted-foreground">{move.reason}</p></div><b className={move.quantity_delta>0?"text-emerald-700":"text-amber-700"}>{move.quantity_delta>0?"+":""}{move.quantity_delta} units</b><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(move.created_at))}</time></div>)}</section>{adjustment&&<div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="stock-adjust-title"><div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"><h3 id="stock-adjust-title" className="text-xl font-semibold">{adjustment.delta>0?"Add":"Remove"} one unit</h3><p className="mt-2 text-sm text-muted-foreground">{adjustment.item.name} · Current stock {adjustment.item.quantity}</p><label className="mt-5 block text-sm font-semibold" htmlFor="inventory-reason">Reason</label><input id="inventory-reason" autoFocus value={reason} onChange={event=>setReason(event.target.value)} placeholder="e.g. Physical stock count" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"/><div className="mt-5 flex justify-end gap-3"><button onClick={()=>{setAdjustment(null);setReason("");}} className="rounded-xl border border-border px-4 py-2.5 font-semibold">Cancel</button><button onClick={()=>void adjust()} className="rounded-xl bg-foreground px-4 py-2.5 font-semibold text-background">Confirm adjustment</button></div></div></div>}{notice&&<Toast message={notice} close={()=>setNotice("")}/>}</AdminShell>;
}

export function CategoriesPage() {
  const { adminProducts: products } = useStore();
  const [categories, setCategories] = useState([
    {
      id: 1,
      slug: "living-room",
      sortOrder: 1,
      name: "Living room",
      code: "01",
      description:
        "Anchor pieces for gathering, resting, and everyday rituals.",
      image: products[0].images[0],
      count: 18,
      featured: true,
      live: true,
      subs: [
        { name: "Sofas", count: 7, live: true },
        { name: "Coffee tables", count: 5, live: true },
        { name: "TV stands", count: 6, live: true },
      ],
    },
    {
      id: 2,
      slug: "bedroom",
      sortOrder: 2,
      name: "Bedroom",
      code: "02",
      description:
        "Restful furniture designed around the quietest room at home.",
      image: products[3].images[0],
      count: 15,
      featured: false,
      live: true,
      subs: [
        { name: "Beds", count: 6, live: true },
        { name: "Wardrobes", count: 4, live: true },
        { name: "Nightstands", count: 5, live: true },
      ],
    },
    {
      id: 3,
      slug: "dining-room",
      sortOrder: 3,
      name: "Dining room",
      code: "03",
      description:
        "Pieces that make space for long meals and easy conversation.",
      image: products[2].images[0],
      count: 12,
      featured: true,
      live: true,
      subs: [
        { name: "Dining tables", count: 4, live: true },
        { name: "Dining chairs", count: 5, live: true },
        { name: "Storage", count: 3, live: false },
      ],
    },
  ]);
  const [active, setActive] = useState("Living room");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,slug,sort_order,active")
      .order("sort_order");
    if (error) {
      setNotice(error.message);
      return;
    }
    const rows = data ?? [];
    setCategories(
      rows.map((row, index) => {
        const categoryProducts = products.filter(
          (product) => product.category === row.name,
        );
        const subcategoryNames = Array.from(
          new Set(
            categoryProducts
              .map((product) => product.subcategory)
              .filter((name): name is string => Boolean(name)),
          ),
        );
        return {
          id: row.id,
          slug: row.slug,
          sortOrder: row.sort_order,
          name: row.name,
          code: String(index + 1).padStart(2, "0"),
          description: `${row.name} products available in the customer storefront.`,
          image:
            categoryProducts[0]?.images[0] ??
            products[0]?.images[0] ??
            "",
          count: categoryProducts.length,
          featured: row.active,
          live: row.active,
          subs: subcategoryNames.map((name) => ({
            name,
            count: categoryProducts.filter(
              (product) => product.subcategory === name,
            ).length,
            live: categoryProducts.some(
              (product) =>
                product.subcategory === name && product.status === "active",
            ),
          })),
        };
      }),
    );
  }, [products]);
  useEffect(() => {
    void loadCategories();
    const channel = supabase
      .channel("admin-categories")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => void loadCategories(),
      )
      .subscribe();
    const interval = window.setInterval(() => void loadCategories(), 10_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadCategories]);
  const selected =
    categories.find((category) => category.name === active) ?? categories[0];
  const mutate = (fn: (category: any) => any) =>
    setCategories((items) =>
      items.map((category) =>
        category.name === active ? fn(category) : category,
      ),
    );
  const toggleSub = async (name: string) => {
    const sub = selected.subs.find((item) => item.name === name);
    const { error } = await supabase
      .from("products")
      .update({ status: sub?.live ? "inactive" : "active" })
      .eq("category", selected.name)
      .eq("subcategory", name);
    if (error) {
      setNotice(error.message);
      return;
    }
    mutate((category) => ({
      ...category,
      subs: category.subs.map((sub: any) =>
        sub.name === name ? { ...sub, live: !sub.live } : sub,
      ),
    }));
    setNotice(`${name} visibility updated in the customer storefront.`);
  };
  const addSub = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setNotice(
      `Create or edit a product with “${draft.trim()}” as its subcategory and it will appear here automatically.`,
    );
    setDraft("");
  };
  return (
    <AdminShell title="Categories">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[.17em] text-muted-foreground">
            CATALOG ARCHITECTURE
          </p>
          <h2 className="mt-2 font-serif text-4xl leading-none">Categories</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            Shape the way customers discover the collection, from room-level
            narratives to the smallest browse path.
          </p>
        </div>
        <button
          onClick={async () => {
            const name = window.prompt("New category name");
            if (!name?.trim()) return;
            const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const { error } = await supabase.from("categories").insert({
              name: name.trim(),
              slug,
              sort_order: categories.length + 1,
              active: true,
            });
            setNotice(error?.message ?? `${name.trim()} saved to Supabase.`);
            if (!error) await loadCategories();
          }}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          + New category
        </button>
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-border bg-[#242522] p-2 shadow-sm">
          <div className="px-4 py-4 text-[#f5f0e8]">
            <p className="text-[10px] font-bold tracking-[.16em] text-[#bfb7aa]">
              COLLECTION MAP
            </p>
            <p className="mt-2 text-sm text-[#d8d1c6]">
              {categories.reduce(
                (total, category) => total + category.count,
                0,
              )}{" "}
              products across {categories.length} rooms
            </p>
          </div>
          <div className="grid gap-2">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setActive(category.name)}
                className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selected.name === category.name ? "bg-[#f5f0e8] text-foreground" : "text-[#f5f0e8] hover:bg-white/10"}`}
              >
                <ResilientImage
                  src={category.image}
                  alt={category.name}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between">
                    <b className="text-sm">{category.name}</b>
                    <span className="font-mono text-[10px] opacity-60">
                      {category.code}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs opacity-65">
                    {category.count} products · {category.subs.length} groups
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setNotice("Catalog sequence saved.")}
            className="m-2 flex w-[calc(100%-16px)] items-center justify-between rounded-xl border border-white/15 px-4 py-3 text-xs font-semibold text-[#f5f0e8] hover:bg-white/10"
          >
            Reorder collection map <ArrowRight size={14} />
          </button>
        </section>
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="relative h-44 overflow-hidden">
            <ResilientImage
              src={selected.image}
              alt={selected.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex items-end p-5 text-white">
              <div>
                <p className="font-mono text-[10px] tracking-[.16em] opacity-80">
                  CATEGORY {selected.code}
                </p>
                <h3 className="mt-1 font-serif text-3xl">{selected.name}</h3>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                {selected.description}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    void supabase
                      .from("categories")
                      .update({ active: !selected.live })
                      .eq("id", selected.id)
                      .then(async ({ error }) => {
                        setNotice(
                          error?.message ??
                            `${selected.name} is now ${selected.live ? "hidden from" : "visible in"} the storefront.`,
                        );
                        if (!error) await loadCategories();
                      });
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${selected.featured ? "bg-[#e9dfd1] text-foreground" : "border border-border"}`}
                >
                  {selected.live ? "● Storefront live" : "○ Hidden"}
                </button>
                <button
                  onClick={() => setNotice("Rename categories by creating the corrected category and reassigning its products.")}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                >
                  Edit category
                </button>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-[#faf9f6] text-center">
              <div className="p-3">
                <p className="font-serif text-2xl">{selected.count}</p>
                <p className="mt-1 text-[10px] font-bold tracking-[.1em] text-muted-foreground">
                  PRODUCTS
                </p>
              </div>
              <div className="p-3">
                <p className="font-serif text-2xl">{selected.subs.length}</p>
                <p className="mt-1 text-[10px] font-bold tracking-[.1em] text-muted-foreground">
                  SUBCATEGORIES
                </p>
              </div>
              <div className="p-3">
                <p className="font-serif text-2xl">
                  {selected.subs.filter((sub: any) => sub.live).length}
                </p>
                <p className="mt-1 text-[10px] font-bold tracking-[.1em] text-muted-foreground">
                  LIVE NOW
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              BROWSE PATHS
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {selected.name} subcategories
            </h3>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
            Live changes appear in the storefront
          </span>
        </div>
        <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {selected.subs.map((sub: any, index: number) => (
            <article key={sub.name} className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <button
                  onClick={() => toggleSub(sub.name)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sub.live ? "bg-[#e3ecdf] text-[#56714f]" : "bg-secondary text-muted-foreground"}`}
                >
                  {sub.live ? "LIVE" : "HIDDEN"}
                </button>
              </div>
              <h4 className="mt-6 text-base font-semibold">{sub.name}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {sub.count} assigned products
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() =>
                    setNotice(`${sub.name} filter preview opened.`)
                  }
                  className="text-xs font-semibold underline underline-offset-4"
                >
                  Preview
                </button>
                <button
                  onClick={() => setNotice(`${sub.name} renamed.`)}
                  className="text-xs text-muted-foreground"
                >
                  Rename
                </button>
              </div>
            </article>
          ))}
        </div>
        <form
          onSubmit={addSub}
          className="flex flex-col gap-3 border-t border-border bg-[#f3f0ea] p-4 sm:flex-row"
        >
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
            <Tag size={15} className="text-muted-foreground" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-10 w-full bg-transparent text-sm outline-none"
              placeholder={`Add a new ${selected.name.toLowerCase()} subcategory`}
            />
          </label>
          <button className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background">
            Add subcategory
          </button>
        </form>
      </section>
      {notice && <Toast message={notice} close={() => setNotice("")} />}
    </AdminShell>
  );
}
