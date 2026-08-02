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
  isExistingAccountSignUpResult,
  signInForPortal,
} from "@/lib/auth";

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


export function Account({ mode }: { mode: "login" | "signup" }) {
  const { authReady, user, role, signOut } = useStore();
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
  const [error, setError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("reason") === "invalid-login") {
      setError("Incorrect email or password. Please check your credentials.");
    }
  }, [location.search]);
  useEffect(() => {
    if (!authReady || !user || !role) return;
    if (role === "customer") {
      nav("/profile", { replace: true });
      return;
    }
    void signOut().then(() => {
      setError("Incorrect email or password. Please check your credentials.");
    });
  }, [authReady, nav, role, signOut, user]);
  const score = [
    password.length >= 8,
    password.length >= 12,
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
    if (mode === "signup" && !/^[A-Za-z0-9._-]{3,24}$/.test(username.trim())) { setError("Username must be 3–24 characters using letters, numbers, dots, underscores, or hyphens."); return; }
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
      nav("/profile");
      return;
    }
    const result = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: (first + " " + last).trim(), username: username.trim() },
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/home" },
    });
    if (error) setError(error.message);
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
    <main className="min-h-dvh overflow-y-auto bg-[#e9e5de] p-3 sm:p-5 lg:h-dvh lg:overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[1.5rem] bg-card shadow-[0_24px_80px_rgba(50,42,34,.12)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] lg:h-full lg:min-h-0 lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden min-h-0 overflow-hidden bg-[#24211e] p-10 text-[#f4f2ee] lg:flex lg:flex-col lg:justify-between">
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
          <div className="relative max-w-md">
            <p className="text-[10px] font-bold tracking-[.22em] text-white/60">
              COZYCRAFT / MEMBERS
            </p>
            <h1 className="mt-6 font-serif text-6xl leading-[.98]">
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
        <section className="flex min-h-0 items-center justify-center px-5 py-7 sm:px-10 sm:py-8 lg:overflow-hidden lg:py-5">
          <form onSubmit={submit} className="auth-fixed-form w-full max-w-md">
            <div className="mb-4 lg:hidden">
              <Logo />
            </div>
            <div className="flex items-center justify-between">
              <p className="rounded-full bg-secondary px-3 py-1.5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                {mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
              </p>
              <Link
                to="/home"
                className="text-xs text-muted-foreground underline underline-offset-4 lg:hidden"
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
            <button
              type="button"
              onClick={google}
              className="mt-4 flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-sm font-semibold transition hover:bg-secondary"
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
              {mode === "signup" && <label className="grid gap-2 text-sm font-semibold">Username<input value={username} onChange={event=>setUsername(event.target.value.replace(/[^A-Za-z0-9._-]/g,"").slice(0,24))} required minLength={3} maxLength={24} autoComplete="username" className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none focus:border-foreground" placeholder="cozyhome"/><span className="text-[10px] font-normal text-muted-foreground">Shown in your account menu. You can change it later.</span></label>}
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
                      {strength || "Use 8+ characters"}
                    </span>
                  </div>
                  <p className="-mt-2 text-[11px] leading-4 text-muted-foreground">
                    For a strong password, use 12+ characters with an uppercase
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
            <button disabled={submitting} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-60">
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
