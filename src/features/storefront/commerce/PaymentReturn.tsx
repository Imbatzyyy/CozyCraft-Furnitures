import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock3,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { Logo, useStore } from "@/app/core";
import {
  clearPendingPaymentRecovery,
  pendingPaymentOrderUrl,
  readPendingPaymentRecovery,
  writePendingPaymentRecovery,
  type PendingPaymentRecovery,
} from "@/lib/commerce/payment-recovery";
import {
  consumePaymentHandoff,
  isTrustedPayMongoCheckoutUrl,
  readPaymentHandoff,
} from "@/lib/commerce/payment-handoff";
import { findPendingPaymentRecovery } from "@/services/commerce/payment-recovery.service";
import { supabase } from "@/services/supabase/client";

type ReturnMode = "pending" | "handoff" | "cancelled" | "success";
type ReturnPhase =
  | "restoring"
  | "recoverable"
  | "paid"
  | "expired"
  | "error";

type CompactOrderStatus = {
  id: string;
  order_number: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  status: "pending" | "processing" | "packed" | "shipped" | "delivered" | "cancelled";
  payment_expires_at: string | null;
};

const normalizeReturnMode = (value: string | null): ReturnMode => {
  switch (value?.toLowerCase()) {
    case "handoff":
      return "handoff";
    case "success":
    case "succeeded":
    case "paid":
      return "success";
    case "cancel":
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
};

const countdown = (expiresAt: string, now: number) => {
  const remaining = Math.max(0, Date.parse(expiresAt) - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const recoveryFromOrder = (
  order: {
    id: string;
    order_number: string;
    payment_expires_at?: string | null;
  },
): PendingPaymentRecovery | null =>
  order.payment_expires_at
    ? {
        orderId: order.id,
        orderNumber: order.order_number,
        expiresAt: order.payment_expires_at,
      }
    : null;

const ReturnShell = ({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) => (
  <main className="min-h-dvh bg-[#ebe7df] px-4 py-5 text-[#1f1e1b] sm:px-6 sm:py-8">
    <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-[#dcd5ca] bg-[#f9f7f3] shadow-[0_28px_90px_rgba(49,42,34,.12)] sm:min-h-[calc(100dvh-4rem)] sm:rounded-[2.25rem]">
      <header className="flex items-center justify-between border-b border-[#ddd7cd] px-5 py-4 sm:px-8 sm:py-5">
        <Logo />
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ece7df] px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#66615a] sm:text-xs">
          <LockKeyhole size={14} /> Secure payment
        </span>
      </header>
      <section
        className={`flex flex-1 items-center justify-center px-5 py-10 sm:px-8 ${
          compact ? "sm:py-12" : "sm:py-16"
        }`}
      >
        {children}
      </section>
      <footer className="border-t border-[#ddd7cd] px-5 py-4 text-center text-xs leading-5 text-[#777169] sm:px-8">
        Your order and reservation are stored securely. This page never relies on your bag to restore a payment.
      </footer>
    </div>
  </main>
);

const RestoringPayment = ({ opening = false }: { opening?: boolean }) => (
  <ReturnShell compact>
    <div className="w-full max-w-xl text-center" aria-live="polite" aria-busy="true">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#282620] text-white">
        <LoaderCircle className="animate-spin" size={24} />
      </span>
      <p className="mt-7 text-[10px] font-bold uppercase tracking-[.22em] text-[#777169]">
        {opening ? "Opening secure checkout" : "Restoring your payment"}
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
        {opening ? "Taking you to PayMongo." : "One moment, please."}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#6f6a63] sm:text-base">
        {opening
          ? "Your reserved order is ready. Keep this page open while the secure payment window starts."
          : "We are safely restoring your account and reserved order. You will not be signed out while this check completes."}
      </p>
    </div>
  </ReturnShell>
);

export function PaymentReturn() {
  const { authReady, user, userId, refreshOrders } = useStore();
  const location = useLocation();
  const search = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const requestedOrderId =
    search.get("order") ?? search.get("orderId") ?? search.get("order_id") ?? "";
  const mode = normalizeReturnMode(
    search.get("mode") ??
      search.get("result") ??
      search.get("payment") ??
      search.get("status"),
  );
  const returnPath = `${location.pathname}${location.search}`;

  const [phase, setPhase] = useState<ReturnPhase>("restoring");
  const [recovery, setRecovery] = useState<PendingPaymentRecovery | null>(null);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [resuming, setResuming] = useState(false);
  const [reconcileAttempt, setReconcileAttempt] = useState(0);
  const operationRef = useRef("");
  const handoffRef = useRef<{
    orderId: string;
    userId: string;
    handoff: ReturnType<typeof readPaymentHandoff>;
  } | null>(null);
  const lastReconcileAtRef = useRef(0);
  const identityRef = useRef(userId);

  // A return route can remain mounted while the authenticated identity changes.
  // Reset account-specific UI before the new identity is painted, but leave the
  // prior user's namespaced local recovery marker intact for their next session.
  useLayoutEffect(() => {
    if (identityRef.current === userId) return;
    identityRef.current = userId;
    setPhase("restoring");
    setRecovery(null);
    setMessage("");
    setResuming(false);
    setReconcileAttempt(0);
    setNow(Date.now());
    operationRef.current = "";
    handoffRef.current = null;
    lastReconcileAtRef.current = 0;
  }, [userId]);

  const persistRecovery = useCallback(
    (next: PendingPaymentRecovery) => {
      setRecovery(next);
      setPhase("recoverable");
      if (userId) {
        writePendingPaymentRecovery(window.localStorage, userId, next);
      }
    },
    [userId],
  );

  const lookupOrderStatus = useCallback(async () => {
    if (!requestedOrderId || !userId) return null;
    const { data, error } = await supabase
      .from("orders")
      .select("id,order_number,payment_status,status,payment_expires_at")
      .eq("id", requestedOrderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return (data as CompactOrderStatus | null) ?? null;
  }, [requestedOrderId, userId]);

  const showStatus = useCallback(
    (order: CompactOrderStatus | null) => {
      if (!order) return false;
      if (order.payment_status === "paid") {
        if (userId) clearPendingPaymentRecovery(window.localStorage, userId);
        setRecovery(null);
        setPhase("paid");
        return true;
      }
      if (
        order.payment_status === "pending" &&
        order.status !== "cancelled" &&
        order.payment_expires_at &&
        Date.parse(order.payment_expires_at) > Date.now()
      ) {
        const next = recoveryFromOrder(order);
        if (next) persistRecovery(next);
        return true;
      }
      if (
        order.status === "cancelled" ||
        order.payment_status === "failed" ||
        (order.payment_expires_at && Date.parse(order.payment_expires_at) <= Date.now())
      ) {
        if (userId) clearPendingPaymentRecovery(window.localStorage, userId);
        setRecovery(null);
        setPhase("expired");
        return true;
      }
      return false;
    },
    [persistRecovery, userId],
  );

  // The checkout page first replaces itself with this route and leaves a
  // one-time handoff record. Consuming it before opening PayMongo means browser
  // Back restores this mounted route instead of an empty, cart-dependent page.
  useEffect(() => {
    if (mode !== "handoff" || !requestedOrderId || !authReady || !userId) return;
    let handoff =
      handoffRef.current?.orderId === requestedOrderId &&
      handoffRef.current.userId === userId
        ? handoffRef.current.handoff
        : undefined;
    if (handoff === undefined) {
      handoff = readPaymentHandoff(
        window.sessionStorage,
        requestedOrderId,
        userId,
      );
      handoffRef.current = { orderId: requestedOrderId, userId, handoff };
    }
    if (!handoff || handoff.userId !== userId) return;

    const next: PendingPaymentRecovery = {
      orderId: handoff.orderId,
      orderNumber: null,
      expiresAt: handoff.expiresAt,
    };
    persistRecovery(next);
    consumePaymentHandoff(window.sessionStorage, requestedOrderId, userId);

    // Two frames let React commit the recoverable state before navigation.
    // That committed screen is what the browser restores from its back/forward
    // cache if the customer leaves PayMongo without paying.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() =>
        window.location.assign(handoff.checkoutUrl),
      );
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [authReady, mode, persistRecovery, requestedOrderId, userId]);

  useEffect(() => {
    const reconcile = (force = false) => {
      setResuming(false);
      if (!force && phase !== "recoverable" && phase !== "error") return;
      const checkedAt = Date.now();
      if (checkedAt - lastReconcileAtRef.current < 1500) return;
      lastReconcileAtRef.current = checkedAt;
      setReconcileAttempt((attempt) => attempt + 1);
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reconcile(true);
    };
    const handleFocus = () => reconcile();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [phase]);

  useEffect(() => {
    if (!authReady || !userId) return;
    const operationMode = reconcileAttempt > 0 ? "pending" : mode;
    const operationKey = `${userId}:${operationMode}:${requestedOrderId || "latest"}:${reconcileAttempt}`;
    if (operationRef.current === operationKey) return;
    operationRef.current = operationKey;
    let active = true;

    const restorePending = async () => {
      const local = readPendingPaymentRecovery(window.localStorage, userId);
      const immediate =
        (local && (!requestedOrderId || local.orderId === requestedOrderId)
          ? local
          : null);
      if (immediate) persistRecovery(immediate);

      const { recovery: serverRecovery, error } =
        await findPendingPaymentRecovery(
          userId,
          new Date(),
          requestedOrderId || undefined,
        );
      if (!active) return;
      if (
        serverRecovery &&
        (!requestedOrderId || serverRecovery.orderId === requestedOrderId)
      ) {
        persistRecovery(serverRecovery);
        return;
      }

      let status: CompactOrderStatus | null;
      try {
        status = await lookupOrderStatus();
      } catch (statusError) {
        if (!active) return;
        setMessage(
          statusError instanceof Error
            ? statusError.message
            : "The reserved order could not be checked just now.",
        );
        if (immediate && Date.parse(immediate.expiresAt) > Date.now()) {
          persistRecovery(immediate);
          return;
        }
        throw statusError;
      }
      if (!active || showStatus(status)) return;
      if (immediate && Date.parse(immediate.expiresAt) > Date.now()) return;
      setMessage(
        error ??
          "We could not find an active payment reservation for this order. No additional payment was made.",
      );
      setPhase(error ? "error" : "expired");
    };

    const reconcileSuccess = async () => {
      if (!requestedOrderId) {
        setMessage("The payment return did not include an order reference.");
        setPhase("error");
        return;
      }
      const { data, error } = await supabase.functions.invoke(
        "sync-paymongo-payments",
        { body: { orderIds: [requestedOrderId] } },
      );
      if (!active) return;
      // The small exact-order query below is authoritative for this return
      // screen. Refresh the complete order graph in the background so a slow
      // relation never traps the customer on the restoring state.
      void refreshOrders();
      const status = await lookupOrderStatus();
      if (!active || showStatus(status)) return;
      setMessage(
        data?.error ??
          error?.message ??
          "Your payment return was received, but confirmation is still processing. You can safely check the order again from My Account.",
      );
      setPhase("error");
    };

    const pauseCancelledPayment = async () => {
      if (!requestedOrderId) {
        await restorePending();
        return;
      }
      const { data, error } = await supabase.functions.invoke(
        "cancel-paymongo-checkout",
        { body: { orderId: requestedOrderId } },
      );
      if (!active) return;
      void refreshOrders();
      if (data?.paid) {
        if (userId) clearPendingPaymentRecovery(window.localStorage, userId);
        setRecovery(null);
        setMessage("Payment was confirmed before the PayMongo page closed.");
        setPhase("paid");
        return;
      }
      if (data?.paused && data?.expiresAt) {
        persistRecovery({
          orderId: String(data.orderId ?? requestedOrderId),
          orderNumber:
            typeof data.orderNumber === "string" ? data.orderNumber : null,
          expiresAt: String(data.expiresAt),
        });
        setMessage("Payment was paused. Your items remain reserved until the timer ends.");
        return;
      }
      if (data?.expired) {
        if (userId) clearPendingPaymentRecovery(window.localStorage, userId);
        setRecovery(null);
        setPhase("expired");
        return;
      }

      // A network interruption must not discard the reservation. Fall back to
      // the small server lookup and keep the timer available when it exists.
      setMessage(data?.error ?? error?.message ?? "Payment status could not be verified yet.");
      await restorePending();
    };

    const run = async () => {
      if (operationMode === "success") {
        await reconcileSuccess();
      } else if (operationMode === "cancelled") {
        await pauseCancelledPayment();
      } else if (
        operationMode !== "handoff" ||
        handoffRef.current?.orderId !== requestedOrderId ||
        !handoffRef.current.handoff
      ) {
        await restorePending();
      }
    };

    // Defer the operation by one task. React Strict Mode intentionally mounts,
    // cleans up, and mounts effects again in development; this prevents the
    // discarded first pass from invoking a payment Edge Function while still
    // allowing the committed pass to own and apply the result.
    const startTimer = window.setTimeout(() => {
      if (!active) return;
      void run().catch(() => {
        if (!active) return;
        setMessage(
          "The payment status check was interrupted. Your order remains stored safely; please try again.",
        );
        setPhase("error");
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(startTimer);
      if (operationRef.current === operationKey) operationRef.current = "";
    };
  }, [
    authReady,
    lookupOrderStatus,
    mode,
    persistRecovery,
    reconcileAttempt,
    refreshOrders,
    requestedOrderId,
    showStatus,
    userId,
  ]);

  useEffect(() => {
    if (!recovery) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [recovery]);

  useEffect(() => {
    if (!recovery || Date.parse(recovery.expiresAt) > now) return;
    if (userId) clearPendingPaymentRecovery(window.localStorage, userId);
    setRecovery(null);
    setPhase("expired");
  }, [now, recovery, userId]);

  const resumePayment = async () => {
    if (!recovery || resuming) return;
    setResuming(true);
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "resume-paymongo-checkout",
        { body: { orderId: recovery.orderId } },
      );
      if (data?.paid) {
        if (userId) clearPendingPaymentRecovery(window.localStorage, userId);
        setRecovery(null);
        setPhase("paid");
        await refreshOrders();
        return;
      }
      if (data?.expired) {
        if (userId) clearPendingPaymentRecovery(window.localStorage, userId);
        setRecovery(null);
        setPhase("expired");
        await refreshOrders();
        return;
      }
      if (
        typeof data?.checkoutUrl === "string" &&
        isTrustedPayMongoCheckoutUrl(data.checkoutUrl)
      ) {
        setResuming(false);
        window.location.assign(data.checkoutUrl);
        return;
      }
      setMessage(
        data?.error ??
          error?.message ??
          "The secure payment page could not be reopened. Please try again shortly.",
      );
    } catch (resumeError) {
      setMessage(
        resumeError instanceof Error
          ? resumeError.message
          : "The secure payment page could not be reopened. Please try again shortly.",
      );
    } finally {
      setResuming(false);
    }
  };

  if (!authReady) {
    return <RestoringPayment opening={mode === "handoff"} />;
  }

  if (!userId) {
    return (
      <ReturnShell compact>
        <div className="w-full max-w-xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#ece7df] text-[#38352f]">
            <LockKeyhole size={24} />
          </span>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.22em] text-[#777169]">
            Account check required
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Sign in to restore payment.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#6f6a63] sm:text-base">
            Your order remains protected. Sign in with the same CozyCraft account to view its reservation and continue securely.
          </p>
          <Link
            to={`/login?next=${encodeURIComponent(returnPath)}`}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#23211d] px-7 text-sm font-semibold text-white transition hover:bg-black"
          >
            Go to customer sign in <ArrowRight size={17} />
          </Link>
        </div>
      </ReturnShell>
    );
  }

  if (phase === "restoring") {
    return <RestoringPayment opening={mode === "handoff"} />;
  }

  if (phase === "paid") {
    return (
      <ReturnShell compact>
        <div className="w-full max-w-xl text-center" aria-live="polite">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dfe9da] text-[#4e6d47]">
            <Check size={28} strokeWidth={2.25} />
          </span>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.22em] text-[#64735e]">
            Payment confirmed
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Thank you, {user ?? "your order is ready"}.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#6f6a63] sm:text-base">
            {message || "Your payment is recorded and the CozyCraft team can now prepare your order."}
          </p>
          <Link
            to={pendingPaymentOrderUrl(requestedOrderId)}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#23211d] px-7 text-sm font-semibold text-white transition hover:bg-black"
          >
            View your order <ArrowRight size={17} />
          </Link>
        </div>
      </ReturnShell>
    );
  }

  if (phase === "recoverable" && recovery) {
    const remainingLabel = countdown(recovery.expiresAt, now);
    return (
      <ReturnShell>
        <div className="w-full max-w-2xl">
          <div className="rounded-[1.75rem] border border-[#d8d0c5] bg-white p-6 shadow-[0_20px_60px_rgba(53,45,36,.08)] sm:p-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#777169]">
                  Payment reserved
                </p>
                <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
                  Your checkout is still open.
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-[#6f6a63] sm:text-base">
                  {message ||
                    "You left PayMongo without completing payment. Your order is saved in Supabase and can be continued here or from another signed-in device."}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-[#282620] px-5 py-4 text-white sm:min-w-36 sm:text-center">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#cbc4b9] sm:justify-center">
                  <Clock3 size={14} /> Time left
                </span>
                <time
                  dateTime={recovery.expiresAt}
                  className="mt-1 block font-serif text-3xl tabular-nums"
                  aria-label={`${remainingLabel} remaining`}
                >
                  {remainingLabel}
                </time>
              </div>
            </div>

            <dl className="mt-7 grid gap-3 rounded-2xl bg-[#f1ede6] p-4 text-sm sm:grid-cols-2 sm:p-5">
              <div>
                <dt className="text-xs text-[#777169]">Reserved order</dt>
                <dd className="mt-1 font-semibold">
                  {recovery.orderNumber ? `#${recovery.orderNumber}` : "Secure online order"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#777169]">Reservation ends</dt>
                <dd className="mt-1 font-semibold">
                  {new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila",
                  }).format(new Date(recovery.expiresAt))}
                </dd>
              </div>
            </dl>

            {message && (
              <p className="mt-5 rounded-2xl bg-[#f5e8dc] px-4 py-3 text-sm leading-6 text-[#845c47]" role="status">
                {message}
              </p>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void resumePayment()}
                disabled={resuming}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#23211d] px-6 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
              >
                {resuming ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <CreditCard size={17} />
                )}
                {resuming ? "Opening PayMongo…" : "Continue payment"}
              </button>
              <Link
                to={pendingPaymentOrderUrl(recovery.orderId)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d8d0c5] bg-white px-6 text-sm font-semibold transition hover:bg-[#f5f2ed]"
              >
                View order details <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-5 text-[#777169]">
            <LockKeyhole className="mt-0.5 shrink-0" size={14} />
            The countdown runs on this device only; Supabase stores the actual deadline so refreshing or changing devices does not reset it.
          </p>
        </div>
      </ReturnShell>
    );
  }

  const isExpired = phase === "expired";
  return (
    <ReturnShell compact>
      <div className="w-full max-w-xl text-center" aria-live="polite">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eee8df] text-[#6f675e]">
          {isExpired ? <Clock3 size={24} /> : <XCircle size={24} />}
        </span>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[.22em] text-[#777169]">
          {isExpired ? "Payment window closed" : "Payment check interrupted"}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
          {isExpired ? "This reservation has ended." : "We could not restore it yet."}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#6f6a63] sm:text-base">
          {message ||
            (isExpired
              ? "No charge was made. Any reserved inventory is released safely after the payment deadline."
              : "Your account is still signed in. Open Orders to check the latest server status or try this page again.")}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {!isExpired && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#23211d] px-7 text-sm font-semibold text-white transition hover:bg-black"
            >
              <RotateCcw size={17} /> Try again
            </button>
          )}
          <Link
            to={
              requestedOrderId
                ? pendingPaymentOrderUrl(requestedOrderId)
                : "/profile?tab=orders"
            }
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d8d0c5] bg-white px-7 text-sm font-semibold transition hover:bg-[#f5f2ed]"
          >
            View My Orders <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </ReturnShell>
  );
}
