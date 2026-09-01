export type DeviceDescription = {
  browser: string;
  device: string;
};

const includes = (value: string, pattern: RegExp) => pattern.test(value);

export function describeDevice(userAgent: string): DeviceDescription {
  const agent = userAgent.trim();
  const browser = includes(agent, /Edg\//i)
    ? "Microsoft Edge"
    : includes(agent, /OPR\//i)
      ? "Opera"
      : includes(agent, /CriOS\//i)
        ? "Google Chrome"
        : includes(agent, /FxiOS\//i)
          ? "Mozilla Firefox"
          : includes(agent, /Chrome\//i)
            ? "Google Chrome"
            : includes(agent, /Firefox\//i)
              ? "Mozilla Firefox"
              : includes(agent, /Safari\//i)
                ? "Safari"
                : "Web browser";

  const device = includes(agent, /iPad/i)
    ? "iPad"
    : includes(agent, /iPhone/i)
      ? "iPhone"
      : includes(agent, /Android/i) && includes(agent, /Mobile/i)
        ? "Android phone"
        : includes(agent, /Android/i)
          ? "Android tablet"
          : includes(agent, /Windows/i)
            ? "Windows computer"
            : includes(agent, /Macintosh|Mac OS X/i)
              ? "Mac"
              : includes(agent, /CrOS/i)
                ? "Chromebook"
                : includes(agent, /Linux/i)
                  ? "Linux computer"
                  : "Device";

  return { browser, device };
}

export function sessionIdFromAccessToken(accessToken: string) {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const claims = JSON.parse(window.atob(padded)) as { session_id?: unknown };
    return typeof claims.session_id === "string" && claims.session_id
      ? claims.session_id
      : null;
  } catch {
    return null;
  }
}
