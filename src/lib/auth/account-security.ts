export const authenticatorChallengeRequired = (
  currentLevel: string | null,
  nextLevel: string | null,
) => nextLevel === "aal2" && currentLevel !== "aal2";

export const shouldRecheckAuthenticator = (event: string) =>
  [
    "SIGNED_IN",
    "TOKEN_REFRESHED",
    "MFA_CHALLENGE_VERIFIED",
    "USER_UPDATED",
  ].includes(event);

export const passwordRecoveryGrantStorageKey =
  "cozycraft-password-recovery-grant";

const passwordRecoveryGrantLifetimeMs = 30 * 60 * 1000;

type PasswordRecoveryGrant = {
  userId: string;
  grantedAt: number;
};

export const passwordStatusFromRpc = (
  value: unknown,
  error: unknown,
): boolean | null => {
  if (error || typeof value !== "boolean") return null;
  return value;
};

export const writePasswordRecoveryGrant = (
  storage: Pick<Storage, "setItem">,
  userId: string,
  now = Date.now(),
) => {
  if (!userId) return false;
  try {
    storage.setItem(
      passwordRecoveryGrantStorageKey,
      JSON.stringify({ userId, grantedAt: now } satisfies PasswordRecoveryGrant),
    );
    return true;
  } catch {
    return false;
  }
};

export const hasValidPasswordRecoveryGrant = (
  storage: Pick<Storage, "getItem" | "removeItem">,
  userId: string,
  now = Date.now(),
) => {
  try {
    const raw = storage.getItem(passwordRecoveryGrantStorageKey);
    if (!raw) return false;
    const grant = JSON.parse(raw) as Partial<PasswordRecoveryGrant>;
    const valid =
      grant.userId === userId &&
      typeof grant.grantedAt === "number" &&
      now >= grant.grantedAt &&
      now - grant.grantedAt <= passwordRecoveryGrantLifetimeMs;
    if (!valid) storage.removeItem(passwordRecoveryGrantStorageKey);
    return valid;
  } catch {
    try {
      storage.removeItem(passwordRecoveryGrantStorageKey);
    } catch {
      // Storage is an enhancement; Supabase still validates the recovery session.
    }
    return false;
  }
};

export const clearPasswordRecoveryGrant = (
  storage: Pick<Storage, "removeItem">,
) => {
  try {
    storage.removeItem(passwordRecoveryGrantStorageKey);
  } catch {
    // A storage failure must not block a successful password change.
  }
};

export const urlContainsPasswordRecoveryCredentials = (
  location: Pick<Location, "hash" | "search">,
) => {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  return (
    (hash.get("type") === "recovery" && hash.has("access_token")) ||
    (query.get("type") === "recovery" &&
      (query.has("token_hash") || query.has("code")))
  );
};
