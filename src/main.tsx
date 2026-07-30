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

createRoot(document.getElementById("root")!).render(<App />);
