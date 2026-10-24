// Keep the public manifest in sync; the browser export regression checks both.
export const REPORT_TEMPLATE_VERSION = "2026-10-24-list-v2";
export const REPORT_TEMPLATE_LABEL = "List layout v2 - no summary cards";

export class ReportTemplateChangedError extends Error {
  constructor() { super("A newer report layout is ready. Refresh this page before exporting. Your records have not changed."); }
}

/** One tiny same-origin read per PDF export; no polling or database traffic. */
export async function assertCurrentReportTemplate(signal: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 6000);
  try {
    const response = await fetch(`/report-template.json?check=${Date.now()}`, {
      cache: "no-store", credentials: "same-origin", signal: controller.signal,
    });
    if (!response.ok) throw new Error("Report layout check failed");
    const manifest: unknown = await response.json();
    if (!manifest || typeof manifest !== "object" || !("version" in manifest) || typeof manifest.version !== "string" || !manifest.version)
      throw new Error("Invalid report layout version");
    if (manifest.version !== REPORT_TEMPLATE_VERSION) throw new ReportTemplateChangedError();
  } catch (issue) {
    if (issue instanceof ReportTemplateChangedError) throw issue;
    throw new Error(signal.aborted ? "Export cancelled." : "Could not confirm the latest report layout. Check your connection and try Download PDF again.");
  } finally {
    clearTimeout(timer); signal.removeEventListener("abort", cancel);
  }
}
