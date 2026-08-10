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
  Clock,
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
import { ResilientImage } from "@/components/media/ResilientImage";
import cozyCraftLogo from "@/assets/branding/cozycraft-logo.png";
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
} from "@/services/supabase/client";
import { optimizeImageUpload } from "@/lib/shared/image-upload";

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
} from "@/app/core";

import { Account } from "@/app/features/storefront/authentication/CustomerAuth";
import { isCancellationWindowOpen, isReturnWindowOpen } from "@/lib/commerce/return-workflow";

type PsgcRegion = {
  regCode: string;
  regionName: string;
};

type PsgcProvince = {
  regCode: string;
  provCode: string;
  provName: string;
  cityClass: string | null;
};

type PsgcMunicipality = {
  regCode: string;
  provCode: string;
  munCityCode: string;
  munCityName: string;
};

type OrderReviewTarget = {
  orderNumber: string;
  item: DbOrder["order_items"][number];
};

type ReviewPhotoDraft = {
  file: File;
  preview: string;
};

type PsgcBarangay = {
  munCityCode: string;
  brgyCode: string;
  brgyName: string;
};

const regionDisplayName = (region: PsgcRegion) =>
  region.regCode === "13"
    ? "Metro Manila (National Capital Region — NCR)"
    : region.regionName;

