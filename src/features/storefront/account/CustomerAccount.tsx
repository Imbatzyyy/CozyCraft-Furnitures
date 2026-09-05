import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
  CircleSlash2,
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
  MonitorSmartphone,
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
  type DbBillingProfile,
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

import { Account } from "@/features/storefront/authentication/CustomerAuth";
import { isCancellationWindowOpen, isReturnWindowOpen } from "@/lib/commerce/return-workflow";
import {
  clearPendingPaymentRecovery,
  isRecoverablePendingPayment,
  pendingPaymentRecoveryEvent,
  readPendingPaymentRecovery,
  writePendingPaymentRecovery,
  type PendingPaymentRecovery,
} from "@/lib/commerce/payment-recovery";
import { isTrustedPayMongoCheckoutUrl } from "@/lib/commerce/payment-handoff";
import {
  effectiveOrderPaymentStatus,
  orderPaymentMethodLabel,
  orderPaymentReference,
} from "@/lib/commerce/order-payment";
import { findPendingPaymentRecovery } from "@/services/commerce/payment-recovery.service";
import {
  isSixDigitOtp,
  normalizePhilippineMobile,
} from "@/lib/auth/phone-verification";
import {
  loadCustomerDeviceSessions,
  markOtherCustomerSessionsRevoked,
  revokeCustomerDeviceSession,
  type CustomerDeviceSession,
} from "@/services/auth/device-session.service";

const profileTabFromSearch = (search: string) => {
  const requested = new URLSearchParams(search).get("tab")?.toLowerCase();
  if (requested === "security" || requested === "account-security") {
    return "Change password";
  }
  return (
    [
      "Profile",
      "Orders",
      "Addresses",
      "Payments",
      "Change password",
      "Support",
    ].find(
      (item) =>
        item.toLowerCase().replace(/\s+/g, "-") === requested ||
        item.toLowerCase() === requested,
    ) ?? "Profile"
  );
};

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

const paymentWindowRemaining = (order: DbOrder, now: number) => {
  if (
    !["card", "gcash"].includes(order.payment_method) ||
    order.payment_status !== "pending" ||
    order.status === "cancelled" ||
    !order.payment_expires_at
  ) return 0;
  const expiresAt = Date.parse(order.payment_expires_at);
  return Number.isFinite(expiresAt) ? Math.max(0, expiresAt - now) : 0;
};

const hasPendingOnlinePayment = (order: DbOrder) =>
  ["card", "gcash"].includes(order.payment_method) &&
  order.payment_status === "pending" &&
  order.status !== "cancelled" &&
  Boolean(order.payment_expires_at);

const paymentCountdown = (remaining: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const { userId } = useStore();
  return <CustomerProfile key={userId ?? "guest"} />;
}

