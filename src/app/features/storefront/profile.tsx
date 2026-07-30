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

import { Account } from "./auth";
import regions from "@jobuntux/psgc/data/2025-2Q/regions.json";
import provinces from "@jobuntux/psgc/data/2025-2Q/provinces.json";
import municipalities from "@jobuntux/psgc/data/2025-2Q/muncities.json";

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
    userEmail,
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
  const [barangaysLoading, setBarangaysLoading] = useState(false);
  const regionOptions = useMemo(
    () =>
      [...(regions as PsgcRegion[])].sort((a, b) =>
        a.regionName.localeCompare(b.regionName),
      ),
    [],
  );
  const provinceOptions = useMemo(
    () =>
      (provinces as PsgcProvince[])
        .filter((item) => !item.cityClass)
        .sort((a, b) => a.provName.localeCompare(b.provName)),
    [],
  );
  const municipalityOptions = useMemo(
    () => {
      const [kind, code] = provinceCode.split(":");
      return (municipalities as PsgcMunicipality[])
        .filter((item) =>
          kind === "region"
            ? item.regCode === code
            : kind === "province"
              ? item.provCode === code
              : false,
        )
        .sort((a, b) => a.munCityName.localeCompare(b.munCityName));
    },
    [provinceCode],
  );
  const barangayOptions = useMemo(
    () =>
      barangays
        .filter((item) => item.munCityCode === municipalityCode)
        .sort((a, b) => a.brgyName.localeCompare(b.brgyName)),
    [barangays, municipalityCode],
  );
  useEffect(() => {
    if (!municipalityCode || barangays.length) return;
    let active = true;
    setBarangaysLoading(true);
    void import("@jobuntux/psgc/data/2025-2Q/barangays.json")
      .then((module) => {
        if (active) setBarangays(module.default as PsgcBarangay[]);
      })
      .finally(() => {
        if (active) setBarangaysLoading(false);
      });
    return () => {
      active = false;
    };
  }, [barangays.length, municipalityCode]);
  const openEditor = (address: Address) => {
    const matchedProvince = provinceOptions.find(
      (item) => item.provName === address.province,
    );
    const matchedRegion = regionOptions.find(
      (item) =>
        item.regionName === address.province ||
        regionDisplayName(item) === address.province,
    );
    const cityMatch = (municipalities as PsgcMunicipality[]).find(
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
              <option value="">Select province / region</option>
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
    addresses,
    supportTickets,
    submitTicket,
    saveProfile,
    requestEmailChange,
    confirmEmailChange,
    changePassword,
  } = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState("Profile");
  const [notice, setNotice] = useState("");
  const [ticket, setTicket] = useState("");
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [confirmProfileSave, setConfirmProfileSave] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [securityView, setSecurityView] = useState<"home" | "setup" | "change">(
    "home",
  );
  const defaultUsername =
    profileUsername.trim() || (user ?? "").trim().split(/\s+/)[0] || "";
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
    if (!username.trim()) {
      setNotice("Username is required.");
      return;
    }
    if (!fullName) {
      setNotice("Please enter your name.");
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
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setNotice("Use matching passwords with at least 8 characters.");
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
    setNotice(
      hasPassword
        ? "Password changed successfully."
        : "Your CozyCraft password is now ready.",
    );
  };
  return (
    <Layout>
      <main className="mx-auto max-w-[1320px] px-5 py-8 lg:py-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-[#f0ece4] px-7 py-8 text-foreground shadow-[0_14px_38px_rgba(35,31,27,.05)] sm:px-9">
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
                <h1 className="mt-1 font-serif text-4xl">
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
          <aside className="h-fit rounded-[1.75rem] border border-border bg-[#fbfaf7] p-3 shadow-[0_10px_30px_rgba(35,31,27,.035)]">
            <p className="px-3 py-2 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              MY ACCOUNT
            </p>
            {tabs.map((item) => (
              <button
                onClick={() => setTab(item)}
                key={item}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${tab === item ? "bg-foreground font-semibold text-background shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                {item}
                {item === "Orders" && <span className="text-xs">{orders.length}</span>}
                {item === "Change password" && <ShieldCheck size={14} />}
                {item === "Support" && <MessageCircle size={14} />}
              </button>
            ))}
            <div className="mt-3 border-t border-border pt-3">
              <Link
                to="/wishlist"
                className="flex justify-between rounded-xl px-3 py-3 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                Wishlist <span>{saved.length}</span>
              </Link>
              <Link
                to="/cart"
                className="flex justify-between rounded-xl px-3 py-3 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                My bag <span>{cart.length}</span>
              </Link>
            </div>
          </aside>
          <section className="min-h-[560px] rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_10px_30px_rgba(35,31,27,.035)] sm:p-9">
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
                {securityView === "change" || securityView === "setup" ? (
                  <form onSubmit={submitPassword} className="max-w-lg">
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      {securityView === "setup"
                        ? "SET UP PASSWORD"
                        : "CHANGE PASSWORD"}
                    </p>
                    <h2 className="mt-2 font-serif text-3xl">
                      {securityView === "setup"
                        ? "Secure your CozyCraft account."
                        : "Choose a new password."}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {securityView === "setup"
                        ? "Add a password to your Google-created account so you can also sign in with email."
                        : "Confirm your current password before choosing a new one."}
                    </p>
                    <div className="mt-7 grid gap-4">
                      {securityView === "change" && (
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
                      )}
                      <label className="grid gap-2 text-sm font-semibold">
                        New password
                        <input
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          type="password"
                          required
                          minLength={8}
                          className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none"
                          placeholder="At least 8 characters"
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
                          minLength={8}
                          className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none"
                          placeholder="Repeat new password"
                        />
                      </label>
                    </div>
                    <button className="mt-7 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">
                      {securityView === "setup"
                        ? "Set up password"
                        : "Change password"}
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
                  </div>
                )}
              </>
            )}
            {tab === "Orders" && (
              <>
                <div className="flex justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      PURCHASE HISTORY
                    </p>
                    <h2 className="mt-2 font-serif text-3xl">Your orders.</h2>
                  </div>
                  <Link
                    to="/orders"
                    className="text-xs font-semibold underline underline-offset-4"
                  >
                    Track all orders
                  </Link>
                </div>
                <div className="mt-6 grid gap-3">
                  {orders.map((order) => (
                    <Link
                      to="/orders"
                      key={order.id}
                      className="rounded-2xl border border-border p-4 hover:bg-secondary"
                    >
                      <div className="flex justify-between gap-3">
                        <b className="text-sm">Order #{order.order_number}</b>
                        <Status>
                          {order.status.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase())}
                        </Status>
                      </div>
                      <p className="mt-2 text-sm">
                        {order.order_items
                          .map((item) => `${item.product_name}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`)
                          .join(" · ")}
                      </p>
                      <p className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>{new Date(order.created_at).toLocaleDateString("en-PH")}</span>
                        <span>{money(Number(order.total))}</span>
                      </p>
                    </Link>
                  ))}
                  {!orders.length && (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Your confirmed orders will appear here.
                    </div>
                  )}
                </div>
              </>
            )}
            {tab === "Addresses" && <AddressManager notify={setNotice} />}
            {tab === "Payments" && (
              <>
                <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  PAYMENT PREFERENCES
                </p>
                <h2 className="mt-2 font-serif text-3xl">Ways to pay.</h2>
                <div className="mt-6 rounded-2xl border border-foreground bg-[#f4f0e9] p-5 ring-1 ring-foreground">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <b className="text-sm">Cash on delivery</b>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Your database-backed default payment preference.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#e3ecdf] px-3 py-2 text-[10px] font-bold text-[#56714f]">
                      {profilePaymentMethod.toUpperCase()} · ACTIVE
                    </span>
                  </div>
                </div>
                <p className="mt-4 max-w-xl text-xs leading-5 text-muted-foreground">
                  Card and GCash storage are disabled until secure payment
                  processing is added. CozyCraft does not store card numbers.
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
                <textarea
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  className="mt-6 min-h-36 w-full rounded-2xl border border-border bg-[#fcfbf8] p-4 text-sm outline-none"
                  placeholder="Include your order number and a short description of your concern."
                />
                <button
                  onClick={async () => {
                    if (!ticket) return;
                    const error = await submitTicket(ticket);
                    if (!error) setTicket("");
                    setNotice(error ?? "Support ticket sent and visible to the admin care team.");
                  }}
                  className="mt-3 rounded-xl bg-foreground px-4 py-3 text-xs font-semibold text-background"
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
