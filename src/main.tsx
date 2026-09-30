import { localStore, sessionStore } from "@/lib/shared/browser-storage";
import { applyAdminTheme } from "@/lib/admin/admin-theme";
import { nativePaymentReturnTarget } from "@/lib/commerce/native-payment-return";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { DialogAccessibility } from "./components/DialogAccessibility";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/inter/wght.css";
import "./styles/index.css";

// Storefront and admin styles are scoped by surface. RouteShell keeps this in
// sync on navigation.
document.documentElement.dataset.surface = window.location.pathname.startsWith("/admin") ? "admin" : "store";
// Admin light/dark preference is applied before first paint to avoid a flash.
applyAdminTheme();

const preferredTextSize = localStore.getItem("cozycraft-text-size-v1");
document.documentElement.style.fontSize = preferredTextSize === "large" ? "20px" : preferredTextSize === "comfortable" ? "18px" : "16px";

const deploymentReloadKey = "cozycraft-deployment-reload";
const recoverFromDeploymentUpdate = () => {
  const lastReload = Number(
    sessionStore.getItem(deploymentReloadKey) ?? "0",
  );
  if (Date.now() - lastReload < 15_000) return false;
  sessionStore.setItem(deploymentReloadKey, String(Date.now()));
  window.location.reload();
  return true;
};

window.addEventListener("vite:preloadError", (event) => {
  if (recoverFromDeploymentUpdate()) event.preventDefault();
});

// Never reload merely because a user returns to this browser tab. A newer
// Netlify deployment is picked up on the next deliberate page load. The
// preload-error recovery above remains for the rare case where an old lazy
// chunk is no longer available, while unfinished admin forms are separately
// protected by session draft recovery.

const nativeReturn = nativePaymentReturnTarget(window.location, [sessionStore, localStore]);
if (nativeReturn) {
  // Do not mount web checkout/auth UI during an app-owned payment handoff.
  window.location.replace(nativeReturn);
} else {
  createRoot(document.getElementById("root")!).render(<><DialogAccessibility /><App /></>);
}
