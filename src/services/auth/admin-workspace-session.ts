type WorkspaceSession = {
  access_token: string;
  user: { id: string; factors?: Array<{ status: string }> };
};

/** Client-side request/cache identity only. Database RLS still authorizes reads. */
export function adminWorkspaceSessionScope(session: WorkspaceSession | null): string | null {
  if (!session) return null;
  try {
    const encoded = session.access_token.split(".")[1];
    const claims = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof claims.session_id !== "string" || !claims.session_id) return null;
    if (claims.aal !== "aal1" && claims.aal !== "aal2") return null;
    const requiresMfa = session.user.factors?.some((factor) => factor.status === "verified");
    if (requiresMfa && claims.aal !== "aal2") return null;
    // Token refreshes retain this key; completing MFA or signing in again does not.
    return `admin:${session.user.id}:${claims.session_id}:${claims.aal}`;
  } catch {
    return null;
  }
}

export const workspaceScopeCanLoad = (scope: string) =>
  scope !== "admin:guest" && scope !== "admin:verification-pending";