export function AddressManager({ notify }: { notify: (message: string) => void }) {
  const {
    addresses,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    user,
    userId,
    userEmail,
    products,
  } = useStore();
  const blank: Address = {
    id: "",
    label: "Home",
    name: user ?? "",
    mobile: "",
    email: userEmail ?? "",
    line: "",
    barangay: "",
    city: "",
    province: "",
    postal: "",
    note: "",
    primary: addresses.length === 0,
  };
  const [draft, setDraft] = useState<Address | null>(null);
  const [provinceCode, setProvinceCode] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [barangays, setBarangays] = useState<PsgcBarangay[]>([]);
  const [regions, setRegions] = useState<PsgcRegion[]>([]);
  const [provinces, setProvinces] = useState<PsgcProvince[]>([]);
  const [municipalities, setMunicipalities] = useState<PsgcMunicipality[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [barangaysLoading, setBarangaysLoading] = useState(false);
  const regionOptions = useMemo(
    () =>
      [...regions].sort((a, b) =>
        a.regionName.localeCompare(b.regionName),
      ),
    [regions],
  );
  const provinceOptions = useMemo(
    () =>
      provinces
        .filter((item) => !item.cityClass)
        .sort((a, b) => a.provName.localeCompare(b.provName)),
    [provinces],
  );
  const municipalityOptions = useMemo(
    () => {
      const [kind, code] = provinceCode.split(":");
      return municipalities
        .filter((item) =>
          kind === "region"
            ? item.regCode === code
            : kind === "province"
              ? item.provCode === code
              : false,
        )
        .sort((a, b) => a.munCityName.localeCompare(b.munCityName));
    },
    [municipalities, provinceCode],
  );
  const barangayOptions = useMemo(
    () =>
      barangays
        .filter((item) => item.munCityCode === municipalityCode)
        .sort((a, b) => a.brgyName.localeCompare(b.brgyName)),
    [barangays, municipalityCode],
  );
  useEffect(() => {
    let active = true;
    setLocationsLoading(true);
    void supabase.functions.invoke("philippine-barangays", { body: { scope: "locations" } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || data?.error) {
          notify(data?.error ?? error?.message ?? "Unable to load Philippine locations.");
          return;
        }
        setRegions((data?.regions ?? []) as PsgcRegion[]);
        setProvinces((data?.provinces ?? []) as PsgcProvince[]);
        setMunicipalities((data?.municipalities ?? []) as PsgcMunicipality[]);
      })
      .finally(() => {
        if (active) setLocationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!municipalityCode) {
      setBarangays([]);
      return;
    }
    let active = true;
    setBarangaysLoading(true);
    setBarangays([]);
    void supabase.functions.invoke("philippine-barangays", { body: { municipalityCode } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || data?.error) {
          notify(data?.error ?? error?.message ?? "Unable to load barangays.");
          return;
        }
        setBarangays((data?.barangays ?? []) as PsgcBarangay[]);
      })
      .finally(() => {
        if (active) setBarangaysLoading(false);
      });
    return () => {
      active = false;
    };
  }, [municipalityCode]);
  const openEditor = (address: Address) => {
    const matchedProvince = provinceOptions.find(
      (item) => item.provName === address.province,
    );
    const matchedRegion = regionOptions.find(
      (item) =>
        item.regionName === address.province ||
        regionDisplayName(item) === address.province,
    );
    const cityMatch = municipalities.find(
      (item) =>
        item.munCityName.trim() === address.city.trim() &&
        (!matchedProvince || item.provCode === matchedProvince.provCode) &&
        (!matchedRegion || item.regCode === matchedRegion.regCode),
    );
    const inferredProvince = cityMatch
      ? provinceOptions.find((item) => item.provCode === cityMatch.provCode)
      : undefined;
    const inferredRegion = cityMatch
      ? regionOptions.find((item) => item.regCode === cityMatch.regCode)
      : undefined;
    const selectorValue = matchedProvince
      ? `province:${matchedProvince.provCode}`
      : matchedRegion
        ? `region:${matchedRegion.regCode}`
        : inferredProvince
          ? `province:${inferredProvince.provCode}`
          : inferredRegion
            ? `region:${inferredRegion.regCode}`
            : "";
    const locationName =
      matchedProvince?.provName ??
      (matchedRegion ? regionDisplayName(matchedRegion) : undefined) ??
      inferredProvince?.provName ??
      (inferredRegion ? regionDisplayName(inferredRegion) : undefined) ??
      address.province;
    setProvinceCode(selectorValue);
    setMunicipalityCode(cityMatch?.munCityCode ?? "");
    setDraft({
      ...address,
      province: locationName,
      email: userEmail ?? address.email,
    });
  };
  const closeEditor = () => {
    setDraft(null);
    setProvinceCode("");
    setMunicipalityCode("");
  };
  const update = (key: keyof Address, value: string | boolean) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const error = await saveAddress({
      ...draft,
      email: userEmail ?? "",
      id: draft.id || String(Date.now()),
    });
    if (error) {
      notify(error);
      return;
    }
    closeEditor();
    notify("Delivery address saved.");
  };
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            SAVED DELIVERY DETAILS
          </p>
          <h2 className="mt-2 font-serif text-3xl">Your addresses.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep your delivery details accurate for a smooth arrival.
          </p>
        </div>
        <button
          onClick={() => openEditor(blank)}
          className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background"
        >
          + Add new address
        </button>
      </div>
      <div className="mt-6 grid gap-3">
        {addresses.map((address) => (
          <article
            key={address.id}
            className="rounded-2xl border border-border p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <b className="text-sm">{address.label}</b>
                {address.primary && (
                  <span className="rounded-full bg-[#e3ecdf] px-2 py-1 text-[10px] font-bold text-[#56714f]">
                    DEFAULT
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <button
                  onClick={() => openEditor(address)}
                  className="underline underline-offset-4"
                >
                  Edit
                </button>
                {!address.primary && (
                  <button
                    onClick={() => {
                      setDefaultAddress(address.id);
                      notify("Default address updated.");
                    }}
                    className="underline underline-offset-4"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => {
                    if (addresses.length > 1) {
                      deleteAddress(address.id);
                      notify("Address removed.");
                    }
                  }}
                  className="text-muted-foreground"
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold">
              {address.name} · {address.mobile}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {address.line}, {address.barangay}
              <br />
              {address.city}, {address.province} {address.postal}
            </p>
            {address.note && (
              <p className="mt-2 text-xs text-muted-foreground">
                Delivery note: {address.note}
              </p>
            )}
          </article>
        ))}
      </div>
      {draft && (
        <form
          onSubmit={submit}
          className="mt-5 rounded-2xl border border-border bg-secondary p-5"
        >
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">
                {draft.id ? "EDIT ADDRESS" : "NEW DELIVERY ADDRESS"}
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                Complete delivery details
              </h3>
            </div>
            <button type="button" onClick={closeEditor}>
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              value={draft.label}
              onChange={(event) => update("label", event.target.value)}
              required
              placeholder="Address label (e.g. Home)"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none"
            />
            <input
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              required
              placeholder="Recipient full name"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none"
            />
            <input
              value={draft.mobile}
              onChange={(event) => update("mobile", event.target.value)}
              required
              inputMode="tel"
              placeholder="Mobile number"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none sm:col-span-2"
            />
            <input
              value={draft.line}
              onChange={(event) => update("line", event.target.value)}
              required
              placeholder="House / unit / building / street"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none sm:col-span-2"
            />
            <select
              value={provinceCode}
              onChange={(event) => {
                const selectorValue = event.target.value;
                const [kind, code] = selectorValue.split(":");
                const selectedName =
                  kind === "region"
                    ? (() => {
                        const selectedRegion = regionOptions.find(
                          (item) => item.regCode === code,
                        );
                        return selectedRegion
                          ? regionDisplayName(selectedRegion)
                          : undefined;
                      })()
                    : provinceOptions.find((item) => item.provCode === code)
                        ?.provName;
                setProvinceCode(selectorValue);
                setMunicipalityCode("");
                update("province", selectedName ?? "");
                update("city", "");
                update("barangay", "");
              }}
              required
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none"
            >
              <option value="">
                {locationsLoading ? "Loading locations…" : "Select province / region"}
              </option>
              <optgroup label="Regions">
                {regionOptions.map((item) => (
                  <option
                    key={`region-${item.regCode}`}
                    value={`region:${item.regCode}`}
                  >
                    {regionDisplayName(item)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Provinces">
                {provinceOptions.map((item) => (
                  <option
                    key={`province-${item.provCode}`}
                    value={`province:${item.provCode}`}
                  >
                    {item.provName}
                  </option>
                ))}
              </optgroup>
            </select>
            <select
              value={municipalityCode}
              onChange={(event) => {
                const code = event.target.value;
                const selected = municipalityOptions.find(
                  (item) => item.munCityCode === code,
                );
                setMunicipalityCode(code);
                update("city", selected?.munCityName ?? "");
                update("barangay", "");
              }}
              required
              disabled={!provinceCode}
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {provinceCode
                  ? "Select city / municipality"
                  : "Select province / region first"}
              </option>
              {municipalityOptions.map((item) => (
                <option key={item.munCityCode} value={item.munCityCode}>
                  {item.munCityName}
                </option>
              ))}
            </select>
            <select
              value={draft.barangay}
              onChange={(event) => update("barangay", event.target.value)}
              required
              disabled={!municipalityCode || barangaysLoading}
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {barangaysLoading
                  ? "Loading barangays…"
                  : municipalityCode
                    ? "Select barangay"
                    : "Select city / municipality first"}
              </option>
              {barangayOptions.map((item) => (
                <option key={item.brgyCode} value={item.brgyName.trim()}>
                  {item.brgyName.trim()}
                </option>
              ))}
            </select>
            <input
              value={draft.postal}
              onChange={(event) => update("postal", event.target.value)}
              required
              inputMode="numeric"
              placeholder="Postal code"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none"
            />
          </div>
          <textarea
            value={draft.note}
            onChange={(e) => update("note", e.target.value)}
            className="mt-3 min-h-20 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none"
            placeholder="Delivery instructions (optional)"
          />
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={draft.primary}
              onChange={(e) => update("primary", e.target.checked)}
              className="accent-foreground"
            />
            Use as default delivery address
          </label>
          <div className="mt-5 flex gap-2">
            <button className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">
              Save address
            </button>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export function Profile() {
  const {
    userId,
    user,
    role,
    authReady,
    userEmail,
    profilePhone,
    profileUsername,
    profileGender,
    profileBirth,
    profilePaymentMethod,
    hasPassword,
    signOut,
    avatar,
    uploadAvatar,
    saved,
    cart,
    orders,
    products,
    addresses,
    supportTickets,
    add,
    submitTicket,
    saveProfile,
    requestEmailChange,
    confirmEmailChange,
    changePassword,
    requestPasswordSetup,
    storeSettings,
    cancelOrder,
  } = useStore();
  const nav = useNavigate();
  const passwordMinimum = storeSettings.account_settings.password_minimum_length;
  const [tab, setTab] = useState("Profile");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab")?.toLowerCase();
    const matching = ["Profile","Orders","Addresses","Payments","Change password","Support"].find((item)=>item.toLowerCase().replace(/\s+/g,"-")===requested || item.toLowerCase()===requested);
    if (matching) setTab(matching);
  }, []);
  const [notice, setNotice] = useState("");
  const [ticket, setTicket] = useState("");
  const [ticketCategory, setTicketCategory] = useState<DbSupportTicket["category"]>("general");
  const [ticketPriority, setTicketPriority] = useState<DbSupportTicket["priority"]>("normal");
  const [ticketOrderId, setTicketOrderId] = useState("");
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [confirmProfileSave, setConfirmProfileSave] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [returnRequests, setReturnRequests] = useState<Array<{ id:string; order_id:string; return_number:string; reason:string; details:string; status:string; admin_note:string|null; created_at:string }>>([]);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("Changed my mind");
  const [returnDetails, setReturnDetails] = useState("");
  const [returnFiles, setReturnFiles] = useState<File[]>([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [reviewedOrderItemIds, setReviewedOrderItemIds] = useState<Set<number>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<OrderReviewTarget | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<ReviewPhotoDraft[]>([]);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState<{ productName: string; published: boolean } | null>(null);
  const [securityView, setSecurityView] = useState<"home" | "setup" | "change">(
    "home",
  );
  const [mfaFactors, setMfaFactors] = useState<Array<{ id:string; friendly_name?:string; status:string }>>([]);
  const [mfaEnrollment, setMfaEnrollment] = useState<{ id:string; qr:string; secret:string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [passwordSetupSending, setPasswordSetupSending] = useState(false);
  const defaultUsername =
    profileUsername.trim() || (user ?? "").trim().split(/\s+/)[0] || "";
  useEffect(() => {
    if (!userId) return;
    const refresh = async () => {
      const { data } = await supabase
        .from("return_requests")
        .select("id,order_id,user_id,return_number,reason,details,status,admin_note,evidence_paths,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setReturnRequests((data ?? []) as typeof returnRequests);
    };
    void refresh();
    const channel = supabase.channel(`customer-returns-${userId}`).on("postgres_changes", { event:"*", schema:"public", table:"return_requests", filter:`user_id=eq.${userId}` }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);
  const refreshReviewedOrderItems = useCallback(async () => {
    if (!userId) {
      setReviewedOrderItemIds(new Set());
      return;
    }
    const { data } = await supabase
      .from("reviews")
      .select("order_item_id")
      .eq("user_id", userId);
    setReviewedOrderItemIds(
      new Set(
        (data ?? [])
          .map((row) => Number(row.order_item_id))
          .filter((id) => Number.isInteger(id)),
      ),
    );
  }, [userId]);
  useEffect(() => {
    void refreshReviewedOrderItems();
    if (!userId) return;
    const channel = supabase
      .channel(`customer-order-reviews-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `user_id=eq.${userId}` },
        () => void refreshReviewedOrderItems(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshReviewedOrderItems, userId]);
  const clearReviewDraft = useCallback(() => {
    setReviewPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.preview));
      return [];
    });
    setReviewTarget(null);
    setReviewRating(0);
    setReviewTitle("");
    setReviewBody("");
    setReviewError("");
  }, []);
  const openReview = (target: OrderReviewTarget) => {
    clearReviewDraft();
    setReviewTarget(target);
  };
  const addReviewPhotos = (files: FileList | null) => {
    if (!files) return;
    const available = 2 - reviewPhotos.length;
    const selected = Array.from(files).slice(0, available);
    const invalid = selected.find(
      (file) =>
        file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    if (invalid) {
      setReviewError("Review photos must be JPG, PNG, or WebP files no larger than 5 MB each.");
      return;
    }
    setReviewError("");
    setReviewPhotos((current) => [
      ...current,
      ...selected.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  };
  const removeReviewPhoto = (index: number) => {
    setReviewPhotos((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };
  const submitOrderReview = async () => {
    if (!userId || !reviewTarget || reviewSubmitting) return;
    if (reviewRating < 1) {
      setReviewError("Choose a star rating before submitting your review.");
      return;
    }
    if (reviewBody.trim().length < 5) {
      setReviewError("Tell other shoppers about the product in at least 5 characters.");
      return;
    }
    setReviewSubmitting(true);
    setReviewError("");
    const uploadedPaths: string[] = [];
    const imageUrls: string[] = [];
    for (const photo of reviewPhotos) {
      const optimized = await optimizeImageUpload(photo.file, {
        maxDimension: 1600,
        quality: 0.86,
      });
      const path = `${userId}/${reviewTarget.item.id}/${crypto.randomUUID()}-${safeFileName(optimized.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("review-images")
        .upload(path, optimized, {
          cacheControl: "31536000",
          contentType: optimized.type,
          upsert: false,
        });
      if (uploadError) {
        if (uploadedPaths.length) await supabase.storage.from("review-images").remove(uploadedPaths);
        setReviewSubmitting(false);
        setReviewError(`We could not upload ${photo.file.name}. ${uploadError.message}`);
        return;
      }
      uploadedPaths.push(path);
      imageUrls.push(supabase.storage.from("review-images").getPublicUrl(path).data.publicUrl);
    }
    const { data, error } = await supabase.rpc("submit_order_item_review", {
      p_order_item_id: reviewTarget.item.id,
      p_rating: reviewRating,
      p_title: reviewTitle.trim(),
      p_body: reviewBody.trim(),
      p_image_urls: imageUrls,
    });
    if (error) {
      if (uploadedPaths.length) await supabase.storage.from("review-images").remove(uploadedPaths);
      setReviewSubmitting(false);
      setReviewError(error.message);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const productName = reviewTarget.item.product_name;
    setReviewSubmitting(false);
    await refreshReviewedOrderItems();
    clearReviewDraft();
    setReviewSuccess({ productName, published: Boolean(result?.approved) });
  };
  const loadMfaFactors = useCallback(async () => {
    if (!userId) { setMfaFactors([]); return; }
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setNotice(error.message); return; }
    setMfaFactors([...(data?.totp ?? []), ...(data?.phone ?? [])] as typeof mfaFactors);
  }, [userId]);
  useEffect(() => { void loadMfaFactors(); }, [loadMfaFactors]);
  const beginMfaEnrollment = async () => {
    setMfaBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType:"totp", friendlyName:"CozyCraft authenticator" });
    setMfaBusy(false);
    if (error || !data?.totp) { setNotice(error?.message ?? "Authenticator setup could not start."); return; }
    setMfaEnrollment({ id:data.id, qr:data.totp.qr_code, secret:data.totp.secret });
  };
  const verifyMfaEnrollment = async () => {
    if (!mfaEnrollment || !/^\d{6}$/.test(mfaCode)) { setNotice("Enter the 6-digit code from your authenticator app."); return; }
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId:mfaEnrollment.id, code:mfaCode });
    setMfaBusy(false);
    if (error) { setNotice(error.message); return; }
    setMfaEnrollment(null); setMfaCode(""); await loadMfaFactors(); setNotice("Two-step verification is now active.");
  };
  const removeMfaFactor = async (factorId:string) => {
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setMfaBusy(false);
    if (error) { setNotice(error.message); return; }
    await loadMfaFactors(); setNotice("Authenticator verification was removed.");
  };
  const signOutOtherDevices = async () => {
    setMfaBusy(true);
    const { error } = await supabase.auth.signOut({ scope:"others" });
    setMfaBusy(false);
    setNotice(error?.message ?? "Other CozyCraft sessions have been signed out.");
  };
  const submitReturnRequest = async () => {
    if (!userId || !returnOrderId || returnDetails.trim().length < 10) {
      setNotice("Please explain the return in at least 10 characters.");
      return;
    }
    const invalidEvidence = returnFiles.slice(0, 3).find((file) => file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalidEvidence) {
      setNotice("Return evidence must be a JPG, PNG, or WebP image no larger than 5 MB.");
      return;
    }
    setReturnSubmitting(true);
    const evidencePaths: string[] = [];
    for (const file of returnFiles.slice(0, 3)) {
      const path = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error } = await supabase.storage.from("return-evidence").upload(path, file);
      if (error) { setReturnSubmitting(false); setNotice(`Could not upload ${file.name}: ${error.message}`); return; }
      evidencePaths.push(path);
    }
    const { error } = await supabase.from("return_requests").insert({ user_id:userId, order_id:returnOrderId, reason:returnReason, details:returnDetails.trim(), evidence_paths:evidencePaths });
    setReturnSubmitting(false);
    if (error) { setNotice(error.message); return; }
    setReturnOrderId(null); setReturnDetails(""); setReturnFiles([]);
    setNotice("Your return request was submitted for review.");
  };
  const submitCancellation = async () => {
    if (!cancelOrderId || cancelReason.trim().length < 5) {
      setNotice("Please provide a cancellation reason of at least 5 characters.");
      return;
    }
    setCancelSubmitting(true);
    const error = await cancelOrder(cancelOrderId, cancelReason.trim());
    setCancelSubmitting(false);
    if (error) {
      setNotice(error);
      return;
    }
    setCancelOrderId(null);
    setCancelReason("");
    setNotice("Your cancellation request is pending approval. We’ll update this order in real time after review.");
  };
  const [username, setUsername] = useState(defaultUsername);
  const [first, setFirst] = useState((user ?? "").split(" ")[0] ?? "");
  const [last, setLast] = useState(
    (user ?? "").split(" ").slice(1).join(" "),
  );
  const [email, setEmail] = useState(userEmail ?? "");
  const [emailEditing, setEmailEditing] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(() =>
    window.sessionStorage.getItem("cozycraft-pending-email"),
  );
  const [emailCheckMessage, setEmailCheckMessage] = useState("");
  const [emailRequesting, setEmailRequesting] = useState(false);
  const [phone, setPhone] = useState(profilePhone);
  const [gender, setGender] = useState(profileGender);
  const [birth, setBirth] = useState(profileBirth);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const resetProfileDraft = useCallback(() => {
    const nameParts = (user ?? "").trim().split(/\s+/).filter(Boolean);
    setUsername(
      profileUsername.trim() || nameParts[0] || "",
    );
    setFirst(nameParts[0] ?? "");
    setLast(nameParts.slice(1).join(" "));
    setPhone(profilePhone);
    setGender(profileGender);
    setBirth(profileBirth);
  }, [
    profileBirth,
    profileGender,
    profilePhone,
    profileUsername,
    user,
  ]);
  useEffect(() => {
    if (!profileEditing) resetProfileDraft();
  }, [profileEditing, resetProfileDraft]);
  const verifyPendingEmail = useCallback(async () => {
    if (!pendingEmail) return;
    const result = await confirmEmailChange(pendingEmail);
    if (result.error) {
      setEmailCheckMessage(result.error);
      return;
    }
    if (result.confirmed) {
      window.sessionStorage.removeItem("cozycraft-pending-email");
      setEmail(pendingEmail);
      setPendingEmail(null);
      setEmailCheckMessage("");
      setNotice("Your new email address is verified and active.");
    } else {
      setEmailCheckMessage(
        "Not confirmed yet. Open the email and click Confirm new email address.",
      );
    }
  }, [confirmEmailChange, pendingEmail]);
  useEffect(() => {
    if (!pendingEmail) return;
    window.sessionStorage.setItem("cozycraft-pending-email", pendingEmail);
    const timer = window.setInterval(() => {
      void verifyPendingEmail();
    }, 5000);
    void verifyPendingEmail();
    return () => {
      window.clearInterval(timer);
    };
  }, [pendingEmail, verifyPendingEmail]);
  useEffect(() => {
    if (!authReady || !user || !role || role === "customer") return;
    void signOut().then(() => {
      nav("/login?reason=invalid-login", { replace: true });
    });
  }, [authReady, nav, role, signOut, user]);
  const orderFilters = [
    ["all", "All"],
    ["pending", "To process"],
    ["processing", "Processing"],
    ["packed", "Packed"],
    ["shipped", "To receive"],
    ["delivered", "Completed"],
    ["cancelled", "Cancelled"],
  ] as const;
  const visibleOrders = useMemo(
    () =>
      orderFilter === "all"
        ? orders
        : orders.filter((order) => order.status === orderFilter),
    [orderFilter, orders],
  );
  useEffect(() => {
    if (!visibleOrders.length) {
      setSelectedOrderId("");
      return;
    }
    if (!visibleOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(visibleOrders[0].id);
    }
  }, [selectedOrderId, visibleOrders]);
  const selectedOrder =
    visibleOrders.find((order) => order.id === selectedOrderId) ??
    visibleOrders[0] ??
    null;
  if (!user) return <Account mode="login" />;
  if (role && role !== "customer") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#e9e5de] text-sm text-muted-foreground">
        Checking customer access…
      </main>
    );
  }
  const tabs = [
    "Profile",
    "Orders",
    "Addresses",
    "Payments",
    "Change password",
    "Support",
  ];
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError(
        "This image is too large. Please select a file smaller than 5 MB.",
      );
      e.target.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Please select a JPEG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }
    setPhotoError("");
    setPhotoUploading(true);
    try {
      const result = await uploadAvatar(file);
      if (result.error) {
        setPhotoError(result.error);
        return;
      }
      setNotice("Profile picture updated and synced with your account.");
      if (result.url) setPhotoDialog(false);
    } catch {
      setPhotoError(
        "The upload was interrupted. Check your connection and try again.",
      );
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };
  const requestProfileSave = () => {
    const fullName = `${first.trim()} ${last.trim()}`.trim();
    const todayInPhilippines = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (!username.trim()) {
      setNotice("Username is required.");
      return;
    }
    if (!fullName) {
      setNotice("Please enter your name.");
      return;
    }
    if (birth && birth >= todayInPhilippines) {
      setNotice("Please choose your actual date of birth in the past.");
      return;
    }
    setNotice("");
    setConfirmProfileSave(true);
  };
  const submitProfile = async () => {
    const fullName = `${first.trim()} ${last.trim()}`.trim();
    setProfileSaving(true);
    const error = await saveProfile({
      fullName,
      phone: phone.trim(),
      username: username.trim(),
      gender,
      birth,
    });
    setProfileSaving(false);
    if (error) {
      setConfirmProfileSave(false);
      setNotice(error);
      return;
    }
    setConfirmProfileSave(false);
    setProfileEditing(false);
    setNotice("Profile details saved.");
  };
  const submitEmailChange = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes("@")) {
      setNotice("Enter a valid email address.");
      return;
    }
    if (nextEmail === (userEmail ?? "").toLowerCase()) {
      setEmailEditing(false);
      setNotice("This is already your active email address.");
      return;
    }
    setEmailRequesting(true);
    setEmailCheckMessage("");
    const error = await requestEmailChange(nextEmail);
    setEmailRequesting(false);
    if (error) {
      setNotice(error);
      return;
    }
    window.sessionStorage.setItem("cozycraft-pending-email", nextEmail);
    setPendingEmail(nextEmail);
    setEmailEditing(false);
  };
  const cancelEmailChange = () => {
    window.sessionStorage.removeItem("cozycraft-pending-email");
    setPendingEmail(null);
    setEmailCheckMessage("");
    setEmail(userEmail ?? "");
    setEmailEditing(false);
    setNotice(
      "Email change dismissed. Your current email remains active—ignore the verification email.",
    );
  };
  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (
      newPassword.length < passwordMinimum ||
      !/[a-z]/.test(newPassword) ||
      !/[A-Z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword) ||
      newPassword !== confirmPassword
    ) {
      setNotice(
        `Use matching passwords with at least ${passwordMinimum} characters, including uppercase, lowercase, a number, and a symbol.`,
      );
      return;
    }
    const error = await changePassword(currentPassword, newPassword);
    if (error) {
      setNotice(error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSecurityView("home");
    setNotice("Password changed successfully.");
  };
  const sendPasswordSetupLink = async () => {
    setPasswordSetupSending(true);
    setNotice("");
    const error = await requestPasswordSetup();
    setPasswordSetupSending(false);
    if (error) {
      setNotice(error);
      return;
    }
    setSecurityView("home");
    setNotice(
      `A secure password setup link was sent to ${userEmail ?? "your email"}.`,
    );
  };
  return (
    <Layout>
      <main className="mx-auto max-w-[1320px] px-4 pb-12 pt-5 sm:px-5 sm:py-8 lg:py-12">
        <section className="relative overflow-hidden rounded-[1.5rem] border border-border bg-[#f0ece4] px-5 py-6 text-foreground shadow-[0_14px_38px_rgba(35,31,27,.05)] sm:rounded-[2rem] sm:px-9 sm:py-8">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_75%_45%,rgba(185,151,112,.22),transparent_55%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-[#b8a58d] text-xl text-foreground">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user[0].toUpperCase()
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoError("");
                    setPhotoDialog(true);
                  }}
                  aria-label="Change profile picture"
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-card text-foreground shadow-sm transition hover:scale-105"
                >
                  <Plus size={13} />
                </button>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
                  COZYCRAFT MEMBER
                </p>
                <h1 className="mt-1 break-words font-serif text-3xl sm:text-4xl">
                  Hello, {first || user}.
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your personal home for every CozyCraft detail.
                </p>
              </div>
            </div>
            <button
              onClick={() => setConfirmSignOut(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 text-xs font-semibold transition hover:bg-card"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </section>
        <div className="mt-5 grid gap-5 lg:grid-cols-[250px_1fr]">
          <aside className="flex h-fit gap-1 overflow-x-auto rounded-[1.25rem] border border-border bg-[#fbfaf7] p-2 shadow-[0_10px_30px_rgba(35,31,27,.035)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:rounded-[1.75rem] lg:p-3">
            <p className="hidden px-3 py-2 text-[10px] font-bold tracking-[.16em] text-muted-foreground lg:block">
              MY ACCOUNT
            </p>
            {tabs.map((item) => (
              <button
                onClick={() => setTab(item)}
                key={item}
                className={`flex w-auto shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition lg:w-full lg:py-3 ${tab === item ? "bg-foreground font-semibold text-background shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                {item}
                {item === "Orders" && <span className="text-xs">{orders.length}</span>}
                {item === "Change password" && <ShieldCheck size={14} />}
                {item === "Support" && <MessageCircle size={14} />}
              </button>
            ))}
            <div className="flex shrink-0 gap-1 lg:mt-3 lg:block lg:border-t lg:border-border lg:pt-3">
              <Link
                to="/wishlist"
                className="flex shrink-0 gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground lg:justify-between lg:py-3"
              >
                Wishlist <span>{saved.length}</span>
              </Link>
              <Link
                to="/cart"
                className="flex shrink-0 gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground lg:justify-between lg:py-3"
              >
                My bag <span>{cart.length}</span>
              </Link>
            </div>
          </aside>
          <section className="min-h-[420px] rounded-[1.25rem] border border-border bg-card p-4 shadow-[0_10px_30px_rgba(35,31,27,.035)] sm:rounded-[1.75rem] sm:p-9 lg:min-h-[560px]">
            {tab === "Profile" && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      PERSONAL DETAILS
                    </p>
                    <h2 className="mt-2 font-serif text-3xl">
                      Your account, your way.
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Keep these details current for a seamless checkout and
                      delivery.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#e3ecdf] px-3 py-2 text-[10px] font-bold tracking-[.1em] text-[#56714f]">
                      MEMBER
                    </span>
                    {!profileEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotice("");
                          setProfileEditing(true);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold transition hover:bg-secondary"
                      >
                        <Pencil size={14} />
                        Edit profile
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-8 grid gap-5">
                  <label className="grid gap-2 text-sm font-semibold">
                    Username
                    <input
                      required
                      disabled={!profileEditing}
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none transition enabled:focus:border-foreground enabled:focus:ring-4 enabled:focus:ring-[#d9c9b4]/25 disabled:cursor-default disabled:bg-secondary/40 disabled:text-muted-foreground"
                      placeholder="Your username"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold">
                      First name
                      <input
                        disabled={!profileEditing}
                        value={first}
                        onChange={(event) => setFirst(event.target.value)}
                        className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none disabled:cursor-default disabled:bg-secondary/40 disabled:text-muted-foreground"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Last name
                      <input
                        disabled={!profileEditing}
                        value={last}
                        onChange={(event) => setLast(event.target.value)}
                        className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none disabled:cursor-default disabled:bg-secondary/40 disabled:text-muted-foreground"
                      />
                    </label>
                  </div>
                  <div className="rounded-2xl border border-border bg-[#fcfbf8] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold">Email address</p>
                        {emailEditing ? (
                          <input
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            type="email"
                            className="mt-2 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none sm:w-80"
                          />
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {email}
                          </p>
                        )}
                      </div>
                      {profileEditing && (
                        <button
                          onClick={() => {
                            if (emailEditing) void submitEmailChange();
                            else if (!hasPassword) setAuthFailed(true);
                            else setEmailEditing(true);
                          }}
                          disabled={emailRequesting}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                        >
                          {emailRequesting
                            ? "Sending…"
                            : emailEditing
                              ? "Done"
                              : "Change"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold">
                      Phone number
                      <input
                        disabled={!profileEditing}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none disabled:cursor-default disabled:bg-secondary/40 disabled:text-muted-foreground"
                        placeholder="Add a phone number"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Gender
                      <select
                        disabled={!profileEditing}
                        value={gender}
                        onChange={(event) => setGender(event.target.value)}
                        className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none disabled:cursor-default disabled:bg-secondary/40 disabled:text-muted-foreground"
                      >
                        <option value="">Prefer not to say</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold sm:max-w-[calc(50%-0.5rem)]">
                    Date of birth
                    <input
                      disabled={!profileEditing}
                      value={birth}
                      onChange={(event) => setBirth(event.target.value)}
                      type="date"
                      min="1900-01-01"
                      max={new Intl.DateTimeFormat("en-CA", {
                        timeZone: "Asia/Manila",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(new Date())}
                      className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none disabled:cursor-default disabled:bg-secondary/40 disabled:text-muted-foreground"
                    />
                  </label>
                  <div className="grid gap-3 rounded-2xl bg-secondary p-4 sm:grid-cols-3">
                    {[
                      ["Saved pieces", saved.length],
                      ["Orders", orders.length],
                      ["In your bag", cart.length],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="font-serif text-2xl">{value}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                {profileEditing && (
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={requestProfileSave}
                      className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetProfileDraft();
                        setEmail(userEmail ?? "");
                        setEmailEditing(false);
                        setNotice("");
                        setProfileEditing(false);
                      }}
                      className="rounded-xl border border-border px-5 py-3 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
            {tab === "Change password" && (
              <>
                {securityView === "setup" ? (
                  <section className="max-w-lg">
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      SET UP PASSWORD
                    </p>
                    <h2 className="mt-2 font-serif text-3xl">
                      Add an email sign-in option.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      This account currently signs in with Google and has no
                      CozyCraft password. We’ll send a secure setup link to
                      <b> {userEmail}</b>; no current password is required.
                    </p>
                    <button
                      type="button"
                      onClick={() => void sendPasswordSetupLink()}
                      disabled={passwordSetupSending}
                      className="mt-7 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60"
                    >
                      {passwordSetupSending
                        ? "Sending secure link…"
                        : "Send password setup link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSecurityView("home")}
                      disabled={passwordSetupSending}
                      className="ml-4 text-xs font-semibold underline underline-offset-4 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </section>
                ) : securityView === "change" ? (
                  <form onSubmit={submitPassword} className="max-w-lg">
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      CHANGE PASSWORD
                    </p>
                    <h2 className="mt-2 font-serif text-3xl">
                      Choose a new password.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Confirm your current password before choosing a new one.
                    </p>
                    <div className="mt-7 grid gap-4">
                      <label className="grid gap-2 text-sm font-semibold">
                        Current CozyCraft password
                        <input
                          value={currentPassword}
                          onChange={(event) =>
                            setCurrentPassword(event.target.value)
                          }
                          type="password"
                          required
                          className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none"
                          placeholder="Enter current password"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        New password
                        <input
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          type="password"
                          required
                          minLength={passwordMinimum}
                          className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none"
                          placeholder={`${passwordMinimum}+ characters with mixed character types`}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        Confirm new password
                        <input
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          type="password"
                          required
                          minLength={passwordMinimum}
                          className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none"
                          placeholder="Repeat new password"
                        />
                      </label>
                    </div>
                    <button className="mt-7 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">
                      Change password
                    </button>
                    <button
                      type="button"
                      onClick={() => setSecurityView("home")}
                      className="ml-4 text-xs font-semibold underline underline-offset-4"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="max-w-lg">
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      ACCOUNT SECURITY
                    </p>
                    <h2 className="mt-2 font-serif text-3xl">
                      Keep your account protected.
                    </h2>
                    <div className="mt-7 rounded-2xl border border-border p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">
                            CozyCraft password
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {hasPassword
                              ? "Password is set and ready to protect changes."
                              : "No password set — you signed in through Google."}
                          </p>
                        </div>
                        <ShieldCheck
                          className={
                            hasPassword
                              ? "text-[#6c8364]"
                              : "text-muted-foreground"
                          }
                          size={20}
                        />
                      </div>
                      <button
                        onClick={() =>
                          setSecurityView(hasPassword ? "change" : "setup")
                        }
                        className="mt-5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold"
                      >
                        {hasPassword ? "Change password" : "Set up a password"}
                      </button>
                    </div>
                    {storeSettings.account_settings.customer_mfa_available && <div className="mt-4 rounded-2xl border border-border p-5">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Authenticator verification</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use a rotating 6-digit code for stronger account protection.</p></div><ShieldCheck className={mfaFactors.some((factor)=>factor.status === "verified") ? "text-[#6c8364]" : "text-muted-foreground"} size={20}/></div>
                      {mfaEnrollment ? <div className="mt-5 rounded-xl bg-secondary p-4"><p className="text-xs font-semibold">Scan this QR code with Google Authenticator, 1Password, Authy, or another TOTP app.</p><img src={mfaEnrollment.qr} alt="Authenticator setup QR code" className="mt-4 h-44 w-44 rounded-lg bg-white p-2"/><details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Can’t scan the code?</summary><code className="mt-2 block break-all rounded-lg bg-card p-2 text-foreground">{mfaEnrollment.secret}</code></details><label className="mt-4 grid gap-2 text-xs font-semibold">6-digit verification code<input value={mfaCode} onChange={(event)=>setMfaCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" className="h-11 rounded-xl border border-border bg-card px-3 text-base tracking-[.3em]"/></label><div className="mt-4 flex gap-3"><button type="button" onClick={()=>void verifyMfaEnrollment()} disabled={mfaBusy || mfaCode.length!==6} className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background disabled:opacity-50">{mfaBusy ? "Verifying…" : "Verify and enable"}</button><button type="button" onClick={()=>setMfaEnrollment(null)} disabled={mfaBusy} className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold">Cancel</button></div></div> : mfaFactors.some((factor)=>factor.status === "verified") ? <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-[#e7eee3] p-3 text-xs text-[#50674b]"><span><b className="block">Two-step verification active</b><span className="mt-1 block">Authenticator codes protect this account.</span></span><button type="button" disabled={mfaBusy} onClick={()=>void removeMfaFactor(mfaFactors.find((factor)=>factor.status === "verified")!.id)} className="shrink-0 rounded-lg border border-[#6c8364]/40 px-3 py-2 font-semibold">Remove</button></div> : <button type="button" onClick={()=>void beginMfaEnrollment()} disabled={mfaBusy} className="mt-5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold disabled:opacity-50">{mfaBusy ? "Starting…" : "Set up authenticator"}</button>}
                    </div>}
                    <div className="mt-4 rounded-2xl border border-border p-5"><p className="text-sm font-semibold">Other signed-in devices</p><p className="mt-1 text-xs leading-5 text-muted-foreground">End every other browser session without signing out this device.</p><button type="button" onClick={()=>void signOutOtherDevices()} disabled={mfaBusy} className="mt-5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Sign out other devices</button></div>
                    </div>
                )}
              </>
            )}
            {tab === "Orders" && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      PURCHASE HISTORY
                    </p>
                    <h2 className="mt-2 font-serif text-3xl">Your order center.</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Follow every furniture order from confirmation to delivery.
                    </p>
                  </div>
                  <Link
                    to="/orders"
                    className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold transition hover:bg-secondary"
                  >
                    Open full tracking
                  </Link>
                </div>
                <div className="mt-6 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {orderFilters.map(([value, label]) => {
                    const count = value === "all"
                      ? orders.length
                      : orders.filter((order) => order.status === value).length;
                    return (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setOrderFilter(value)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                          orderFilter === value
                            ? "bg-foreground text-background"
                            : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {label} <span className="ml-1 opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
                {!selectedOrder ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center">
                    <Package className="mx-auto text-muted-foreground" size={23} />
                    <p className="mt-3 text-sm font-semibold">No orders in this status.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Orders will move here automatically as CozyCraft updates fulfillment.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
                    <div className="max-h-[630px] space-y-2 overflow-y-auto pr-1">
                      {visibleOrders.map((order) => (
                        <button
                          type="button"
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            selectedOrder.id === order.id
                              ? "border-foreground bg-secondary shadow-sm"
                              : "border-border hover:bg-secondary/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span>
                              <b className="block text-sm">#{order.order_number}</b>
                              <span className="mt-1 block text-[11px] text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString("en-PH", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </span>
                            <Status>{order.status.replace(/_/g, " ")}</Status>
                          </div>
                          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                            {order.order_items.map((item) => item.product_name).join(" · ")}
                          </p>
                          <b className="mt-3 block text-sm">{money(Number(order.total))}</b>
                          {order.cancellation_status && <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${order.cancellation_status === "pending" ? "bg-[#f2e8d7] text-[#765d3c]" : order.cancellation_status === "approved" ? "bg-[#e5eee1] text-[#45603f]" : "bg-secondary text-muted-foreground"}`}><Clock size={11}/> Cancellation {order.cancellation_status}</span>}
                        </button>
                      ))}
                    </div>
                    <article className="relative z-[1] mb-6 overflow-hidden rounded-2xl border border-border bg-[#fcfbf8] xl:mb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
                        <div>
                          <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">ORDER DETAILS</p>
                          <h3 className="mt-2 font-serif text-2xl">#{selectedOrder.order_number}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Placed {new Date(selectedOrder.created_at).toLocaleString("en-PH", {
                              timeZone: "Asia/Manila",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        <Status>{selectedOrder.status.replace(/_/g, " ")}</Status>
                      </div>
                      {selectedOrder.cancellation_status && <div className={`border-b border-border p-4 text-xs ${selectedOrder.cancellation_status === "pending" ? "bg-[#f2e8d7] text-[#765d3c]" : selectedOrder.cancellation_status === "approved" ? "bg-[#e5eee1] text-[#45603f]" : "bg-secondary text-muted-foreground"}`}><b className="block">{selectedOrder.cancellation_status === "pending" ? "Cancellation pending approval" : selectedOrder.cancellation_status === "approved" ? "Cancellation approved" : "Cancellation request not approved"}</b><span className="mt-1 block">{selectedOrder.cancellation_decision_note || (selectedOrder.cancellation_status === "pending" ? "We’ll update this order in real time after an administrator reviews the request." : "The decision is reflected in this order’s current status.")}</span>{selectedOrder.cancellation_requested_at && <time className="mt-1 block" dateTime={selectedOrder.cancellation_requested_at}>Requested {new Date(selectedOrder.cancellation_requested_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time>}</div>}
                      {selectedOrder.status === "cancelled" ? (
                        <div className="border-b border-border bg-[#f3e5d4] p-4 text-xs text-[#8b5c46]">
                          <b className="block">This order was cancelled.</b>
                          {selectedOrder.order_status_history?.find((entry) => entry.status === "cancelled") && (
                            <time className="mt-1 block" dateTime={selectedOrder.order_status_history.find((entry) => entry.status === "cancelled")!.changed_at}>
                              {new Date(selectedOrder.order_status_history.find((entry) => entry.status === "cancelled")!.changed_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                            </time>
                          )}
                          <span className="mt-1 block">
                            {selectedOrder.payment_status === "refunded"
                              ? selectedOrder.refund_status === "demo_succeeded"
                                ? "The test payment refund has been recorded for this demo transaction."
                                : "Your refund was submitted to the original payment method."
                              : "It will not proceed to fulfillment and no settled refund is required."}
                          </span>
                          {selectedOrder.cancellation_reason && <span className="mt-1 block">Reason: {selectedOrder.cancellation_reason}</span>}
                        </div>
                      ) : (
                        <div className="border-b border-border bg-gradient-to-b from-[#fcfbf8] to-[#f7f3ec] p-4 sm:p-6">
                          <div className="flex flex-wrap items-end justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">LIVE ORDER TRACKING</p>
                              <h4 className="mt-1 text-base font-semibold">Delivery progress</h4>
                            </div>
                            <span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold capitalize text-muted-foreground">Current: {selectedOrder.status}</span>
                          </div>
                          <div className="relative mt-5 grid gap-0 md:grid-cols-5 md:gap-3">
                            <span className="absolute left-[10%] right-[10%] top-6 hidden h-0.5 bg-[#ddd6cc] md:block" aria-hidden="true" />
                            <span
                              className="absolute left-[10%] top-6 hidden h-0.5 bg-foreground transition-[width] duration-500 md:block"
                              style={{ width: `${Math.max(0, ["pending", "processing", "packed", "shipped", "delivered"].indexOf(selectedOrder.status)) * 20}%` }}
                              aria-hidden="true"
                            />
                            {["pending", "processing", "packed", "shipped", "delivered"].map((step, index, steps) => {
                              const current = steps.indexOf(selectedOrder.status);
                              const complete = index <= current;
                              const active = index === current;
                              const history = selectedOrder.order_status_history
                                ?.filter((entry) => entry.status === step)
                                .reduce((latest, entry) =>
                                  !latest || new Date(entry.changed_at) > new Date(latest.changed_at)
                                    ? entry
                                    : latest,
                                undefined as (typeof selectedOrder.order_status_history)[number] | undefined);
                              const statusTime = history
                                ? new Date(history.changed_at)
                                : null;
                              return (
                                <div key={step} className={`relative flex min-w-0 gap-3 pb-5 last:pb-0 md:flex-col md:items-center md:gap-0 md:pb-0 md:text-center ${active ? "text-foreground" : "text-muted-foreground"}`}>
                                  {index < steps.length - 1 && (
                                    <span className={`absolute left-[23px] top-12 h-[calc(100%-1.25rem)] w-0.5 md:hidden ${index < current ? "bg-foreground" : "bg-[#ddd6cc]"}`} aria-hidden="true" />
                                  )}
                                  <span className={`relative z-[1] grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 border-[#f9f6f0] text-sm font-semibold shadow-sm transition ${complete ? "bg-foreground text-background" : "bg-[#e8e2d9] text-muted-foreground"} ${active ? "ring-4 ring-[#d9cdbc]" : ""}`}>
                                    {complete ? <Check size={18} strokeWidth={2.4} /> : index + 1}
                                  </span>
                                  <div className={`min-w-0 flex-1 rounded-xl px-1 md:mt-3 md:w-full ${active ? "md:bg-card md:px-2 md:py-2 md:shadow-sm" : ""}`}>
                                    <span className="block text-sm capitalize">
                                      <b className={complete ? "text-foreground" : "text-muted-foreground"}>{step}</b>
                                      {statusTime ? (
                                        <time className="mt-1 block text-[11px] normal-case leading-4 text-muted-foreground" dateTime={history!.changed_at}>
                                          <span className="block">{statusTime.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })}</span>
                                          <span className="block">{statusTime.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}</span>
                                        </time>
                                      ) : (
                                        <span className="mt-1 block text-[11px] normal-case leading-4 text-muted-foreground/70">
                                          Awaiting update
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="divide-y divide-border px-5">
                        {selectedOrder.order_items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 py-4">
                            {item.image_url ? (
                              <ResilientImage src={item.image_url} alt={item.product_name} className="h-16 w-16 rounded-xl object-cover" />
                            ) : (
                              <span className="grid h-16 w-16 place-items-center rounded-xl bg-secondary"><Package size={18} /></span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{item.product_name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Qty {item.quantity} · {money(Number(item.unit_price))}</p>
                            </div>
                            {selectedOrder.status === "delivered" && (() => {
                              const reviewProductId =
                                item.product_id ??
                                products.find(
                                  (product) =>
                                    product.name.trim().toLowerCase() ===
                                    item.product_name.trim().toLowerCase(),
                                )?.id;
                              return reviewedOrderItemIds.has(item.id) ? (
                                <Link
                                  to={reviewProductId ? `/products/${reviewProductId}#reviews` : "#"}
                                  className="flex items-center gap-1.5 rounded-xl border border-[#78906f]/35 bg-[#e6eee2] px-3 py-2 text-[10px] font-semibold text-[#4e6848] transition hover:bg-[#dce8d7]"
                                >
                                  <Check size={12} /> Review submitted
                                </Link>
                              ) : reviewProductId ? (
                                <button
                                  type="button"
                                  onClick={() => openReview({ orderNumber: selectedOrder.order_number, item })}
                                  className="flex items-center gap-1.5 rounded-xl border border-foreground bg-foreground px-3 py-2 text-[10px] font-semibold text-background shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                  <Star size={12} /> Write a review
                                </button>
                              ) : (
                                <span className="rounded-lg bg-secondary px-3 py-2 text-[10px] text-muted-foreground">
                                  Product unavailable
                                </span>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-4 border-t border-border bg-secondary/45 p-5 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold tracking-[.12em] text-muted-foreground">DELIVER TO</p>
                          <p className="mt-2 text-xs leading-5">
                            {[selectedOrder.shipping_address.name, selectedOrder.shipping_address.line, selectedOrder.shipping_address.barangay, selectedOrder.shipping_address.city, selectedOrder.shipping_address.province, selectedOrder.shipping_address.postal].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold tracking-[.12em] text-muted-foreground">PAYMENT</p>
                          <p className="mt-2 text-xs capitalize">{selectedOrder.payment_method.replace(/_/g, " ")} · {selectedOrder.payment_status}</p>
                          <p className="mt-2 text-lg font-semibold">{money(Number(selectedOrder.total))}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 border-t border-border p-5 min-[390px]:grid-cols-2 sm:flex sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            selectedOrder.order_items.forEach((item) => {
                              if (item.product_id) add(item.product_id, item.quantity);
                            });
                            setNotice("Available pieces from this order were added to your bag.");
                            nav("/cart");
                          }}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background"
                        >
                          <ShoppingBag size={14} /> Buy again
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTicket(`Concern about order #${selectedOrder.order_number}: `);
                            setTab("Support");
                          }}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-secondary"
                        >
                          <MessageCircle size={14} /> Contact support
                        </button>
                        <Link to="/orders" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-secondary min-[390px]:col-span-2 sm:col-auto">
                          <ArrowRight size={14} /> Full tracking
                        </Link>
                        {["pending", "processing", "packed"].includes(selectedOrder.status) && !selectedOrder.cancellation_status && isCancellationWindowOpen(selectedOrder.created_at, new Date(), storeSettings.fulfillment_settings.cancellation_window_hours) && (
                          <button type="button" onClick={() => setCancelOrderId(selectedOrder.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#9a654f] px-4 py-2.5 text-xs font-semibold text-[#8b533d] hover:bg-[#f3e5d4] min-[390px]:col-span-2 sm:col-auto">
                            <X size={14} /> Cancel order
                          </button>
                        )}
                        {selectedOrder.cancellation_status === "pending" && <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f2e8d7] px-4 py-2.5 text-xs font-semibold text-[#765d3c] min-[390px]:col-span-2 sm:col-auto"><Clock size={14}/> Cancellation pending approval</span>}
                        {["shipped", "delivered"].includes(selectedOrder.status) && <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-muted-foreground min-[390px]:col-span-2 sm:col-auto"><Package size={14}/> Cancellation unavailable</span>}
                        {selectedOrder.status === "delivered" && isReturnWindowOpen(selectedOrder.order_status_history?.find((entry)=>entry.status==="delivered")?.changed_at, new Date(), storeSettings.fulfillment_settings.return_window_days) && !returnRequests.some((request) => request.order_id === selectedOrder.id) && (
                          <button type="button" onClick={() => setReturnOrderId(selectedOrder.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#9a654f] px-4 py-2.5 text-xs font-semibold text-[#8b533d] hover:bg-[#f3e5d4] min-[390px]:col-span-2 sm:col-auto">
                            <Archive size={14} /> Request return
                          </button>
                        )}
                      </div>
                      {returnRequests.find((request) => request.order_id === selectedOrder.id) && (() => {
                        const request = returnRequests.find((item) => item.order_id === selectedOrder.id)!;
                        return <div className="border-t border-border bg-[#e8efe5] p-5 text-xs text-[#486242]"><b>Return {request.return_number}</b><span className="ml-2 rounded-full border border-current px-2 py-1 capitalize">{request.status.replace(/_/g," ")}</span><p className="mt-2">{request.reason} · {request.details}</p>{request.admin_note && <p className="mt-1">Admin: {request.admin_note}</p>}</div>;
                      })()}
                    </article>
                  </div>
                )}
              </>
            )}
            {tab === "Addresses" && <AddressManager notify={setNotice} />}
            {tab === "Payments" && (
              <>
                <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  PAYMENT PREFERENCES
                </p>
                <h2 className="mt-2 font-serif text-3xl">Ways to pay.</h2>
                <div className="mt-6 grid gap-3">
                  {[
                    ["cod", "Cash on delivery", storeSettings.checkout_settings.cod_enabled, "Pay when your delivery arrives"],
                    ["card", "Debit or credit card", storeSettings.checkout_settings.card_enabled, "Secure hosted PayMongo checkout"],
                    ["gcash", "GCash", storeSettings.checkout_settings.gcash_enabled, "Secure hosted PayMongo checkout"],
                  ].filter(([, , enabled]) => enabled).map(([id, label, , detail]) => <div key={String(id)} className={`rounded-2xl border p-5 ${profilePaymentMethod === id ? "border-foreground bg-[#f4f0e9] ring-1 ring-foreground" : "border-border"}`}><div className="flex items-center justify-between gap-4"><div><b className="text-sm">{label}</b><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div><span className="rounded-full bg-[#e3ecdf] px-3 py-2 text-[10px] font-bold text-[#56714f]">AVAILABLE</span></div></div>)}
                </div>
                <p className="mt-4 max-w-xl text-xs leading-5 text-muted-foreground">
                  Payment availability updates from Store Settings in realtime. Card and GCash details stay on PayMongo’s protected checkout; CozyCraft never stores card numbers.
                </p>
              </>
            )}
            {tab === "Support" && (
              <>
                <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  CARE & SUPPORT
                </p>
                <h2 className="mt-2 font-serif text-3xl">
                  We are here to help.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Send a concern about your order, delivery, payment, or
                  product.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Direct support: <a className="font-semibold underline" href={`mailto:${storeSettings.contact_email}`}>{storeSettings.contact_email}</a>{storeSettings.support_phone ? <> · <a className="font-semibold underline" href={`tel:${storeSettings.support_phone.replace(/\s/g, "")}`}>{storeSettings.support_phone}</a></> : null}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3"><label className="grid gap-2 text-xs font-semibold">Concern type<select value={ticketCategory} onChange={(event)=>setTicketCategory(event.target.value as DbSupportTicket["category"])} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"><option value="general">General</option><option value="order">Order</option><option value="delivery">Delivery</option><option value="payment">Payment</option><option value="product">Product</option><option value="return">Return</option><option value="account">Account</option></select></label><label className="grid gap-2 text-xs font-semibold">Priority<select value={ticketPriority} onChange={(event)=>setTicketPriority(event.target.value as DbSupportTicket["priority"])} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="grid gap-2 text-xs font-semibold">Related order<select value={ticketOrderId} onChange={(event)=>setTicketOrderId(event.target.value)} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"><option value="">None</option>{orders.map((order)=><option key={order.id} value={order.id}>#{order.order_number}</option>)}</select></label></div>
                <textarea
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  minLength={10}
                  maxLength={4000}
                  className="mt-3 min-h-36 w-full rounded-2xl border border-border bg-[#fcfbf8] p-4 text-sm outline-none"
                  placeholder="Include your order number and a short description of your concern."
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{ticket.length}/4,000</p>
                <label className="mt-3 grid gap-2 text-xs font-semibold">Evidence (optional, up to 3 files)<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event)=>setTicketFiles(Array.from(event.target.files??[]).slice(0,3))} className="rounded-xl border border-border bg-[#fcfbf8] p-3 font-normal"/></label>
                <button
                  onClick={async () => {
                    if (ticket.trim().length < 10) { setNotice("Please describe your concern in at least 10 characters."); return; }
                    const error = await submitTicket({message:ticket,category:ticketCategory,priority:ticketPriority,orderId:ticketOrderId,files:ticketFiles});
                    if (!error) {setTicket("");setTicketFiles([]);setTicketOrderId("");}
                    setNotice(error ?? "Support ticket sent and visible to the admin care team.");
                  }}
                  disabled={ticket.trim().length < 10}
                  className="mt-3 rounded-xl bg-foreground px-4 py-3 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Send support ticket
                </button>
                <div className="mt-5 grid gap-3">
                  {supportTickets.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-border bg-secondary p-4 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <b>Ticket #{item.ticket_number}</b>
                        <Status>
                          {item.status.replace(/_/g, " ")}
                        </Status>
                      </div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{item.category} · {item.priority} priority</p>
                      <p className="mt-2 font-semibold">
                        {item.status === "open"
                          ? "Your concern has been received."
                          : item.status === "in_progress"
                            ? "The CozyCraft care team is working on this concern."
                            : item.status === "resolved"
                              ? "This concern has been marked as resolved."
                              : "This support ticket is closed."}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        {item.message}
                      </p>
                      {item.admin_reply && (
                        <div className="mt-3 rounded-lg bg-card p-3">
                          <b>CozyCraft reply</b>
                          <p className="mt-1 text-muted-foreground">
                            {item.admin_reply}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                  {!supportTickets.length && (
                    <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                      No support tickets yet.
                    </p>
                  )}
                </div>
              </>
            )}
            {notice && (
              <p className="mt-5 flex items-center gap-2 text-sm text-[#5b744f]">
                <Check size={16} />
                {notice}
              </p>
            )}
          </section>
        </div>
      </main>
      {confirmProfileSave && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-profile-title"
          className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-5 backdrop-blur-sm"
        >
          <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e3ecdf] text-[#56714f]">
              <Pencil size={18} />
            </span>
            <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              CONFIRM PROFILE CHANGES
            </p>
            <h2 id="confirm-profile-title" className="mt-2 font-serif text-3xl">
              Save these details?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your updated username and personal information will be saved to
              your CozyCraft account and shown wherever your profile is used.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmProfileSave(false)}
                disabled={profileSaving}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitProfile()}
                disabled={profileSaving}
                className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
              >
                {profileSaving ? "Saving…" : "Confirm changes"}
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingEmail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-verification-title"
          className="fixed inset-0 z-[140] grid place-items-center bg-[#1f1e1b]/72 p-5 backdrop-blur-md"
        >
          <section className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="relative bg-[#292a26] p-7 text-[#f7f3eb]">
              <button
                type="button"
                onClick={cancelEmailChange}
                aria-label="Cancel email change"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e3ecdf] text-[#56714f]">
                <ShieldCheck size={21} />
              </span>
              <p className="mt-5 text-[10px] font-bold tracking-[.18em] text-white/60">
                VERIFY YOUR NEW EMAIL
              </p>
              <h2
                id="email-verification-title"
                className="mt-2 font-serif text-3xl"
              >
                Check your inbox.
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm leading-6 text-muted-foreground">
                We sent a secure confirmation link to{" "}
                <strong className="text-foreground">{pendingEmail}</strong>.
                Your current email remains active until Supabase confirms this
                change.
              </p>
              <div className="mt-5 rounded-2xl bg-secondary p-4 text-xs leading-5 text-muted-foreground">
                This screen stays locked while the change is pending. Depending
                on your security settings, you may also receive a confirmation
                message at your current email address.
              </div>
              <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
                Changed your mind? Use the X and ignore the verification email.
              </p>
              {emailCheckMessage && (
                <p
                  role="status"
                  className="mt-4 rounded-xl bg-[#f3e5d4] px-4 py-3 text-xs font-semibold leading-5 text-[#8b5c46]"
                >
                  {emailCheckMessage}
                </p>
              )}
              <button
                onClick={() => void verifyPendingEmail()}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background"
              >
                <Check size={16} />
                I confirmed my new email
              </button>
              <button
                onClick={async () => {
                  setEmailRequesting(true);
                  const error = await requestEmailChange(pendingEmail);
                  setEmailRequesting(false);
                  setEmailCheckMessage(
                    error ?? "A new verification email has been sent.",
                  );
                }}
                disabled={emailRequesting}
                className="mt-4 w-full text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50"
              >
                {emailRequesting
                  ? "Sending verification email…"
                  : "Resend verification email"}
              </button>
            </div>
          </section>
        </div>
      )}
      {photoDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-upload-title"
          className="fixed inset-0 z-[110] grid place-items-center bg-black/45 p-5 backdrop-blur-sm"
        >
          <section className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  PROFILE PICTURE
                </p>
                <h2
                  id="photo-upload-title"
                  className="mt-2 font-serif text-3xl"
                >
                  Update your photo.
                </h2>
              </div>
              <button
                onClick={() => setPhotoDialog(false)}
                aria-label="Close upload dialog"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-[#b8a58d] bg-[#f4f0e9] p-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-card text-muted-foreground">
                <Upload size={20} />
              </div>
              <p className="mt-4 text-sm font-semibold">
                Choose a new profile image
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Maximum 5 MB · JPEG, PNG, or WebP
              </p>
              {photoError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-[#f3e5d4] px-3 py-2 text-xs font-semibold leading-5 text-[#8b5c46]"
                >
                  {photoError}
                </p>
              )}
              <label
                className={`mt-5 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-xs font-semibold text-background ${
                  photoUploading
                    ? "cursor-wait opacity-60"
                    : "cursor-pointer"
                }`}
              >
                {photoUploading ? "Uploading and saving…" : "Select image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={photoUploading}
                  onChange={(event) => void upload(event)}
                  className="hidden"
                />
                <Upload size={14} />
              </label>
            </div>
          </section>
        </div>
      )}
      {authFailed && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] grid place-items-center bg-black/45 p-5 backdrop-blur-sm"
        >
          <section className="w-full max-w-md rounded-3xl bg-card p-7 shadow-2xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f3e5d4] text-[#8b5c46]">
              <LockKeyhole size={19} />
            </span>
            <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              ACCOUNT SECURITY
            </p>
            <h2 className="mt-2 font-serif text-3xl">
              Set up a password first.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Add a CozyCraft password before changing your sign-in email.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setAuthFailed(false)}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAuthFailed(false);
                  setTab("Change password");
                  setSecurityView("setup");
                }}
                className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
              >
                Set up password
              </button>
            </div>
          </section>
        </div>
      )}
      {returnOrderId && (
        <div role="dialog" aria-modal="true" aria-labelledby="return-title" className="fixed inset-0 z-[120] grid place-items-center bg-black/55 p-5 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-3xl bg-card p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">RETURN REQUEST</p><h2 id="return-title" className="mt-2 font-serif text-3xl">Tell us what happened.</h2></div><button onClick={() => setReturnOrderId(null)} className="rounded-full border border-border p-2" aria-label="Close"><X size={16}/></button></div>
            <label className="mt-5 grid gap-2 text-sm font-semibold">Reason<select value={returnReason} onChange={(event)=>setReturnReason(event.target.value)} className="h-12 rounded-xl border border-border bg-background px-3 font-normal"><option>Changed my mind</option><option>Damaged on arrival</option><option>Wrong item delivered</option><option>Missing parts</option><option>Product differs from description</option><option>Other</option></select></label>
            <label className="mt-4 grid gap-2 text-sm font-semibold">Details<textarea value={returnDetails} onChange={(event)=>setReturnDetails(event.target.value)} rows={4} maxLength={1000} placeholder="Describe the issue and condition of the item…" className="resize-none rounded-xl border border-border bg-background p-3 font-normal"/></label>
            <label className="mt-4 grid gap-2 text-sm font-semibold">Evidence photos (up to 3)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event)=>setReturnFiles(Array.from(event.target.files ?? []).slice(0,3))} className="rounded-xl border border-border p-3 text-xs font-normal"/><span className="text-[10px] font-normal text-muted-foreground">Each image must be 5 MB or less.</span></label>
            <div className="mt-6 flex justify-end gap-3"><button onClick={()=>setReturnOrderId(null)} disabled={returnSubmitting} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancel</button><button onClick={()=>void submitReturnRequest()} disabled={returnSubmitting || returnDetails.trim().length<10} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{returnSubmitting?"Submitting…":"Submit return"}</button></div>
          </section>
        </div>
      )}
      {reviewTarget && createPortal(
        <div className="fixed inset-0 z-[320] overflow-y-auto bg-[#171614]/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="order-review-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !reviewSubmitting) clearReviewDraft(); }}>
          <section className="mx-auto my-auto grid min-h-full w-full max-w-4xl place-items-center py-3">
            <div className="w-full overflow-hidden rounded-[1.75rem] bg-[#fbfaf7] shadow-[0_30px_90px_rgba(0,0,0,.28)]">
              <header className="flex items-start justify-between gap-4 border-b border-border bg-[#eee8de] p-5 sm:p-7">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">DELIVERED PURCHASE · #{reviewTarget.orderNumber}</p>
                  <h2 id="order-review-title" className="mt-2 font-serif text-3xl sm:text-4xl">How does it feel at home?</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Your experience helps another customer choose confidently.</p>
                </div>
                <button type="button" onClick={clearReviewDraft} disabled={reviewSubmitting} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card transition hover:bg-secondary disabled:opacity-50" aria-label="Close review form"><X size={18}/></button>
              </header>
              <div className="grid lg:grid-cols-[.68fr_1.32fr]">
                <aside className="border-b border-border bg-[#f3efe8] p-5 lg:border-b-0 lg:border-r lg:p-7">
                  <div className="flex items-center gap-4 lg:block">
                    {reviewTarget.item.image_url ? <ResilientImage src={reviewTarget.item.image_url} alt={reviewTarget.item.product_name} className="h-24 w-24 shrink-0 rounded-2xl object-cover lg:h-auto lg:w-full lg:aspect-square"/> : <span className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-card lg:aspect-square lg:h-auto lg:w-full"><Package size={28}/></span>}
                    <div className="min-w-0 lg:mt-5">
                      <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">YOUR PURCHASE</p>
                      <h3 className="mt-1 truncate text-base font-semibold lg:whitespace-normal">{reviewTarget.item.product_name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Quantity {reviewTarget.item.quantity}</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold">Review quality check</p>
                    <ul className="mt-3 space-y-2 text-[11px] text-muted-foreground">
                      <li className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full ${reviewRating > 0 ? "bg-[#dfeadb] text-[#4d6847]" : "bg-secondary"}`}>{reviewRating > 0 ? <Check size={11}/> : "1"}</span> Add an honest star rating</li>
                      <li className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full ${reviewBody.trim().length >= 5 ? "bg-[#dfeadb] text-[#4d6847]" : "bg-secondary"}`}>{reviewBody.trim().length >= 5 ? <Check size={11}/> : "2"}</span> Describe quality, comfort, or fit</li>
                      <li className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full ${reviewPhotos.length ? "bg-[#dfeadb] text-[#4d6847]" : "bg-secondary"}`}>{reviewPhotos.length ? <Check size={11}/> : "3"}</span> Photos are optional, up to two</li>
                    </ul>
                  </div>
                </aside>
                <div className="p-5 sm:p-7">
                  <fieldset>
                    <legend className="text-sm font-semibold">Your overall rating <span className="text-[#9d5f49]">*</span></legend>
                    <div className="mt-3 flex gap-2" aria-label="Product rating">
                      {[1,2,3,4,5].map((rating) => <button type="button" key={rating} onClick={() => setReviewRating(rating)} className={`grid h-12 w-12 place-items-center rounded-xl border transition ${rating <= reviewRating ? "border-[#9d7b5b] bg-[#efe1cd] text-[#9d6e43]" : "border-border bg-card text-muted-foreground hover:bg-secondary"}`} aria-label={`${rating} star${rating === 1 ? "" : "s"}`}><Star size={22} fill={rating <= reviewRating ? "currentColor" : "none"}/></button>)}
                    </div>
                  </fieldset>
                  <label className="mt-6 grid gap-2 text-sm font-semibold">Review title <span className="text-xs font-normal text-muted-foreground">Optional</span><input value={reviewTitle} onChange={(event)=>setReviewTitle(event.target.value.slice(0,120))} className="h-12 rounded-xl border border-border bg-card px-4 font-normal outline-none focus:border-foreground" placeholder="e.g. Beautiful and comfortable"/></label>
                  <label className="mt-5 grid gap-2 text-sm font-semibold">Your review <span className="text-[#9d5f49]">*</span><textarea value={reviewBody} onChange={(event)=>setReviewBody(event.target.value.slice(0,1200))} className="min-h-32 resize-y rounded-xl border border-border bg-card p-4 font-normal leading-6 outline-none focus:border-foreground" placeholder="How was the quality, comfort, size, assembly, or delivery experience?"/><span className="text-right text-[10px] font-normal text-muted-foreground">{reviewBody.length}/1200</span></label>
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Add real-life photos</p><p className="mt-1 text-xs text-muted-foreground">Up to 2 JPG, PNG, or WebP images · 5 MB each</p></div><span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold">{reviewPhotos.length}/2</span></div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:flex">
                      {reviewPhotos.map((photo,index)=><div key={photo.preview} className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary sm:h-28 sm:w-28"><img src={photo.preview} alt={`Review upload preview ${index+1}`} className="h-full w-full object-cover"/><button type="button" onClick={()=>removeReviewPhoto(index)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white" aria-label={`Remove review photo ${index+1}`}><Trash2 size={14}/></button></div>)}
                      {reviewPhotos.length < 2 && <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-[#9f978a] bg-card text-center transition hover:bg-secondary sm:h-28 sm:w-28"><span><ImagePlus className="mx-auto" size={22}/><span className="mt-2 block text-[10px] font-semibold">Add photo</span></span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event)=>{addReviewPhotos(event.target.files);event.target.value="";}}/></label>}
                    </div>
                  </div>
                  {reviewError && <div className="mt-5 rounded-xl bg-[#f4e3d5] px-4 py-3 text-xs font-medium text-[#895b45]" role="alert">{reviewError}</div>}
                  <div className="mt-7 grid gap-3 min-[420px]:grid-cols-[1fr_auto]">
                    <button type="button" onClick={()=>void submitOrderReview()} disabled={reviewSubmitting || reviewRating < 1 || reviewBody.trim().length < 5} className="min-h-12 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">{reviewSubmitting ? "Publishing your review…" : "Submit review"}</button>
                    <button type="button" onClick={clearReviewDraft} disabled={reviewSubmitting} className="min-h-12 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50">Cancel</button>
                  </div>
                  <p className="mt-4 text-[10px] leading-5 text-muted-foreground">Only delivered purchases can be reviewed. Reviews may be checked by CozyCraft before appearing publicly.</p>
                </div>
              </div>
            </div>
          </section>
        </div>, document.body)}
      {reviewSuccess && createPortal(<div className="fixed inset-0 z-[330] grid place-items-center bg-[#171614]/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="review-success-title"><section className="w-full max-w-md rounded-[1.75rem] bg-[#fbfaf7] p-7 text-center shadow-2xl sm:p-9"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e1ecdd] text-[#4e6848]"><Check size={30}/></span><p className="mt-5 text-[10px] font-bold tracking-[.18em] text-muted-foreground">REVIEW RECEIVED</p><h2 id="review-success-title" className="mt-2 font-serif text-3xl">Thank you for sharing.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your review for <b className="text-foreground">{reviewSuccess.productName}</b> was submitted successfully. {reviewSuccess.published ? "It is now visible to other shoppers." : "Our team will check it before it appears publicly."}</p><button type="button" onClick={()=>setReviewSuccess(null)} className="mt-7 min-h-12 w-full rounded-xl bg-foreground px-5 text-sm font-semibold text-background">Back to my order</button></section></div>, document.body)}
      {cancelOrderId && <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="customer-cancel-title"><section className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl"><p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">CANCELLATION REQUEST</p><h2 id="customer-cancel-title" className="mt-2 font-serif text-3xl">Request a review.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Requests are accepted within {storeSettings.fulfillment_settings.cancellation_window_hours} hours of ordering. Your order remains active until an administrator approves it; approved paid orders are safely refunded.</p><label className="mt-5 grid gap-2 text-sm font-semibold">Reason<textarea value={cancelReason} onChange={(event)=>setCancelReason(event.target.value)} minLength={5} maxLength={500} className="min-h-24 rounded-xl border border-border bg-background p-3 font-normal" placeholder="Tell us why you need to cancel" /></label><div className="mt-5 grid gap-3 min-[390px]:grid-cols-2"><button disabled={cancelSubmitting || cancelReason.trim().length < 5} onClick={()=>void submitCancellation()} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{cancelSubmitting ? "Sending request…" : "Submit request"}</button><button disabled={cancelSubmitting} onClick={()=>{setCancelOrderId(null);setCancelReason("");}} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Keep order</button></div></section></div>}
      {confirmSignOut && (
        <ConfirmSignOut
          kind="customer"
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            void signOut();
            nav("/");
          }}
        />
      )}
    </Layout>
  );
}