function CustomerProfile() {
  const {
    userId,
    user,
    role,
    authReady,
    userEmail,
    profilePhone,
    profilePhoneVerifiedAt,
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
    refreshOrders,
    products,
    addresses,
    supportTickets,
    add,
    submitTicket,
    saveProfile,
    requestPhoneVerification,
    confirmPhoneVerification,
    requestEmailChange,
    confirmEmailChange,
    changePassword,
    requestPasswordSetup,
    refreshPasswordStatus,
    storeSettings,
    cancelOrder,
  } = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const passwordMinimum = storeSettings.account_settings.password_minimum_length;
  const [tab, setTab] = useState(() => profileTabFromSearch(location.search));
  const requestedOrderId = useMemo(
    () => new URLSearchParams(location.search).get("order") ?? "",
    [location.search],
  );
  useEffect(() => {
    setTab(profileTabFromSearch(location.search));
  }, [location.search]);
  useEffect(() => {
    setNotice("");
    setSecurityMessage(null);
    setSecurityView("home");
  }, [tab]);
  useEffect(() => {
    if (tab !== "Change password" || hasPassword !== null) return;
    void refreshPasswordStatus().then((error) => {
      if (error) setSecurityMessage({ tone: "error", text: error });
    });
  }, [hasPassword, refreshPasswordStatus, tab]);
  const [notice, setNotice] = useState("");
  const emptyBilling = useMemo<DbBillingProfile>(() => ({
    user_id: userId ?? "", recipient_name: user ?? "", company_name: "", tax_id: "",
    invoice_email: userEmail ?? "", address_line: "", barangay: "", city: "",
    province: "", postal_code: "", same_as_delivery: false,
  }), [user, userEmail, userId]);
  const [billing, setBilling] = useState<DbBillingProfile>(emptyBilling);
  const [billingSaving, setBillingSaving] = useState(false);
  const [ticket, setTicket] = useState("");
  const [ticketCategory, setTicketCategory] = useState<DbSupportTicket["category"]>("general");
  const [ticketPriority, setTicketPriority] = useState<DbSupportTicket["priority"]>("normal");
  const [ticketOrderId, setTicketOrderId] = useState("");
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [ticketSending, setTicketSending] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [confirmProfileSave, setConfirmProfileSave] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(false);
  const [phoneChallengeId, setPhoneChallengeId] = useState<string | null>(null);
  const [phoneChallengeExpiresAt, setPhoneChallengeExpiresAt] = useState<string | null>(null);
  const [phoneMasked, setPhoneMasked] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerificationError, setPhoneVerificationError] = useState("");
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneChangeActive, setPhoneChangeActive] = useState(false);
  const [phoneResendAvailableAt, setPhoneResendAvailableAt] = useState(0);
  const [phoneVerificationClock, setPhoneVerificationClock] = useState(() => Date.now());
  useEffect(() => {
    if (!phoneVerificationOpen) return;
    const timer = window.setInterval(
      () => setPhoneVerificationClock(Date.now()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [phoneVerificationOpen]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [invoiceDownloadId, setInvoiceDownloadId] = useState<string | null>(null);
  const [paymentClock, setPaymentClock] = useState(() => Date.now());
  const [pendingPaymentRecovery, setPendingPaymentRecovery] =
    useState<PendingPaymentRecovery | null>(null);
  const paymentRecoveryRequestRef = useRef<{
    userId: string;
    orderId: string;
    request: Promise<void>;
  } | null>(null);
  const activePaymentRecoveryKeyRef = useRef("");
  activePaymentRecoveryKeyRef.current = `${userId ?? ""}:${requestedOrderId}`;
  const paymentRecoveryAutoSelectedRef = useRef<string | null>(null);
  const paymentRecoveryIdentityRef = useRef<string | null>(userId);
  const [resumingPaymentId, setResumingPaymentId] = useState<string | null>(null);
  const [paymentRecoveryError, setPaymentRecoveryError] = useState("");
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
  const [reviewSuccess, setReviewSuccess] = useState<{ productName: string } | null>(null);
  const [securityView, setSecurityView] = useState<"home" | "setup" | "change">(
    "home",
  );
  const [mfaFactors, setMfaFactors] = useState<Array<{ id:string; friendly_name?:string; status:string }>>([]);
  const [mfaEnrollment, setMfaEnrollment] = useState<{ id:string; qr:string; secret:string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [passwordSetupSending, setPasswordSetupSending] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmMfaRemoval, setConfirmMfaRemoval] = useState<string | null>(null);
  const [confirmOtherSessionsSignOut, setConfirmOtherSessionsSignOut] = useState(false);
  const [confirmDeviceSignOut, setConfirmDeviceSignOut] =
    useState<CustomerDeviceSession | null>(null);
  const [deviceSessions, setDeviceSessions] = useState<CustomerDeviceSession[]>([]);
  const [deviceSessionsLoading, setDeviceSessionsLoading] = useState(false);
  const [deviceSessionActionId, setDeviceSessionActionId] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (paymentRecoveryIdentityRef.current === userId) return;
    paymentRecoveryIdentityRef.current = userId;
    paymentRecoveryRequestRef.current = null;
    paymentRecoveryAutoSelectedRef.current = null;
    setOrderFilter("all");
    setSelectedOrderId("");
    setPendingPaymentRecovery(null);
    setResumingPaymentId(null);
    setPaymentRecoveryError("");
    setPaymentClock(Date.now());
  }, [userId]);
  const defaultUsername =
    profileUsername.trim() || (user ?? "").trim().split(/\s+/)[0] || "";
  const loadBilling = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("billing_profiles").select("*").eq("user_id", userId).maybeSingle();
    setBilling(data ? (data as DbBillingProfile) : { ...emptyBilling, user_id: userId });
  }, [emptyBilling, userId]);
  useEffect(() => {
    void loadBilling();
    if (!userId) return;
    const channel = supabase.channel(`customer-billing-${userId}`).on(
      "postgres_changes", { event: "*", schema: "public", table: "billing_profiles", filter: `user_id=eq.${userId}` },
      () => void loadBilling(),
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadBilling, userId]);
  const saveBilling = async () => {
    if (!userId || !/^\S+@\S+\.\S+$/.test(billing.invoice_email)) {
      setNotice("Enter a valid invoice email address."); return;
    }
    setBillingSaving(true);
    const { created_at: _created, updated_at: _updated, ...payload } = billing;
    const { error } = await supabase.from("billing_profiles").upsert({ ...payload, user_id: userId });
    setBillingSaving(false);
    setNotice(error?.message ?? "Billing and invoice details saved securely.");
  };
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
    const { error } = await supabase.rpc("submit_order_item_review", {
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
    const productName = reviewTarget.item.product_name;
    setReviewSubmitting(false);
    await refreshReviewedOrderItems();
    clearReviewDraft();
    setReviewSuccess({ productName });
  };
  const loadMfaFactors = useCallback(async () => {
    if (!userId) { setMfaFactors([]); return; }
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setSecurityMessage({ tone: "error", text: "Authenticator status could not be loaded. Check your connection and try again." });
      return;
    }
    setMfaFactors((data?.all ?? []) as typeof mfaFactors);
  }, [userId]);
  useEffect(() => { void loadMfaFactors(); }, [loadMfaFactors]);
  const refreshDeviceSessions = useCallback(async () => {
    if (!userId) {
      setDeviceSessions([]);
      return;
    }
    setDeviceSessionsLoading(true);
    const result = await loadCustomerDeviceSessions();
    setDeviceSessionsLoading(false);
    if (result.revoked) {
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    if (result.error) {
      setSecurityMessage({
        tone: "error",
        text: "Recent devices could not be loaded. Check your connection and try again.",
      });
      return;
    }
    setDeviceSessions(result.sessions);
  }, [userId]);
  useEffect(() => {
    if (tab !== "Change password" || !userId) return;
    void refreshDeviceSessions();
  }, [refreshDeviceSessions, tab, userId]);
  const beginMfaEnrollment = async () => {
    setMfaBusy(true);
    setSecurityMessage(null);
    const { data: existingFactors, error: factorError } =
      await supabase.auth.mfa.listFactors();
    if (factorError) {
      setMfaBusy(false);
      setSecurityMessage({ tone: "error", text: "Authenticator setup could not start. Check your connection and try again." });
      return;
    }
    const verified = existingFactors?.all.find(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    );
    if (verified) {
      setMfaBusy(false);
      await loadMfaFactors();
      setSecurityMessage({ tone: "success", text: "Two-step verification is already active on this account." });
      return;
    }
    const unfinishedFactors = existingFactors?.all.filter(
      (factor) => factor.factor_type === "totp" && factor.status === "unverified",
    ) ?? [];
    for (const factor of unfinishedFactors) {
      const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (cleanupError) {
        setMfaBusy(false);
        setSecurityMessage({ tone: "error", text: "An unfinished authenticator setup could not be cleared. Refresh the page and try again." });
        return;
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType:"totp", friendlyName:"CozyCraft authenticator" });
    setMfaBusy(false);
    if (error || !data?.totp) {
      setSecurityMessage({ tone: "error", text: error?.message ?? "Authenticator setup could not start." });
      return;
    }
    setMfaEnrollment({ id:data.id, qr:data.totp.qr_code, secret:data.totp.secret });
  };
  const cancelMfaEnrollment = async () => {
    if (!mfaEnrollment || mfaBusy) return;
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaEnrollment.id });
    setMfaBusy(false);
    if (error) {
      setSecurityMessage({ tone: "error", text: "The unfinished authenticator setup could not be cleared. Refresh and try again." });
      return;
    }
    setMfaEnrollment(null);
    setMfaCode("");
    setSecurityMessage({ tone: "success", text: "Authenticator setup was cancelled. Your sign-in method was not changed." });
  };
  const verifyMfaEnrollment = async () => {
    if (!mfaEnrollment || !/^\d{6}$/.test(mfaCode)) {
      setSecurityMessage({ tone: "error", text: "Enter the six-digit code from your authenticator app." });
      return;
    }
    setMfaBusy(true);
    setSecurityMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId:mfaEnrollment.id, code:mfaCode });
    setMfaBusy(false);
    if (error) {
      setSecurityMessage({ tone: "error", text: "That authenticator code is invalid or expired. Enter the newest code from your app." });
      return;
    }
    setMfaEnrollment(null);
    setMfaCode("");
    await loadMfaFactors();
    setSecurityMessage({ tone: "success", text: "Two-step verification is now active and will be required when you sign in." });
  };
  const removeMfaFactor = async (factorId:string) => {
    setMfaBusy(true);
    setSecurityMessage(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setMfaBusy(false);
    if (error) {
      setSecurityMessage({ tone: "error", text: "Authenticator verification could not be removed. Verify your current authenticator session and try again." });
      return;
    }
    setConfirmMfaRemoval(null);
    await loadMfaFactors();
    setSecurityMessage({ tone: "success", text: "Authenticator verification was removed from this account." });
  };
  const signOutOtherDevices = async () => {
    setMfaBusy(true);
    setSecurityMessage(null);
    const { error } = await supabase.auth.signOut({ scope:"others" });
    setMfaBusy(false);
    if (error) {
      setSecurityMessage({ tone: "error", text: "Other sessions could not be signed out. Check your connection and try again." });
      return;
    }
    await markOtherCustomerSessionsRevoked();
    setConfirmOtherSessionsSignOut(false);
    await refreshDeviceSessions();
    setSecurityMessage({ tone: "success", text: "Other CozyCraft browser and device sessions have been signed out. This device remains signed in." });
  };
  const signOutDevice = async (session: CustomerDeviceSession) => {
    setDeviceSessionActionId(session.session_id);
    setSecurityMessage(null);
    const result = await revokeCustomerDeviceSession(session.session_id);
    setDeviceSessionActionId(null);
    if (result.error || !result.revoked) {
      setSecurityMessage({
        tone: "error",
        text: "That device could not be signed out. Refresh the device list and try again.",
      });
      return;
    }
    setConfirmDeviceSignOut(null);
    setDeviceSessions((current) =>
      current.filter((item) => item.session_id !== session.session_id),
    );
    setSecurityMessage({
      tone: "success",
      text: `${session.browser_label} on ${session.device_label} has been signed out of CozyCraft.`,
    });
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
    setPhoneChangeActive(false);
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
  const refreshPendingPaymentRecovery = useCallback(async () => {
    if (!authReady || !userId || tab !== "Orders") return;

    let locallySavedRecovery: PendingPaymentRecovery | null = null;
    try {
      locallySavedRecovery = readPendingPaymentRecovery(
        window.localStorage,
        userId,
      );
    } catch {
      // Private browsing and strict storage policies must not block the
      // server-backed recovery lookup below.
    }
    const relevantLocalRecovery =
      locallySavedRecovery &&
      (!requestedOrderId || locallySavedRecovery.orderId === requestedOrderId)
        ? locallySavedRecovery
        : null;
    if (relevantLocalRecovery) {
      setPendingPaymentRecovery(relevantLocalRecovery);
    } else if (requestedOrderId) {
      // Never show a different order's local recovery card while the customer
      // opened a specific order from a PayMongo return URL.
      setPendingPaymentRecovery(null);
    }

    if (
      paymentRecoveryRequestRef.current?.userId === userId &&
      paymentRecoveryRequestRef.current.orderId === requestedOrderId
    ) {
      await paymentRecoveryRequestRef.current.request;
      return;
    }

    const requestedUserId = userId;
    const requestedPaymentOrderId = requestedOrderId;
    const requestedPaymentKey = `${requestedUserId}:${requestedPaymentOrderId}`;
    const request = findPendingPaymentRecovery(
      requestedUserId,
      new Date(),
      requestedPaymentOrderId || undefined,
    )
      .then(({ recovery, error }) => {
        if (activePaymentRecoveryKeyRef.current !== requestedPaymentKey) return;
        if (error) {
          if (!relevantLocalRecovery) {
            setPaymentRecoveryError(
              "Your reserved payment could not be checked just now. Reopen this page to try again.",
            );
          }
          return;
        }

        setPaymentRecoveryError("");
        if (recovery) {
          try {
            writePendingPaymentRecovery(
              window.localStorage,
              requestedUserId,
              recovery,
            );
          } catch {
            // The server result still keeps this screen recoverable even when
            // the browser refuses persistent storage.
          }
          setPendingPaymentRecovery(recovery);
          return;
        }

        if (!requestedPaymentOrderId || relevantLocalRecovery) {
          try {
            clearPendingPaymentRecovery(window.localStorage, requestedUserId);
          } catch {
            // A stale browser marker is harmless when storage is unavailable.
          }
          setPendingPaymentRecovery(null);
        }
      })
      .finally(() => {
        if (paymentRecoveryRequestRef.current?.request === request) {
          paymentRecoveryRequestRef.current = null;
        }
      });
    paymentRecoveryRequestRef.current = {
      userId: requestedUserId,
      orderId: requestedPaymentOrderId,
      request,
    };
    await request;
  }, [authReady, requestedOrderId, tab, userId]);
  useEffect(() => {
    if (!authReady || !userId || tab !== "Orders") return;
    void refreshPendingPaymentRecovery();
    void refreshOrders().then((error) => {
      if (error) {
        setPaymentRecoveryError((current) =>
          current ||
          "Your complete order history is taking longer than expected. Any reserved payment is still available below.",
        );
      }
    });
  }, [authReady, refreshOrders, refreshPendingPaymentRecovery, tab, userId]);
  useEffect(() => {
    if (!authReady || !userId || tab !== "Orders") return;

    const retryRecovery = () => {
      // Browser Back may restore the exact React heap that was displaying
      // “Opening PayMongo…”. That navigation flag is transient and must never
      // survive a BFCache restore.
      setResumingPaymentId(null);
      void refreshPendingPaymentRecovery();
    };
    const retryFromPageShow = (event: PageTransitionEvent) => {
      retryRecovery();
      if (event.persisted) {
        // A BFCache restore can skip the normal focus transition. Refresh the
        // order graph once so a payment completed in another tab/device does
        // not leave a stale countdown or Continue button behind.
        void refreshOrders();
      }
    };
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") retryRecovery();
    };
    const retryFromRecoveryEvent = (event: Event) => {
      const eventUserId = (
        event as CustomEvent<{ userId?: string }>
      ).detail?.userId;
      if (!eventUserId || eventUserId === userId) retryRecovery();
    };

    window.addEventListener("pageshow", retryFromPageShow);
    window.addEventListener("focus", retryRecovery);
    window.addEventListener(
      pendingPaymentRecoveryEvent,
      retryFromRecoveryEvent,
    );
    document.addEventListener("visibilitychange", retryWhenVisible);
    return () => {
      window.removeEventListener("pageshow", retryFromPageShow);
      window.removeEventListener("focus", retryRecovery);
      window.removeEventListener(
        pendingPaymentRecoveryEvent,
        retryFromRecoveryEvent,
      );
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, [authReady, refreshOrders, refreshPendingPaymentRecovery, tab, userId]);
  useEffect(() => {
    if (!userId || !pendingPaymentRecovery) return;
    const matchingOrder = orders.find(
      (order) => order.id === pendingPaymentRecovery.orderId,
    );
    if (matchingOrder && !isRecoverablePendingPayment(matchingOrder)) {
      try {
        clearPendingPaymentRecovery(window.localStorage, userId);
      } catch {
        // The in-memory state below remains authoritative for this screen.
      }
      setPendingPaymentRecovery(null);
    }
  }, [orders, pendingPaymentRecovery, userId]);
  useEffect(() => {
    const orderExpiries = orders
      .filter(
        (order) =>
          ["card", "gcash"].includes(order.payment_method) &&
          order.payment_status === "pending" &&
          order.status !== "cancelled",
      )
      .map((order) => Date.parse(order.payment_expires_at ?? ""))
      .filter(Number.isFinite);
    const pendingExpiry = pendingPaymentRecovery
      ? Date.parse(pendingPaymentRecovery.expiresAt)
      : Number.NaN;
    const latestExpiry = Math.max(
      ...orderExpiries,
      ...(Number.isFinite(pendingExpiry) ? [pendingExpiry] : []),
      0,
    );
    let timer: number | undefined;
    const tick = () => {
      const currentTime = Date.now();
      setPaymentClock(currentTime);
      if (
        pendingPaymentRecovery &&
        Number.isFinite(pendingExpiry) &&
        pendingExpiry <= currentTime
      ) {
        if (userId) {
          clearPendingPaymentRecovery(window.localStorage, userId);
        }
        setPendingPaymentRecovery((current) =>
          current?.orderId === pendingPaymentRecovery.orderId ? null : current,
        );
        setResumingPaymentId((current) =>
          current === pendingPaymentRecovery.orderId ? null : current,
        );
      }
      if (timer !== undefined && latestExpiry <= currentTime) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    tick();
    if (latestExpiry > Date.now()) {
      timer = window.setInterval(tick, 1000);
    }
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [orders, pendingPaymentRecovery, userId]);
  const resumePaymentById = async (orderId: string) => {
    if (resumingPaymentId) return;
    setPaymentRecoveryError("");
    setResumingPaymentId(orderId);
    let data: Record<string, unknown> | null = null;
    let error: { message?: string } | null = null;
    try {
      const response = await supabase.functions.invoke(
        "resume-paymongo-checkout",
        { body: { orderId } },
      );
      data = (response.data as Record<string, unknown> | null) ?? null;
      error = response.error;
    } catch (resumeError) {
      setPaymentRecoveryError(
        resumeError instanceof Error
          ? resumeError.message
          : "Unable to reopen secure payment. Please try again.",
      );
      setResumingPaymentId(null);
      return;
    }
    if (error || data?.error) {
      setPaymentRecoveryError(
        typeof data?.error === "string"
          ? data.error
          : error?.message ?? "Unable to reopen secure payment. Please try again.",
      );
      setResumingPaymentId(null);
      await refreshOrders();
      return;
    }
    if (data?.paid) {
      setNotice("Payment is already confirmed. Your order is now being processed.");
      setResumingPaymentId(null);
      if (userId) {
        try {
          clearPendingPaymentRecovery(window.localStorage, userId);
        } catch {
          // Clearing browser storage is optional; the server remains the
          // source of truth for the settled order.
        }
        setPendingPaymentRecovery(null);
      }
      await refreshOrders();
      return;
    }
    if (
      typeof data?.checkoutUrl !== "string" ||
      !isTrustedPayMongoCheckoutUrl(data.checkoutUrl)
    ) {
      setPaymentRecoveryError("The secure payment link is unavailable.");
      setResumingPaymentId(null);
      return;
    }

    const returnedOrderId =
      typeof data?.orderId === "string" && data.orderId
        ? data.orderId
        : orderId;
    const returnedExpiry =
      typeof data?.expiresAt === "string" ? data.expiresAt : "";
    if (
      !userId ||
      !returnedExpiry ||
      !Number.isFinite(Date.parse(returnedExpiry)) ||
      Date.parse(returnedExpiry) <= Date.now()
    ) {
      setPaymentRecoveryError(
        "The secure payment deadline could not be restored. Please refresh your orders and try again.",
      );
      setResumingPaymentId(null);
      return;
    }
    const resumedRecovery: PendingPaymentRecovery = {
      orderId: returnedOrderId,
      orderNumber:
        typeof data?.orderNumber === "string" ? data.orderNumber : null,
      expiresAt: returnedExpiry,
    };
    try {
      writePendingPaymentRecovery(
        window.localStorage,
        userId,
        resumedRecovery,
      );
    } catch {
      // The in-memory copy and server order still provide recovery when local
      // storage is disabled.
    }
    setPendingPaymentRecovery(resumedRecovery);
    setResumingPaymentId(null);
    window.location.assign(data.checkoutUrl);
  };
  const resumePayment = (order: DbOrder) => resumePaymentById(order.id);
  const downloadInvoice = async (order: DbOrder) => {
    if (order.status !== "delivered" || invoiceDownloadId) return;
    setInvoiceDownloadId(order.id);
    setNotice("");
    try {
      const { downloadOrderInvoicePdf } = await import(
        "@/lib/commerce/order-invoice"
      );
      await downloadOrderInvoicePdf({
        order,
        billing,
        customer: {
          name: user ?? order.shipping_address.name ?? "CozyCraft customer",
          email: userEmail ?? order.shipping_address.email ?? "",
          phone: profilePhone || order.shipping_address.mobile || "",
        },
        store: storeSettings,
      });
      setNotice(`Invoice receipt for #${order.order_number} downloaded successfully.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The invoice receipt could not be prepared. Please try again.",
      );
    } finally {
      setInvoiceDownloadId(null);
    }
  };
  useEffect(() => {
    if (!visibleOrders.length) {
      setSelectedOrderId("");
      return;
    }
    if (
      requestedOrderId &&
      visibleOrders.some((order) => order.id === requestedOrderId)
    ) {
      setSelectedOrderId(requestedOrderId);
      return;
    }
    if (
      !requestedOrderId &&
      pendingPaymentRecovery &&
      paymentRecoveryAutoSelectedRef.current !==
        pendingPaymentRecovery.orderId &&
      visibleOrders.some(
        (order) => order.id === pendingPaymentRecovery.orderId,
      )
    ) {
      paymentRecoveryAutoSelectedRef.current =
        pendingPaymentRecovery.orderId;
      setSelectedOrderId(pendingPaymentRecovery.orderId);
      return;
    }
    if (!visibleOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(visibleOrders[0].id);
    }
  }, [
    pendingPaymentRecovery,
    requestedOrderId,
    selectedOrderId,
    visibleOrders,
  ]);
  useEffect(() => {
    if (!pendingPaymentRecovery) {
      paymentRecoveryAutoSelectedRef.current = null;
    }
  }, [pendingPaymentRecovery]);
  const selectedOrder =
    visibleOrders.find((order) => order.id === selectedOrderId) ??
    visibleOrders[0] ??
    null;
  const unloadedPaymentRecovery =
    pendingPaymentRecovery &&
    !orders.some((order) => order.id === pendingPaymentRecovery.orderId) &&
    Date.parse(pendingPaymentRecovery.expiresAt) > paymentClock
      ? pendingPaymentRecovery
      : null;
  const unloadedPaymentRemaining = unloadedPaymentRecovery
    ? Math.max(
        0,
        Date.parse(unloadedPaymentRecovery.expiresAt) - paymentClock,
      )
    : 0;
  if (!authReady) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-[#e9e5de] px-6 text-center"
        aria-busy="true"
        aria-live="polite"
      >
        <div>
          <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          <p className="mt-4 text-sm font-semibold text-foreground">
            Restoring your secure CozyCraft session…
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your order and payment window are being kept in place.
          </p>
        </div>
      </main>
    );
  }
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
  const normalizedDraftPhone = normalizePhilippineMobile(phone);
  const normalizedSavedPhone = normalizePhilippineMobile(profilePhone);
  const draftPhoneIsVerified = Boolean(
    profilePhoneVerifiedAt &&
      normalizedDraftPhone &&
      normalizedDraftPhone === normalizedSavedPhone,
  );
  const replacingVerifiedPhone = Boolean(
    profilePhoneVerifiedAt && phoneChangeActive,
  );
  const phoneFieldEditable = Boolean(
    profileEditing && (!profilePhoneVerifiedAt || phoneChangeActive),
  );
  const phoneChallengeRemaining = phoneChallengeExpiresAt
    ? Math.max(0, Date.parse(phoneChallengeExpiresAt) - phoneVerificationClock)
    : 0;
  const phoneResendRemaining = Math.max(
    0,
    Math.ceil((phoneResendAvailableAt - phoneVerificationClock) / 1000),
  );
  const closePhoneVerification = () => {
    if (phoneSending || phoneVerifying) return;
    setPhoneVerificationOpen(false);
    setPhoneChallengeId(null);
    setPhoneChallengeExpiresAt(null);
    setPhoneMasked("");
    setPhoneOtp("");
    setPhoneVerificationError("");
  };
  const sendPhoneVerification = async () => {
    if (!normalizedDraftPhone) {
      setNotice("Enter a valid Philippine mobile number, such as 0917 123 4567.");
      return;
    }
    setPhoneSending(true);
    setPhoneVerificationError("");
    setPhoneVerificationClock(Date.now());
    const result = await requestPhoneVerification(normalizedDraftPhone);
    setPhoneSending(false);
    if (result.error) {
      setPhoneVerificationOpen(true);
      setPhoneVerificationError(result.error);
      if (result.retryAfter > 0) {
        setPhoneResendAvailableAt(Date.now() + result.retryAfter * 1000);
      }
      return;
    }
    if (result.alreadyVerified) {
      setPhone(normalizedDraftPhone);
      setPhoneVerificationOpen(false);
      setNotice("Your mobile number is already verified.");
      return;
    }
    setPhoneChallengeId(result.challengeId);
    setPhoneChallengeExpiresAt(result.expiresAt);
    setPhoneMasked(result.maskedPhone ?? "your mobile number");
    setPhoneOtp("");
    setPhoneResendAvailableAt(
      Date.now() + Math.max(60, result.retryAfter) * 1000,
    );
    setPhoneVerificationOpen(true);
  };
  const verifyPhoneCode = async () => {
    if (!phoneChallengeId || !isSixDigitOtp(phoneOtp)) {
      setPhoneVerificationError("Enter the complete six-digit verification code.");
      return;
    }
    setPhoneVerifying(true);
    setPhoneVerificationError("");
    const result = await confirmPhoneVerification(phoneChallengeId, phoneOtp);
    setPhoneVerifying(false);
    if (result.error) {
      setPhoneVerificationError(result.error);
      return;
    }
    if (result.phone) setPhone(result.phone);
    setPhoneChangeActive(false);
    setPhoneVerificationOpen(false);
    setPhoneChallengeId(null);
    setPhoneOtp("");
    setNotice(
      replacingVerifiedPhone
        ? "Your new mobile number is verified and now registered to your account."
        : "Mobile number verified and securely saved to your account.",
    );
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
    if (phone.trim() && !normalizedDraftPhone) {
      setNotice("Enter a valid Philippine mobile number, such as 0917 123 4567.");
      return;
    }
    if (phone.trim() && !draftPhoneIsVerified) {
      setNotice("Verify your mobile number before saving your profile changes.");
      void sendPhoneVerification();
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
      setSecurityMessage({
        tone: "error",
        text: `Use matching passwords with at least ${passwordMinimum} characters, including uppercase, lowercase, a number, and a symbol.`,
      });
      return;
    }
    setSecurityMessage(null);
    const error = await changePassword(currentPassword, newPassword);
    if (error) {
      setSecurityMessage({ tone: "error", text: error });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSecurityView("home");
    setSecurityMessage({ tone: "success", text: "Your CozyCraft password was changed successfully." });
  };
  const sendPasswordSetupLink = async () => {
    setPasswordSetupSending(true);
    setSecurityMessage(null);
    const error = await requestPasswordSetup();
    setPasswordSetupSending(false);
    if (error) {
      setSecurityMessage({ tone: "error", text: error });
      return;
    }
    setSecurityView("home");
    setSecurityMessage({
      tone: "success",
      text: `A secure password setup link was sent to ${userEmail ?? "your email"}.`,
    });
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
                            else if (hasPassword === false) setAuthFailed(true);
                            else if (hasPassword === null) {
                              setNotice("Password status is still being checked. Open Account Security and try again.");
                            } else setEmailEditing(true);
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
                    <div className="grid gap-2 text-sm font-semibold">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="customer-phone">Phone number</label>
                        {draftPhoneIsVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3ecdf] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#56714f]">
                            <ShieldCheck size={12} /> Verified
                          </span>
                        ) : phone.trim() ? (
                          <span className="rounded-full bg-[#f3e5d4] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#8b5c46]">
                            Verification required
                          </span>
                        ) : null}
                      </div>
                      <div className="flex min-w-0 gap-2">
                        <input
                          id="customer-phone"
                          disabled={!phoneFieldEditable}
                          value={phone}
                          inputMode="tel"
                          autoComplete="tel"
                          onChange={(event) => {
                            setPhone(event.target.value.slice(0, 24));
                            setPhoneVerificationError("");
                          }}
                          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none transition enabled:focus:border-foreground enabled:focus:ring-4 enabled:focus:ring-[#d9c9b4]/25 disabled:cursor-default disabled:bg-secondary/40 disabled:text-muted-foreground"
                          placeholder="0917 123 4567"
                        />
                        {profileEditing && profilePhoneVerifiedAt && !phoneChangeActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhone("");
                              setPhoneChangeActive(true);
                              setPhoneVerificationError("");
                              setNotice("");
                            }}
                            className="shrink-0 rounded-xl border border-border bg-card px-4 text-xs font-semibold transition hover:bg-secondary"
                          >
                            Change number
                          </button>
                        )}
                        {profileEditing && !draftPhoneIsVerified && (!profilePhoneVerifiedAt || phoneChangeActive) && (
                          <button
                            type="button"
                            onClick={() => void sendPhoneVerification()}
                            disabled={phoneSending || !normalizedDraftPhone}
                            className="shrink-0 rounded-xl border border-foreground bg-foreground px-4 text-xs font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {phoneSending ? "Sending…" : "Verify"}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] font-normal leading-5 text-muted-foreground">
                        {replacingVerifiedPhone
                          ? "Your current verified number stays active until the replacement number passes OTP verification."
                          : draftPhoneIsVerified
                            ? "Verified for account security and delivery updates. Choose Change number to register a replacement."
                            : "We’ll send a one-time code. The number is saved only after verification."}
                      </p>
                      {replacingVerifiedPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            closePhoneVerification();
                            setPhone(profilePhone);
                            setPhoneChangeActive(false);
                            setNotice("Your existing verified mobile number was kept.");
                          }}
                          disabled={phoneSending || phoneVerifying}
                          className="w-fit text-[11px] font-semibold underline underline-offset-4 disabled:opacity-50"
                        >
                          Keep current number
                        </button>
                      )}
                    </div>
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
                        closePhoneVerification();
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
                            {hasPassword === true
                              ? "Password is set and ready to protect changes."
                              : hasPassword === false
                                ? "No password set — you signed in through Google."
                                : "Checking whether this account has a CozyCraft password…"}
                          </p>
                        </div>
                        <ShieldCheck
                          className={
                            hasPassword === true
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
                        disabled={hasPassword === null}
                        className="mt-5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold"
                      >
                        {hasPassword === null
                          ? "Checking password…"
                          : hasPassword
                            ? "Change password"
                            : "Set up a password"}
                      </button>
                    </div>
                    {storeSettings.account_settings.customer_mfa_available && <div className="mt-4 rounded-2xl border border-border p-5">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Authenticator verification</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use a rotating 6-digit code for stronger account protection.</p></div><ShieldCheck className={mfaFactors.some((factor)=>factor.status === "verified") ? "text-[#6c8364]" : "text-muted-foreground"} size={20}/></div>
                      {mfaEnrollment ? <div className="mt-5 rounded-xl bg-secondary p-4"><p className="text-xs font-semibold">Scan this QR code with Google Authenticator, 1Password, Authy, or another TOTP app.</p><img src={mfaEnrollment.qr} alt="Authenticator setup QR code" className="mt-4 h-44 w-44 rounded-lg bg-white p-2"/><details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Can’t scan the code?</summary><code className="mt-2 block break-all rounded-lg bg-card p-2 text-foreground">{mfaEnrollment.secret}</code></details><label className="mt-4 grid gap-2 text-xs font-semibold">6-digit verification code<input value={mfaCode} onChange={(event)=>setMfaCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" className="h-11 rounded-xl border border-border bg-card px-3 text-base tracking-[.3em]"/></label><div className="mt-4 flex gap-3"><button type="button" onClick={()=>void verifyMfaEnrollment()} disabled={mfaBusy || mfaCode.length!==6} className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background disabled:opacity-50">{mfaBusy ? "Verifying…" : "Verify and enable"}</button><button type="button" onClick={()=>void cancelMfaEnrollment()} disabled={mfaBusy} className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold">{mfaBusy ? "Cancelling…" : "Cancel"}</button></div></div> : mfaFactors.some((factor)=>factor.status === "verified") ? <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-[#e7eee3] p-3 text-xs text-[#50674b]"><span><b className="block">Two-step verification active</b><span className="mt-1 block">Authenticator codes are required for protected sign-in.</span></span><button type="button" disabled={mfaBusy} onClick={()=>setConfirmMfaRemoval(mfaFactors.find((factor)=>factor.status === "verified")!.id)} className="shrink-0 rounded-lg border border-[#6c8364]/40 px-3 py-2 font-semibold">Remove</button></div> : <button type="button" onClick={()=>void beginMfaEnrollment()} disabled={mfaBusy} className="mt-5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold disabled:opacity-50">{mfaBusy ? "Starting…" : "Set up authenticator"}</button>}
                    </div>}
                    <div className="mt-4 rounded-2xl border border-border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">Signed-in devices</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Review browsers recently used to access your CozyCraft account.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void refreshDeviceSessions()}
                          disabled={deviceSessionsLoading || Boolean(deviceSessionActionId)}
                          className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold disabled:opacity-50"
                        >
                          {deviceSessionsLoading ? "Refreshing…" : "Refresh"}
                        </button>
                      </div>

                      <div className="mt-5 grid gap-3">
                        {deviceSessionsLoading && deviceSessions.length === 0 ? (
                          <div className="rounded-xl bg-secondary px-4 py-5 text-center text-xs text-muted-foreground">
                            Loading recent devices…
                          </div>
                        ) : deviceSessions.length === 0 ? (
                          <div className="rounded-xl bg-secondary px-4 py-5 text-center text-xs text-muted-foreground">
                            No recent device information is available yet.
                          </div>
                        ) : (
                          deviceSessions.map((session) => (
                            <div
                              key={session.session_id}
                              className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                session.is_current
                                  ? "border-[#cbd9c6] bg-[#f3f7f1]"
                                  : "border-border bg-card"
                              }`}
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
                                  <MonitorSmartphone size={18} />
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-xs font-semibold">
                                      {session.browser_label} on {session.device_label}
                                    </p>
                                    {session.is_current && (
                                      <span className="rounded-full bg-[#dfeadb] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#50674b]">
                                        This device
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                    {session.is_current ? "Active now" : "Last active"}{" "}
                                    {!session.is_current &&
                                      new Date(session.last_seen_at).toLocaleString("en-PH", {
                                        timeZone: "Asia/Manila",
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      })}
                                  </p>
                                  {!session.is_current && (
                                    <p className="text-[10px] leading-4 text-muted-foreground/80">
                                      First seen {new Date(session.signed_in_at).toLocaleDateString("en-PH", {
                                        timeZone: "Asia/Manila",
                                        dateStyle: "medium",
                                      })}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {!session.is_current && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeviceSignOut(session)}
                                  disabled={Boolean(deviceSessionActionId)}
                                  className="w-full shrink-0 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold transition hover:bg-secondary disabled:opacity-50 sm:w-auto"
                                >
                                  Sign out
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {deviceSessions.some((session) => !session.is_current) && (
                        <button
                          type="button"
                          onClick={() => setConfirmOtherSessionsSignOut(true)}
                          disabled={mfaBusy || Boolean(deviceSessionActionId)}
                          className="mt-5 w-full rounded-xl border border-border px-4 py-2.5 text-xs font-semibold disabled:opacity-50 sm:w-auto"
                        >
                          Sign out all other devices
                        </button>
                      )}
                      <p className="mt-4 text-[10px] leading-4 text-muted-foreground">
                        For privacy, CozyCraft stores only a general device and browser label. No IP address or full browser fingerprint is saved.
                      </p>
                    </div>
                    </div>
                )}
                {securityMessage && (
                  <p role={securityMessage.tone === "error" ? "alert" : "status"} className={`mt-5 flex max-w-lg items-start gap-2 rounded-xl border p-3 text-xs font-semibold leading-5 ${securityMessage.tone === "error" ? "border-[#e6c9b8] bg-[#f8ebe2] text-[#8b5c46]" : "border-[#cbd9c6] bg-[#e7eee3] text-[#50674b]"}`}>
                    {securityMessage.tone === "success" ? <Check size={16} className="mt-0.5 shrink-0" /> : <CircleSlash2 size={16} className="mt-0.5 shrink-0" />}
                    {securityMessage.text}
                  </p>
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
                {unloadedPaymentRecovery && (
                  <section className="mt-5 rounded-2xl border border-[#d8c8ad] bg-[#f7f1e7] p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold tracking-[.16em] text-[#7b684d]">RESTORING RESERVED ORDER</p>
                        <h3 className="mt-2 font-serif text-2xl">
                          #{unloadedPaymentRecovery.orderNumber ?? "Pending payment"}
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-[#75654f]">
                          Your order is saved in Supabase. Its complete details are still loading, but secure payment can continue now.
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                        <time className="font-mono text-xl font-semibold tabular-nums text-[#4f4334]" dateTime={unloadedPaymentRecovery.expiresAt}>
                          {paymentCountdown(unloadedPaymentRemaining)}
                        </time>
                        <button
                          type="button"
                          onClick={() => void resumePaymentById(unloadedPaymentRecovery.orderId)}
                          disabled={resumingPaymentId === unloadedPaymentRecovery.orderId}
                          className="min-h-11 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background disabled:cursor-wait disabled:opacity-60"
                        >
                          {resumingPaymentId === unloadedPaymentRecovery.orderId ? "Opening PayMongo…" : "Continue payment"}
                        </button>
                      </div>
                    </div>
                    {paymentRecoveryError && (
                      <p className="mt-3 rounded-xl bg-[#f2e4d8] px-3 py-2 text-xs font-semibold text-[#855b45]">{paymentRecoveryError}</p>
                    )}
                  </section>
                )}
                {!selectedOrder ? (
                  unloadedPaymentRecovery ? null : (
                    <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center">
                    <Package className="mx-auto text-muted-foreground" size={23} />
                    <p className="mt-3 text-sm font-semibold">No orders in this status.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Orders will move here automatically as CozyCraft updates fulfillment.
                    </p>
                    </div>
                  )
                ) : (
                  <div className="mt-5 grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
                    <div className="max-h-[630px] space-y-2 overflow-y-auto pr-1">
                      {visibleOrders.map((order) => {
                        const remaining = paymentWindowRemaining(order, paymentClock);
                        return (
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
                          {remaining > 0 && (
                            <span className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#d8c8ad] bg-[#f7f1e7] px-3 py-2 text-[10px] font-semibold text-[#67563f]">
                              <span className="flex items-center gap-1.5"><Clock size={11} /> Payment reserved</span>
                              <time dateTime={order.payment_expires_at ?? undefined} className="tabular-nums">
                                {paymentCountdown(remaining)}
                              </time>
                            </span>
                          )}
                          {order.cancellation_status && <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${order.cancellation_status === "pending" ? "bg-[#f2e8d7] text-[#765d3c]" : order.cancellation_status === "approved" ? "bg-[#e5eee1] text-[#45603f]" : "bg-secondary text-muted-foreground"}`}><Clock size={11}/> Cancellation {order.cancellation_status}</span>}
                        </button>
                        );
                      })}
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
                      {paymentWindowRemaining(selectedOrder, paymentClock) > 0 && (
                        <div className="border-b border-[#dfd2bd] bg-[#f7f1e7] p-4 sm:p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold tracking-[.16em] text-[#7b684d]">PAYMENT RESERVED</p>
                              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <b className="text-sm">Complete your {selectedOrder.payment_method === "gcash" ? "GCash" : "card"} payment</b>
                                <time
                                  dateTime={selectedOrder.payment_expires_at ?? undefined}
                                  className="font-mono text-lg font-semibold tabular-nums text-[#4f4334]"
                                  aria-label={`${paymentCountdown(paymentWindowRemaining(selectedOrder, paymentClock))} remaining`}
                                >
                                  {paymentCountdown(paymentWindowRemaining(selectedOrder, paymentClock))}
                                </time>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-[#75654f]">
                                Your items remain reserved. This same deadline appears on every device signed in to your account.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void resumePayment(selectedOrder)}
                              disabled={resumingPaymentId === selectedOrder.id}
                              className="min-h-11 shrink-0 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                            >
                              {resumingPaymentId === selectedOrder.id ? "Opening PayMongo…" : "Continue payment"}
                            </button>
                          </div>
                          {paymentRecoveryError && (
                            <p className="mt-3 rounded-xl bg-[#f2e4d8] px-3 py-2 text-xs font-semibold text-[#855b45]">
                              {paymentRecoveryError}
                            </p>
                          )}
                        </div>
                      )}
                      {hasPendingOnlinePayment(selectedOrder) && paymentWindowRemaining(selectedOrder, paymentClock) === 0 && (
                        <div className="border-b border-border bg-secondary px-4 py-3 text-xs text-muted-foreground sm:px-5">
                          <b className="text-foreground">Payment window ended.</b>{" "}
                          This order will close automatically and its reserved stock will return to the catalog.
                        </div>
                      )}
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
                          <p className="mt-2 text-xs">
                            {orderPaymentMethodLabel(selectedOrder.payment_method)} · <span className="capitalize">{effectiveOrderPaymentStatus(selectedOrder)}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Reference {orderPaymentReference(selectedOrder)}</p>
                          <dl className="mt-3 grid gap-1.5 text-xs">
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(Number(selectedOrder.subtotal))}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Delivery</dt><dd>{Number(selectedOrder.delivery_fee) > 0 ? money(Number(selectedOrder.delivery_fee)) : "Free"}</dd></div>
                            {Number(selectedOrder.reward_discount ?? 0) > 0 && <div className="flex justify-between gap-3 text-[#56714f]"><dt>Home Circle reward</dt><dd>-{money(Number(selectedOrder.reward_discount))}</dd></div>}
                            <div className="flex justify-between gap-3 border-t border-border pt-2 text-sm font-semibold"><dt>Total</dt><dd>{money(Number(selectedOrder.total))}</dd></div>
                          </dl>
                        </div>
                      </div>
                      {selectedOrder.status === "delivered" && (
                        <section className="border-t border-border bg-[#f7f2e9] p-5" aria-labelledby="digital-invoice-title">
                          <div className="flex flex-col gap-4 rounded-2xl border border-[#d8cdbd] bg-[#fcfbf8] p-4 shadow-[0_8px_24px_rgba(44,39,32,.05)] sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-foreground text-background"><FileText size={17}/></span>
                              <div>
                                <p className="text-[9px] font-bold tracking-[.15em] text-muted-foreground">DELIVERED ORDER</p>
                                <h4 id="digital-invoice-title" className="mt-1 text-sm font-semibold">Your digital invoice receipt is ready.</h4>
                                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">A portrait PDF with your items, exact delivery fee, discounts, payment record, and delivery details.</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void downloadInvoice(selectedOrder)}
                              disabled={invoiceDownloadId === selectedOrder.id}
                              className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:translate-y-0 disabled:opacity-60"
                            >
                              {invoiceDownloadId === selectedOrder.id ? (
                                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-background/35 border-t-background"/> Preparing PDF…</>
                              ) : (
                                <><Download size={14}/> Download PDF</>
                              )}
                            </button>
                          </div>
                        </section>
                      )}
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
                            setTicketOrderId(selectedOrder.id);
                            setTicketCategory("order");
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
                        {selectedOrder.status === "shipped" && <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-muted-foreground min-[390px]:col-span-2 sm:col-auto"><Package size={14}/> Cancellation unavailable</span>}
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
                <div className="mt-8 border-t border-border pt-7">
                  <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">BILLING & INVOICES</p>
                  <h3 className="mt-2 font-serif text-2xl">Invoice details.</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">These details belong only to your account and are protected by database row-level security. Payment credentials are never stored here.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {([
                      ["Recipient name", "recipient_name"], ["Invoice email", "invoice_email"],
                      ["Company (optional)", "company_name"], ["Tax ID (optional)", "tax_id"],
                      ["Billing address", "address_line"], ["Barangay", "barangay"],
                      ["City / municipality", "city"], ["Province / region", "province"],
                      ["Postal code", "postal_code"],
                    ] as Array<[string, keyof DbBillingProfile]>).map(([label, key]) => (
                      <label key={key} className={`grid gap-2 text-xs font-semibold ${key === "address_line" ? "sm:col-span-2" : ""}`}>{label}<input value={String(billing[key] ?? "")} onChange={(event) => setBilling((current) => ({ ...current, [key]: event.target.value }))} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal outline-none focus:ring-2 focus:ring-foreground/15" /></label>
                    ))}
                    <label className="flex items-center gap-3 rounded-xl border border-border p-4 text-xs font-semibold sm:col-span-2"><input type="checkbox" checked={billing.same_as_delivery} onChange={(event) => setBilling((current) => ({ ...current, same_as_delivery: event.target.checked }))} className="h-5 w-5 accent-foreground" />Use my default delivery address for billing</label>
                  </div>
                  <button type="button" onClick={() => void saveBilling()} disabled={billingSaving} className="mt-4 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background disabled:opacity-50">{billingSaving ? "Saving details…" : "Save billing details"}</button>
                </div>
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
                    if (ticketSending) return;
                    if (ticket.trim().length < 10) { setNotice("Please describe your concern in at least 10 characters."); return; }
                    setTicketSending(true);
                    try {
                      const error = await submitTicket({message:ticket,category:ticketCategory,priority:ticketPriority,orderId:ticketOrderId,files:ticketFiles});
                      if (!error) {setTicket((current)=>current===ticket?"":current);setTicketFiles([]);setTicketOrderId("");}
                      setNotice(error ?? "Support ticket sent and visible to the admin care team.");
                    } catch { setNotice("Your ticket could not be sent. Your message is still here; please try again."); }
                    finally { setTicketSending(false); }
                  }}
                  disabled={ticketSending || ticket.trim().length < 10}
                  className="mt-3 rounded-xl bg-foreground px-4 py-3 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {ticketSending ? "Sending ticket…" : "Send support ticket"}
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
            {tab !== "Change password" && notice && (
              <p className="mt-5 flex items-center gap-2 text-sm text-[#5b744f]">
                <Check size={16} />
                {notice}
              </p>
            )}
          </section>
        </div>
      </main>
      {phoneVerificationOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="phone-verification-title"
          className="fixed inset-0 z-[145] grid place-items-center bg-[#1f1e1b]/65 p-4 backdrop-blur-sm"
        >
          <section className="w-full max-w-[28rem] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_30px_90px_rgba(20,18,15,.28)] sm:rounded-[2rem]">
            <div className="flex items-start justify-between gap-5 border-b border-border px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9e2d7] text-foreground">
                  <ShieldCheck size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                    SECURE VERIFICATION
                  </p>
                  <h2 id="phone-verification-title" className="mt-1 font-serif text-2xl sm:text-3xl">
                    {replacingVerifiedPhone ? "Verify your new number." : "Confirm your number."}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={closePhoneVerification}
                disabled={phoneSending || phoneVerifying}
                aria-label="Close phone verification"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border transition hover:bg-secondary disabled:opacity-40"
              >
                <X size={17} />
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void verifyPhoneCode();
              }}
              className="px-5 py-6 sm:px-7 sm:py-7"
            >
              {phoneChallengeId ? (
                <>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Enter the six-digit code sent to <b className="text-foreground">{phoneMasked}</b>.
                    It expires in five minutes.
                    {replacingVerifiedPhone && " Your current number will remain registered until this code is confirmed."}
                  </p>
                  <label className="mt-6 grid gap-2 text-xs font-semibold" htmlFor="phone-otp">
                    Verification code
                    <input
                      id="phone-otp"
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={phoneOtp}
                      onChange={(event) => {
                        setPhoneOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                        setPhoneVerificationError("");
                      }}
                      className="h-14 rounded-xl border border-border bg-[#fcfbf8] px-4 text-center font-mono text-xl tracking-[.42em] outline-none transition focus:border-foreground focus:ring-4 focus:ring-[#d9c9b4]/25"
                      placeholder="000000"
                    />
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>{phoneChallengeRemaining > 0 ? `Expires in ${paymentCountdown(phoneChallengeRemaining)}` : "Code expired"}</span>
                    <button
                      type="button"
                      onClick={() => void sendPhoneVerification()}
                      disabled={phoneSending || phoneResendRemaining > 0}
                      className="font-semibold text-foreground underline underline-offset-4 disabled:no-underline disabled:opacity-45"
                    >
                      {phoneSending
                        ? "Sending…"
                        : phoneResendRemaining > 0
                          ? `Resend in ${phoneResendRemaining}s`
                          : "Resend code"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-3 text-center">
                  {phoneSending ? (
                    <>
                      <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                      <p className="mt-4 text-sm text-muted-foreground">Preparing your secure verification…</p>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void sendPhoneVerification()}
                      disabled={phoneResendRemaining > 0}
                      className="rounded-xl border border-border px-5 py-3 text-sm font-semibold disabled:opacity-45"
                    >
                      {phoneResendRemaining > 0
                        ? `Try again in ${phoneResendRemaining}s`
                        : "Try sending again"}
                    </button>
                  )}
                </div>
              )}
              {phoneVerificationError && (
                <p role="alert" className="mt-5 rounded-xl border border-[#e6c9b8] bg-[#f8ebe2] p-3 text-xs font-semibold leading-5 text-[#8b5c46]">
                  {phoneVerificationError}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  !phoneChallengeId ||
                  !isSixDigitOtp(phoneOtp) ||
                  phoneChallengeRemaining <= 0 ||
                  phoneVerifying
                }
                className="mt-6 w-full rounded-xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {phoneVerifying
                  ? "Checking code…"
                  : replacingVerifiedPhone
                    ? "Verify and replace number"
                    : "Verify and save number"}
              </button>
              <p className="mt-4 text-center text-[10px] leading-4 text-muted-foreground">
                CozyCraft will never ask you to share this code with another person.
              </p>
            </form>
          </section>
        </div>
      )}
      {confirmMfaRemoval && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-authenticator-title"
          className="fixed inset-0 z-[150] grid place-items-center bg-black/55 p-5 backdrop-blur-sm"
        >
          <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f3e5d4] text-[#8b5c46]">
              <ShieldCheck size={18} />
            </span>
            <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              ACCOUNT PROTECTION
            </p>
            <h2 id="remove-authenticator-title" className="mt-2 font-serif text-3xl">
              Remove two-step verification?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Future sign-ins will no longer require a code from your authenticator app. Your password and other account information will not be changed.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmMfaRemoval(null)}
                disabled={mfaBusy}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Keep protection
              </button>
              <button
                type="button"
                onClick={() => void removeMfaFactor(confirmMfaRemoval)}
                disabled={mfaBusy}
                className="flex-1 rounded-xl bg-[#8b5c46] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {mfaBusy ? "Removing…" : "Remove authenticator"}
              </button>
            </div>
          </section>
        </div>
      )}
      {confirmOtherSessionsSignOut && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-out-devices-title"
          className="fixed inset-0 z-[150] grid place-items-center bg-black/55 p-5 backdrop-blur-sm"
        >
          <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary">
              <LogOut size={18} />
            </span>
            <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              SESSION SECURITY
            </p>
            <h2 id="sign-out-devices-title" className="mt-2 font-serif text-3xl">
              Sign out other devices?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              CozyCraft will revoke every other browser and device session. This current device will remain signed in.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOtherSessionsSignOut(false)}
                disabled={mfaBusy}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void signOutOtherDevices()}
                disabled={mfaBusy}
                className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-50"
              >
                {mfaBusy ? "Signing out…" : "Sign out other devices"}
              </button>
            </div>
          </section>
        </div>
      )}
      {confirmDeviceSignOut && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-out-device-title"
          className="fixed inset-0 z-[151] grid place-items-center bg-black/55 p-5 backdrop-blur-sm"
        >
          <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary">
              <MonitorSmartphone size={18} />
            </span>
            <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              DEVICE SECURITY
            </p>
            <h2 id="sign-out-device-title" className="mt-2 font-serif text-3xl">
              Sign out this device?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {confirmDeviceSignOut.browser_label} on {confirmDeviceSignOut.device_label} will lose access to your CozyCraft account. Your current browser will stay signed in.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmDeviceSignOut(null)}
                disabled={Boolean(deviceSessionActionId)}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Keep device
              </button>
              <button
                type="button"
                onClick={() => void signOutDevice(confirmDeviceSignOut)}
                disabled={Boolean(deviceSessionActionId)}
                className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-50"
              >
                {deviceSessionActionId ? "Signing out…" : "Sign out device"}
              </button>
            </div>
          </section>
        </div>
      )}
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
                  <p className="mt-4 text-[10px] leading-5 text-muted-foreground">Only delivered purchases can be reviewed. Your review appears publicly as soon as it is submitted. CozyCraft may hide content later only when it violates our content standards.</p>
                </div>
              </div>
            </div>
          </section>
        </div>, document.body)}
      {reviewSuccess && createPortal(<div className="fixed inset-0 z-[330] grid place-items-center bg-[#171614]/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="review-success-title"><section className="w-full max-w-md rounded-[1.75rem] bg-[#fbfaf7] p-7 text-center shadow-2xl sm:p-9"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e1ecdd] text-[#4e6848]"><Check size={30}/></span><p className="mt-5 text-[10px] font-bold tracking-[.18em] text-muted-foreground">REVIEW PUBLISHED</p><h2 id="review-success-title" className="mt-2 font-serif text-3xl">Thank you for sharing.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your review for <b className="text-foreground">{reviewSuccess.productName}</b> is now visible to other shoppers.</p><button type="button" onClick={()=>setReviewSuccess(null)} className="mt-7 min-h-12 w-full rounded-xl bg-foreground px-5 text-sm font-semibold text-background">Back to my order</button></section></div>, document.body)}
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
