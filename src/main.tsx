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

window.addEventListener("vite:preloadError", (event) => {
  if (recoverFromDeploymentUpdate()) event.preventDefault();
});

// Never reload merely because a user returns to this browser tab. A newer
// Netlify deployment is picked up on the next deliberate page load. The
// preload-error recovery above remains for the rare case where an old lazy
// chunk is no longer available, while unfinished admin forms are separately
// protected by session draft recovery.

createRoot(document.getElementById("root")!).render(<App />);
