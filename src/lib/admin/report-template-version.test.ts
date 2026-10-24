import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCurrentReportTemplate, REPORT_TEMPLATE_VERSION, ReportTemplateChangedError } from "./report-template-version";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("report layout freshness", () => {
  it("checks the hosted manifest without using a cached result", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({version: REPORT_TEMPLATE_VERSION})));
    vi.stubGlobal("fetch", fetch);
    await assertCurrentReportTemplate(new AbortController().signal);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/report-template.json\?check=/), expect.objectContaining({cache:"no-store",credentials:"same-origin",signal:expect.any(AbortSignal)}));
  });
  it("rejects an outdated tab before report data is fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({version:"future-report-layout"}))));
    await expect(assertCurrentReportTemplate(new AbortController().signal)).rejects.toBeInstanceOf(ReportTemplateChangedError);
  });
  it.each([new Response("not found",{status:404}),new Response("<html>old app shell</html>"),new Response("{}")])("fails visibly for an unavailable or invalid manifest", async response => {
    vi.stubGlobal("fetch",vi.fn(async()=>response));
    await expect(assertCurrentReportTemplate(new AbortController().signal)).rejects.toThrow("Could not confirm");
  });
  it("bounds stalled requests and supports cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch",vi.fn((_url,options:RequestInit)=>new Promise((_resolve,reject)=>options.signal?.addEventListener("abort",()=>reject(new Error("aborted")),{once:true}))));
    const request=assertCurrentReportTemplate(new AbortController().signal);
    const check=expect(request).rejects.toThrow("Could not confirm");
    await vi.advanceTimersByTimeAsync(6000); await check;
    const controller=new AbortController();
    const cancelled=assertCurrentReportTemplate(controller.signal);
    const cancellation=expect(cancelled).rejects.toThrow("Export cancelled");
    controller.abort(); await cancellation;
  });
});
