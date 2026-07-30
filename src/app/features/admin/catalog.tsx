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
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
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
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
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
  const toManaged = (p: Product): ManagedProduct => ({ id:p.id, name:p.name, category:p.category, subcategory:p.subcategory ?? subcategoryFor(p.id), price:p.price, quantity:p.stockQuantity ?? 0, status:p.status === "draft" ? "Draft" : p.status === "inactive" ? "Inactive" : "Active", images:[...p.images], main:p.mainImageIndex ?? 0, material:p.material ?? materialFor(p.id), dimensions:p.dimensions });
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
    if (!editing.name || editing.images.length < 1) { setError("Add a product name and at least one image before saving."); return; }
    if (!(catalogTaxonomy[editing.category] ?? []).includes(editing.subcategory)) {
      setError("Choose a valid room category and product subcategory.");
      return;
    }
    const result = {
      ...editing,
      id:
        editing.id ||
        editing.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
      dimensions: editing.dimensions
        .split("\n")
        .map((dimension) => dimension.replace(/^[•\-]\s*/, "").trim())
        .filter(Boolean)
        .join("\n"),
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
      item.name.toLowerCase().includes(query.toLowerCase()),
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
                        <ImageWithFallback
                          src={item.images[item.main] || ""}
                          alt=""
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                        <div>
                          <b className="text-sm">{item.name}</b>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {item.subcategory}
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
                  <ImageWithFallback
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
  const dimensions = product.dimensions.split("\n");
  const updateDimension = (index: number, value: string) =>
    setProduct({
      ...product,
      dimensions: dimensions
        .map((dimension, itemIndex) =>
          itemIndex === index ? value : dimension,
        )
        .join("\n"),
    });
  const addDimension = () =>
    setProduct({
      ...product,
      dimensions: [...dimensions, ""].join("\n"),
    });
  const removeDimension = (index: number) =>
    setProduct({
      ...product,
      dimensions: dimensions.filter((_, itemIndex) => itemIndex !== index).join("\n"),
    });
  const remove = (index: number) =>
    setProduct({
      ...product,
      images: product.images.filter((_, i) => i !== index),
      main: Math.max(0, Math.min(product.main, index - 1)),
    });
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-[#201f1d]/40 p-3 sm:p-5">
      <div className="h-full w-full max-w-3xl overflow-y-auto rounded-3xl bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-5">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              CATALOG EDITOR
            </p>
            <h3 className="mt-1 text-xl font-semibold">
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
        <div className="p-6">
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
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Finish / Material
              <input
                value={product.material}
                onChange={(e) =>
                  setProduct({ ...product, material: e.target.value })
                }
                className="h-11 rounded-xl border border-border px-3 font-normal"
                placeholder="Oak veneer · linen blend"
              />
            </label>
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
                    className="grid grid-cols-[12px_1fr_36px] items-center gap-2"
                  >
                    <span className="text-center text-lg leading-none">•</span>
                    <input
                      value={dimension}
                      onChange={(event) =>
                        updateDimension(index, event.target.value)
                      }
                      className="h-11 rounded-xl border border-border px-3 font-normal"
                      placeholder={
                        index === 0
                          ? "Overall: 120W × 80D × 75H cm"
                          : "Seat height: 46 cm"
                      }
                    />
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
                  <ImageWithFallback
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
    </div>
  );
}

export function InventoryPage() {
  const { adminProducts, saveProduct } = useStore();
  const [notice, setNotice] = useState("");
  const items = adminProducts.map((p): ManagedProduct => ({ id:p.id,name:p.name,category:p.category,subcategory:p.subcategory??subcategoryFor(p.id),price:p.price,quantity:p.stockQuantity??0,status:p.status==="draft"?"Draft":p.status==="inactive"?"Inactive":"Active",images:p.images,main:p.mainImageIndex??0,material:p.material??"",dimensions:p.dimensions }));
  const low = items.filter(item=>item.quantity<=8);
  const adjust = async (item: ManagedProduct, delta: number) => { const issue=await saveProduct({...item,quantity:Math.max(0,item.quantity+delta)}); setNotice(issue??(item.name+" stock updated.")); };
  return <AdminShell title="Inventory"><div className="flex justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">LIVE STOCK CONTROL</p><h2 className="mt-2 text-3xl font-semibold">Inventory board</h2><p className="mt-2 text-sm text-muted-foreground">Every adjustment updates the customer storefront immediately.</p></div></div><div className="mt-7 grid gap-4 lg:grid-cols-[1fr_.8fr]"><section className="rounded-2xl bg-[#282522] p-6 text-white"><p className="text-[10px] font-bold tracking-[.16em] text-[#d8c7b0]">REORDER FOCUS</p><p className="mt-4 font-serif text-4xl">{low.length} pieces need attention.</p><p className="mt-3 text-sm text-white/65">Products at eight units or below are marked low stock in the shop.</p></section><section className="rounded-2xl border border-border bg-card p-6"><p className="text-xs text-muted-foreground">WAREHOUSE TOTAL</p><p className="mt-4 text-4xl font-semibold">{items.reduce((sum,item)=>sum+item.quantity,0)}</p><p className="mt-2 text-sm text-muted-foreground">units across {items.length} products</p></section></div><section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><b>Live stock adjustments</b></div>{items.map(item=><div key={item.id} className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm">{item.name}</b><p className="mt-1 text-xs text-muted-foreground">{item.category} · {item.id}</p></div><div className="flex items-center gap-4"><Status>{item.quantity===0?"Out of stock":item.quantity<=8?"Low stock":"Active"}</Status><div className="flex h-9 items-center rounded-xl border border-border"><button onClick={()=>void adjust(item,-1)} className="grid h-full w-9 place-items-center"><Minus size={14}/></button><span className="w-9 text-center text-sm font-semibold">{item.quantity}</span><button onClick={()=>void adjust(item,1)} className="grid h-full w-9 place-items-center"><Plus size={14}/></button></div></div></div>)}</section>{notice&&<Toast message={notice} close={()=>setNotice("")}/>}</AdminShell>;
}

export function CategoriesPage() {
  const { products } = useStore();
  const [categories, setCategories] = useState([
    {
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
  const selected =
    categories.find((category) => category.name === active) ?? categories[0];
  const mutate = (fn: (category: any) => any) =>
    setCategories((items) =>
      items.map((category) =>
        category.name === active ? fn(category) : category,
      ),
    );
  const toggleSub = (name: string) =>
    mutate((category) => ({
      ...category,
      subs: category.subs.map((sub: any) =>
        sub.name === name ? { ...sub, live: !sub.live } : sub,
      ),
    }));
  const addSub = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    mutate((category) => ({
      ...category,
      subs: [...category.subs, { name: draft.trim(), count: 0, live: true }],
    }));
    setNotice(`${draft.trim()} added to ${active}.`);
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
          onClick={() => setNotice("New category draft created.")}
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
                <ImageWithFallback
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
            <ImageWithFallback
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
                    mutate((category) => ({
                      ...category,
                      featured: !category.featured,
                    }));
                    setNotice(
                      `${selected.name} ${selected.featured ? "removed from" : "added to"} featured collections.`,
                    );
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${selected.featured ? "bg-[#e9dfd1] text-foreground" : "border border-border"}`}
                >
                  {selected.featured ? "★ Featured" : "☆ Feature on home"}
                </button>
                <button
                  onClick={() => setNotice(`${selected.name} editor opened.`)}
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
