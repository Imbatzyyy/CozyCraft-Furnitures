import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

const deploymentReloadKey = "cozycraft-deployment-reload";
const recoverFromDeploymentUpdate = () => {
  const lastReload = Number(
    window.sessionStorage.getItem(deploymentReloadKey) ?? "0",
  );
  if (Date.now() - lastReload < 15_000) return false;
  window.sessionStorage.setItem(deploymentReloadKey, String(Date.now()));
  window.location.reload();
  return true;
};

const activeBundlePath = (() => {
  const source = document
    .querySelector<HTMLScriptElement>('script[type="module"][src]')
    ?.getAttribute("src");
  return source ? new URL(source, window.location.origin).pathname : null;
})();

let deploymentCheckInFlight = false;
const refreshWhenNewDeploymentIsReady = async () => {
  if (!activeBundlePath || deploymentCheckInFlight) return;
  deploymentCheckInFlight = true;
  try {
    const response = await fetch(`/index.html?deployment-check=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    if (!response.ok) return;
    const html = await response.text();
    const nextSource = html.match(
      /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i,
    )?.[1];
    if (!nextSource) return;
    const nextBundlePath = new URL(nextSource, window.location.origin).pathname;
    if (nextBundlePath !== activeBundlePath) recoverFromDeploymentUpdate();
  } catch {
    // A temporary connectivity issue must never interrupt the current session.
  } finally {
    deploymentCheckInFlight = false;
  }
};

window.addEventListener("vite:preloadError", (event) => {
  if (recoverFromDeploymentUpdate()) event.preventDefault();
});

window.addEventListener("focus", () => void refreshWhenNewDeploymentIsReady());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void refreshWhenNewDeploymentIsReady();
  }
});
window.setInterval(() => void refreshWhenNewDeploymentIsReady(), 60_000);

createRoot(document.getElementById("root")!).render(<App />);
