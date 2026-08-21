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
import {
  isExistingAccountSignUpResult,
  signInForPortal,
} from "@/services/auth/auth.service";
import {
  COZYCRAFT_PRIVACY_EMAIL,
  CUSTOMER_POLICY_EFFECTIVE_DATE,
  CUSTOMER_POLICY_VERSION,
  CUSTOMER_PRIVACY_SECTIONS,
  CUSTOMER_TERMS_SECTIONS,
  type CustomerPolicyKind,
} from "@/lib/legal/customer-policies";

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

function CustomerPolicyDialog({
  policy,
  onClose,
  onSwitch,
}: {
  policy: CustomerPolicyKind;
  onClose: () => void;
  onSwitch: (policy: CustomerPolicyKind) => void;
}) {
  const isPrivacy = policy === "privacy";
  const sections = isPrivacy
    ? CUSTOMER_PRIVACY_SECTIONS
    : CUSTOMER_TERMS_SECTIONS;
  const title = isPrivacy ? "Privacy Policy" : "Terms of Use";
  const alternate = isPrivacy ? "Terms of Use" : "Privacy Policy";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#171613]/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`customer-${policy}-title`}
        className="flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-white/25 bg-[#f8f6f1] shadow-[0_32px_100px_rgba(18,17,14,.35)] sm:h-[min(820px,calc(100dvh-40px))] sm:rounded-[2rem]"
      >
        <header className="relative overflow-hidden border-b border-black/10 bg-[#23231f] px-6 py-6 text-white sm:px-9 sm:py-8">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[46px] border-white/[.045]" />
          <div className="relative flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d8c5a8] text-[#24231f]">
                  {isPrivacy ? <ShieldCheck size={18} /> : <FileText size={18} />}
                </span>
                <p className="text-[10px] font-bold uppercase tracking-[.24em] text-white/55">
                  CozyCraft customer agreement
                </p>
              </div>
              <h2
                id={`customer-${policy}-title`}
                className="mt-6 font-serif text-4xl leading-none tracking-[-.035em] sm:text-5xl"
              >
                {title}
              </h2>
              <p className="mt-3 text-xs leading-5 text-white/58">
                Version {CUSTOMER_POLICY_VERSION} · Effective {CUSTOMER_POLICY_EFFECTIVE_DATE}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-7 sm:px-9 sm:py-9">
          <div className="mx-auto max-w-3xl">
            <p className="border-l-2 border-[#9b8062] pl-5 text-sm leading-7 text-black/60 sm:text-base sm:leading-8">
              {isPrivacy
                ? "This notice explains how CozyCraft Furnitures handles customer information under the Philippine Data Privacy Act of 2012 and related rules. Please read it before creating an account."
                : "These terms set the rules for creating an account and using CozyCraft’s shopping, payment, delivery, review, and support services in the Philippines."}
            </p>
            <div className="mt-9 divide-y divide-black/10 border-y border-black/10">
              {sections.map((section, index) => (
                <article
                  className="grid gap-3 py-7 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-5"
                  key={section.title}
                >
                  <span className="font-serif text-2xl text-black/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold tracking-[-.01em] sm:text-base">
                      {section.title}
                    </h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-black/58">
                      {section.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <aside className="mt-8 rounded-[1.25rem] bg-[#e9e1d5] p-5 text-xs leading-6 text-black/58 sm:p-6">
              <b className="block text-black/80">Questions before you continue?</b>
              Contact CozyCraft at{" "}
              <a className="font-semibold text-black underline underline-offset-4" href={`mailto:${COZYCRAFT_PRIVACY_EMAIL}`}>
                {COZYCRAFT_PRIVACY_EMAIL}
              </a>
              . Privacy complaints may also be filed with the Philippine National Privacy Commission.
            </aside>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-black/10 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-9">
          <button
            type="button"
            onClick={() => onSwitch(isPrivacy ? "terms" : "privacy")}
            className="min-h-11 px-2 text-xs font-bold text-black/60 underline underline-offset-4 transition hover:text-black"
          >
            Read the {alternate}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full bg-[#23231f] px-7 text-xs font-bold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Close document
          </button>
        </footer>
      </section>
    </div>
  );
}


export function Account({ mode }: { mode: "login" | "signup" }) {
  const { authReady, user, role, signOut, storeSettings } = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<
    "auth" | "forgot" | "sent" | "verify"
  >("auth");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [policyDialog, setPolicyDialog] = useState<CustomerPolicyKind | null>(null);
  const [error, setError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const customerDestination = useMemo(() => {
    const requested = new URLSearchParams(location.search).get("next");
    if (requested?.startsWith("/") && !requested.startsWith("//")) {
      return requested;
    }
    // Account can also be rendered as a signed-out fallback inside Profile.
    // Preserve its exact Orders/payment query instead of stripping it once the
    // restored session becomes available.
    if (location.pathname === "/profile") {
      return `${location.pathname}${location.search}`;
    }
    return "/profile";
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("reason") === "invalid-login") {
      setError("Incorrect email or password. Please check your credentials.");
    }
  }, [location.search]);
  useEffect(() => {
    if (!authReady || !user || !role) return;
    if (role === "customer") {
      nav(customerDestination, { replace: true });
      return;
    }
    void signOut().then(() => {
      setError("Incorrect email or password. Please check your credentials.");
    });
  }, [authReady, customerDestination, nav, role, signOut, user]);
  const passwordMinimum = storeSettings.account_settings.password_minimum_length;
  const score = [
    password.length >= passwordMinimum,
    password.length >= Math.max(12, passwordMinimum + 4),
    /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const strength = password
    ? score === 3
      ? "Strong"
      : score === 2
        ? "Fair"
        : "Weak"
    : "";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setVerificationNotice("");
    if (mode === "signup" && password !== confirm) { setError("Passwords do not match. Please try again."); return; }
    if (mode === "signup" && score < 2) { setError("Choose a stronger password before creating your account."); return; }
    if (mode === "signup" && storeSettings.account_settings.username_required && !/^[A-Za-z0-9._-]{3,24}$/.test(username.trim())) { setError("Username must be 3–24 characters using letters, numbers, dots, underscores, or hyphens."); return; }
    if (mode === "signup" && !acceptedPolicies) { setError("Please agree to the Terms of Use and confirm that you have read the Privacy Policy before creating your account."); return; }
    setSubmitting(true);
    if (mode === "login") {
      const result = await signInForPortal(email, password, "customer");
      setSubmitting(false);
      if (!result.ok) {
        setError(
          result.error ??
            "Sign in failed. Please check your credentials and try again.",
        );
        return;
      }
      nav(customerDestination);
      return;
    }
    const result = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: (first + " " + last).trim(),
          username: username.trim(),
          customer_policy_accepted: true,
          terms_version: CUSTOMER_POLICY_VERSION,
          privacy_version: CUSTOMER_POLICY_VERSION,
          policy_accepted_at: new Date().toISOString(),
          policy_acceptance_source: "web_email_signup",
        },
        emailRedirectTo: window.location.origin + "/profile",
      },
    });
    setSubmitting(false);
    if (isExistingAccountSignUpResult(result)) {
      setError(
        "An account with this email already exists. Sign in instead or reset your password.",
      );
      return;
    }
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setView("verify");
      return;
    }
    nav("/profile");
  };
  const google = async () => {
    setError("");
    if (mode === "signup" && !acceptedPolicies) {
      setError("Please agree to the Terms of Use and confirm that you have read the Privacy Policy before continuing with Google.");
      window.requestAnimationFrame(() => {
        document
          .getElementById("customer-policy-acceptance")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("customer-policy-acceptance")?.focus();
      });
      return;
    }
    window.sessionStorage.setItem("cozycraft-google-sign-in-pending", "1");
    if (mode === "signup") {
      window.sessionStorage.setItem(
        "cozycraft-policy-consent-pending",
        JSON.stringify({
          termsVersion: CUSTOMER_POLICY_VERSION,
          privacyVersion: CUSTOMER_POLICY_VERSION,
          source: "web_google_signup",
        }),
      );
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/home" },
    });
    if (error) {
      window.sessionStorage.removeItem("cozycraft-google-sign-in-pending");
      window.sessionStorage.removeItem("cozycraft-policy-consent-pending");
      setError(error.message);
    }
  };
  if (view !== "auth")
    return (
      <main className="min-h-dvh overflow-y-auto bg-[#e9e5de] p-3 sm:p-5">
        <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-[1500px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-card p-5 shadow-[0_24px_80px_rgba(50,42,34,.12)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:p-6">
          <section className="auth-fixed-form w-full max-w-md">
            <button
              onClick={() => setView("auth")}
              className="text-xs font-semibold underline underline-offset-4"
            >
              ← Back to sign in
            </button>
            {view === "forgot" ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const { error } =
                    await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo:
                        window.location.origin + "/reset-password",
                    });
                  if (error) setError(error.message); else setView("sent");
                }}
                className="mt-10"
              >
                <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  PASSWORD RESET
                </p>
                <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
                  Let’s get you back in.
                </h1>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Enter your account email and we will send a secure reset link.
                  We will email a secure reset link to your account.
                </p>
                <label className="mt-8 grid gap-2 text-sm font-semibold">
                  Email address
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                    placeholder="you@email.com"
                    className="h-12 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none focus:border-foreground"
                  />
                </label>
                <button className="mt-6 h-12 w-full rounded-xl bg-foreground text-sm font-semibold text-background">
                  Send reset link
                </button>
              </form>
            ) : view === "verify" ? (
              <div className="mt-10 rounded-3xl bg-[#eee8df] p-7">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e3ecdf] text-[#56714f]">
                  <Check size={20} />
                </span>
                <p className="mt-6 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  CONFIRM YOUR EMAIL
                </p>
                <h1 className="mt-3 font-serif text-4xl">One last step.</h1>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  We sent a confirmation link to <b>{email}</b>. Please verify
                  your email before signing in to CozyCraft.
                </p>
                {error && (
                  <p className="mt-4 rounded-xl bg-[#f3e5d4] px-3 py-2 text-xs font-semibold text-[#8b5c46]">
                    {error}
                  </p>
                )}
                {verificationNotice && (
                  <p className="mt-4 rounded-xl bg-[#e3ecdf] px-3 py-2 text-xs font-semibold text-[#56714f]">
                    {verificationNotice}
                  </p>
                )}
                <button
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setError("");
                    setVerificationNotice("");
                    const {
                      data: { user: confirmedUser },
                      error: confirmationError,
                    } = await supabase.auth.getUser();
                    setSubmitting(false);
                    if (confirmationError || !confirmedUser) {
                      setError(
                        "We have not detected your confirmation yet. Open the link in your email, then try again.",
                      );
                      return;
                    }
                    nav("/profile");
                  }}
                  className="mt-6 w-full rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60"
                >
                  {submitting
                    ? "Checking confirmation…"
                    : "I confirmed my email"}
                </button>
                <button
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setError("");
                    setVerificationNotice("");
                    const { error: resendError } = await supabase.auth.resend({
                      type: "signup",
                      email,
                      options: {
                        emailRedirectTo:
                          window.location.origin + "/profile",
                      },
                    });
                    setSubmitting(false);
                    if (resendError) setError(resendError.message);
                    else
                      setVerificationNotice(
                        "A new confirmation email has been sent.",
                      );
                  }}
                  className="mt-3 w-full text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-60"
                >
                  Resend confirmation email
                </button>
                <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                  For your security, account access begins only after Supabase
                  confirms the email link.
                </p>
              </div>
            ) : (
              <div className="mt-10 rounded-3xl bg-[#eee8df] p-7">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e3ecdf] text-[#56714f]">
                  <Check size={20} />
                </span>
                <p className="mt-6 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  CHECK YOUR EMAIL
                </p>
                <h1 className="mt-3 font-serif text-4xl">Reset link sent.</h1>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  If an account exists for <b>{email || "that email"}</b>, a
                  password-reset link is on its way. Follow the link in the email, then return here to sign in.
                </p>
                <button
                  onClick={() => setView("auth")}
                  className="mt-6 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background"
                >
                  Return to sign in
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  return (
    <main className="min-h-dvh bg-[#e9e5de] sm:p-4 xl:h-dvh xl:overflow-hidden xl:p-5">
      {policyDialog && (
        <CustomerPolicyDialog
          policy={policyDialog}
          onClose={() => setPolicyDialog(null)}
          onSwitch={setPolicyDialog}
        />
      )}
      <div className="mx-auto grid min-h-dvh max-w-[1580px] overflow-hidden bg-card shadow-[0_24px_80px_rgba(50,42,34,.12)] sm:min-h-[calc(100dvh-2rem)] sm:rounded-[2rem] xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1.04fr)_minmax(520px,.96fr)]">
        <section className="relative hidden min-h-0 overflow-hidden bg-[#24211e] p-10 text-[#f4f2ee] xl:flex xl:flex-col xl:justify-between 2xl:p-14">
          <div className="absolute inset-0 opacity-35">
            <ResilientImage
              src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1300&q=80"
              alt="Warm CozyCraft interior"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-[#201e1b]/55" />
          <div className="relative">
            <Logo light />
          </div>
          <div className="relative max-w-xl">
            <p className="text-[10px] font-bold tracking-[.22em] text-white/60">
              COZYCRAFT / MEMBERS
            </p>
            <h1 className="mt-6 font-serif text-[clamp(3.5rem,4vw,5.25rem)] leading-[.96] tracking-[-.035em]">
              A home for the things you love.
            </h1>
            <p className="mt-7 max-w-sm text-sm leading-7 text-white/75">
              Save the pieces you return to, revisit your selections, and keep
              every order close at hand.
            </p>
          </div>
          <p className="relative text-xs text-white/60">
            Thoughtful furniture, delivered with care.
          </p>
        </section>
        <section className="flex min-h-0 justify-center overflow-y-auto px-5 py-7 sm:px-9 sm:py-9 lg:px-12 xl:px-10 xl:py-8 2xl:px-16">
          <form onSubmit={submit} className="auth-fixed-form my-auto w-full max-w-xl">
            <div className="mb-5 xl:hidden">
              <Logo />
            </div>
            <div className="flex items-center justify-between">
              <p className="rounded-full bg-secondary px-3 py-1.5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                {mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
              </p>
              <Link
                to="/home"
                className="text-xs text-muted-foreground underline underline-offset-4 xl:hidden"
              >
                Home
              </Link>
            </div>
            <h2 className="mt-3 font-serif text-4xl sm:text-5xl">
              {mode === "login" ? "Good to see you." : "Make it yours."}
            </h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              {mode === "login"
                ? "Sign in to see your saved pieces, delivery details, and order tracking."
                : "Create an account for saved addresses, favorites, and effortless checkout."}
            </p>
            {storeSettings.account_settings.google_auth_enabled && <>
              <button
                type="button"
                onClick={google}
                className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-sm font-semibold transition hover:bg-secondary"
              >
                <ResilientImage
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  className="h-5 w-5"
                />
                Continue with Google
              </button>
              <div className="my-3 flex items-center gap-3 text-[10px] font-bold tracking-[.14em] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                OR
              </div>
            </>}
            <div className="grid gap-3">
              {mode === "signup" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid min-w-0 gap-2 text-sm font-semibold">
                    First name
                  <input
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    required
                    className="h-11 min-w-0 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal outline-none focus:border-foreground"
                      placeholder="First name"
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-semibold">
                    Last name
                  <input
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    required
                    className="h-11 min-w-0 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal outline-none focus:border-foreground"
                      placeholder="Last name"
                    />
                  </label>
                </div>
              )}
              {mode === "signup" && storeSettings.account_settings.username_required && <label className="grid gap-2 text-sm font-semibold">Username<input value={username} onChange={event=>setUsername(event.target.value.replace(/[^A-Za-z0-9._-]/g,"").slice(0,24))} required minLength={3} maxLength={24} autoComplete="username" className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none focus:border-foreground" placeholder="cozyhome"/><span className="text-[10px] font-normal text-muted-foreground">Shown in your account menu. You can change it later.</span></label>}
              <label className="grid gap-2 text-sm font-semibold">
                Email address
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none focus:border-foreground"
                  placeholder="you@email.com"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Password
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type={showPassword ? "text" : "password"}
                    className="h-11 w-full rounded-xl border border-border bg-[#fcfbf8] px-4 pr-12 font-normal outline-none focus:border-foreground"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="w-fit text-xs font-semibold text-muted-foreground underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                )}
              </label>
              {mode === "signup" && (
                <>
                  <div className="-mt-1 flex items-center gap-2">
                    <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                      {[0, 1, 2].map((step) => (
                        <span
                          key={step}
                          className={`flex-1 ${score > step ? (strength === "Strong" ? "bg-[#68835f]" : strength === "Fair" ? "bg-[#c3975d]" : "bg-[#ae6d61]") : ""}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {strength || `Use ${passwordMinimum}+ characters`}
                    </span>
                  </div>
                  <p className="-mt-2 text-[11px] leading-4 text-muted-foreground">
                    For a strong password, use {Math.max(12, passwordMinimum + 4)}+ characters with an uppercase
                    letter, number, and symbol.
                  </p>
                  <label className="grid gap-2 text-sm font-semibold">
                    Confirm password
                    <div className="relative">
                      <input
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        type={showConfirm ? "text" : "password"}
                        className={`h-11 w-full rounded-xl border bg-[#fcfbf8] px-4 pr-12 font-normal outline-none ${confirm && confirm !== password ? "border-[#ae6d61]" : "border-border"}`}
                        placeholder="Repeat your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((visible) => !visible)}
                        aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                </>
              )}
            </div>
            {error && (
              <p className="mt-4 rounded-xl bg-[#f3e5d4] px-3 py-2 text-xs font-semibold text-[#8b5c46]">
                {error}
              </p>
            )}
            {mode === "login" && (
              <label className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="accent-foreground" />
                Keep me signed in
              </label>
            )}
            {mode === "signup" && (
              <div className="mt-4 rounded-2xl border border-[#d9d0c3] bg-[#f4f0e9] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.7)] transition focus-within:border-[#9b8062] sm:px-3.5 sm:py-3">
                <div className="flex items-start gap-3">
                  <input
                    id="customer-policy-acceptance"
                    type="checkbox"
                    required
                    checked={acceptedPolicies}
                    onChange={(event) => {
                      setAcceptedPolicies(event.target.checked);
                      if (event.target.checked) setError("");
                    }}
                    aria-describedby="customer-policy-acceptance-copy"
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#24231f]"
                  />
                  <div className="min-w-0">
                    <label
                      htmlFor="customer-policy-acceptance"
                      className="block cursor-pointer text-[9px] font-bold uppercase tracking-[.16em] text-black/42"
                    >
                      Required agreement
                    </label>
                    <p
                      id="customer-policy-acceptance-copy"
                      className="mt-1 text-[11px] leading-[1.15rem] text-muted-foreground sm:text-xs sm:leading-[1.2rem]"
                    >
                      I agree to CozyCraft’s{" "}
                      <button
                        type="button"
                        onClick={() => setPolicyDialog("terms")}
                        className="font-bold text-foreground underline decoration-[#aa9579] underline-offset-4 transition hover:decoration-foreground"
                      >
                        Terms of Use
                      </button>{" "}
                      and confirm that I have read the{" "}
                      <button
                        type="button"
                        onClick={() => setPolicyDialog("privacy")}
                        className="font-bold text-foreground underline decoration-[#aa9579] underline-offset-4 transition hover:decoration-foreground"
                      >
                        Privacy Policy
                      </button>
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}
            <button disabled={submitting || (mode === "signup" && !acceptedPolicies)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              <ArrowRight size={16} />
            </button>
            <div className="mt-2 border-t border-border pt-2 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  New to CozyCraft?{" "}
                  <Link
                    to="/signup"
                    className="font-semibold text-foreground underline underline-offset-4"
                  >
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already a member?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-foreground underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<
    "checking" | "ready" | "invalid" | "saved"
  >("checking");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const meetsPasswordPolicy =
    password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  const score = [
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password) && /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const strength = password
    ? score === 3
      ? "Strong"
      : score === 2
        ? "Fair"
        : "Weak"
    : "";

  useEffect(() => {
    let active = true;
    const verifyRecoverySession = async () => {
      const {
        data: { user: recoveryUser },
      } = await supabase.auth.getUser();
      if (active) setStatus(recoveryUser ? "ready" : "invalid");
    };
    void verifyRecoverySession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session?.user) setStatus("ready");
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match. Please try again.");
      return;
    }
    if (!meetsPasswordPolicy) {
      setError(
        "Use at least 10 characters with uppercase, lowercase, a number, and a symbol.",
      );
      return;
    }
    setSubmitting(true);
    const {
      data: { user: recoveryUser },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !recoveryUser) {
      setSubmitting(false);
      setStatus("invalid");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setSubmitting(false);
    setStatus("saved");
  };

  return (
    <main className="min-h-dvh overflow-y-auto bg-[#e9e5de] p-3 sm:p-5">
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-[1500px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-card p-5 shadow-[0_24px_80px_rgba(50,42,34,.12)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:p-6">
        <section className="auth-fixed-form w-full max-w-md">
          <Link
            to="/login"
            className="text-xs font-semibold underline underline-offset-4"
          >
            ← Back to sign in
          </Link>
          {status === "checking" && (
            <div className="mt-10 rounded-3xl bg-[#eee8df] p-7">
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                VERIFYING RESET LINK
              </p>
              <h1 className="mt-3 font-serif text-4xl">Just a moment.</h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                We are securely checking your password recovery session.
              </p>
            </div>
          )}
          {status === "invalid" && (
            <div className="mt-10 rounded-3xl bg-[#eee8df] p-7">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f3e5d4] text-[#8b5c46]">
                <LockKeyhole size={20} />
              </span>
              <p className="mt-6 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                RESET LINK UNAVAILABLE
              </p>
              <h1 className="mt-3 font-serif text-4xl">
                Request a new link.
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                This password-reset link is invalid or has expired. Return to
                sign in and request another secure email.
              </p>
              <Link
                to="/login"
                className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background"
              >
                Return to sign in
              </Link>
            </div>
          )}
          {status === "saved" && (
            <div className="mt-10 rounded-3xl bg-[#eee8df] p-7">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e3ecdf] text-[#56714f]">
                <Check size={20} />
              </span>
              <p className="mt-6 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                PASSWORD UPDATED
              </p>
              <h1 className="mt-3 font-serif text-4xl">
                You’re ready to return.
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Your new password has been saved. Sign in again to continue to
                your CozyCraft account.
              </p>
              <button
                onClick={() => nav("/login")}
                className="mt-6 h-12 w-full rounded-xl bg-foreground text-sm font-semibold text-background"
              >
                Sign in with new password
              </button>
            </div>
          )}
          {status === "ready" && (
            <form onSubmit={savePassword} className="mt-10">
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                CREATE NEW PASSWORD
              </p>
              <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
                Choose something new.
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Use a strong password you have not used before. Once saved, you
                can sign in with it.
              </p>
              <div className="mt-7 grid gap-4">
                <label className="grid gap-2 text-sm font-semibold">
                  New password
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={10}
                      type={showPassword ? "text" : "password"}
                      className="h-12 w-full rounded-xl border border-border bg-[#fcfbf8] px-4 pr-12 font-normal outline-none focus:border-foreground"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>
                <div className="-mt-1 flex items-center gap-2">
                  <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                    {[0, 1, 2].map((step) => (
                      <span
                        key={step}
                        className={`flex-1 ${score > step ? (strength === "Strong" ? "bg-[#68835f]" : strength === "Fair" ? "bg-[#c3975d]" : "bg-[#ae6d61]") : ""}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {strength || "Use 10+ characters"}
                  </span>
                </div>
                <label className="grid gap-2 text-sm font-semibold">
                  Confirm new password
                  <div className="relative">
                    <input
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      required
                      minLength={10}
                      type={showConfirm ? "text" : "password"}
                      className={`h-12 w-full rounded-xl border bg-[#fcfbf8] px-4 pr-12 font-normal outline-none ${confirm && confirm !== password ? "border-[#ae6d61]" : "border-border"}`}
                      placeholder="Repeat new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={
                        showConfirm
                          ? "Hide confirmation password"
                          : "Show confirmation password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showConfirm ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>
              </div>
              {error && (
                <p className="mt-4 rounded-xl bg-[#f3e5d4] px-3 py-2 text-xs font-semibold text-[#8b5c46]">
                  {error}
                </p>
              )}
              <button
                disabled={submitting}
                className="mt-6 h-12 w-full rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-60"
              >
                {submitting ? "Saving new password…" : "Save new password"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
