export function adminMfaGate(currentLevel: string | null, nextLevel: string | null, required = true) {
  if (currentLevel === "aal2") return "ready";
  if (nextLevel === "aal2") return "challenge";
  return required ? "enroll" : "ready";
}
