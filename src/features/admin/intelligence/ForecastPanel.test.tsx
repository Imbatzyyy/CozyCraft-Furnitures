// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ForecastView, type ForecastInputs } from "./ForecastPanel";
import { forecastFixture as demoHistory } from "@/test/forecast-fixtures";
vi.mock("@/app/core", () => ({ money: (n: number) => `PHP ${n.toFixed(2)}`, useAdminSession: vi.fn() }));
vi.mock("@/services/supabase/client", () => ({ adminSupabase: { rpc: vi.fn() } }));
vi.mock("recharts", () => ({ Area: () => null, Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>, ComposedChart: () => <div>Chart</div> }));
let root: Root, host: HTMLDivElement;
const data: ForecastInputs = { version: 1, generatedAt: new Date().toISOString(), through: "2026-09-21", timezone: "Asia/Manila", basis: "Fixture", series: [], eligibleOrders: 0, excludedTestPayments: 72, undatedSettlements: 0 };
const mount = async (input: ForecastInputs | null = data, error = "") => act(async () => root.render(<ForecastView data={input} error={error} loading={false} refresh={vi.fn()} />));
const click = async (name: string) => act(async () => [...host.querySelectorAll("button")].find(el => el.textContent?.includes(name))!.click());
beforeEach(async () => { vi.stubGlobal("Worker", undefined); host = document.createElement("div"); document.body.append(host); root = createRoot(host); await mount(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("shows insufficient data instead of fictional zero predictions", () => { expect(host.textContent).toContain("Building settlement history"); expect(host.textContent).toContain("72 test payments excluded"); expect(host.querySelectorAll("tbody tr")).toHaveLength(0); });
it("does not replace insufficient live history with classroom data", async () => {
  expect(host.textContent).not.toContain("Explore model demo"); expect(host.textContent).not.toContain("Return to live data");
  expect(host.textContent).toContain("Actual store data only");
});
it("keeps a compact classroom source label without the large warning or repeated badge", async () => {
  const series=demoHistory();
  await mount({...data,version:3,series,eligibleOrders:series.reduce((sum,r)=>sum+r.orders,0),dataset:{kind:"synthetic",id:"classroom-v1",label:"Classroom"}});
  expect(host.querySelector('[role="note"]')?.textContent).toBe("Classroom dataset · not actual sales");
  expect(host.textContent).not.toContain("Synthetic scenario only");
  expect(host.textContent).not.toContain("Synthetic classroom data — not real sales");
  expect(host.querySelector(".forecast-demo")).toBeNull();
  expect(host.textContent).toContain("Simulated sales");
  expect(host.textContent).toContain("Classroom daily observations");
  expect(host.textContent).not.toContain("Actual store data only");
  expect(host.textContent).not.toContain("Live-data forecast");
  expect(host.textContent).not.toContain("Actual daily settlements");
  expect(host.textContent).not.toContain("actual settlement history");
  expect(host.textContent).toContain("classroom history");
});
it("allows complete forecasts without Worker support", async () => { await mount({ ...data, series: demoHistory() }); expect(host.querySelector("table")!.querySelectorAll("tbody tr")).toHaveLength(7); expect(host.textContent).toContain("Independent holdout RMSE"); });
it("shows a recoverable data error, not empty totals", async () => { await mount(null, "Connection failed"); expect(host.querySelector('[role="alert"]')?.textContent).toContain("Connection failed"); expect(host.querySelectorAll("tbody tr")).toHaveLength(0); });
it("discloses excluded records without usable settlement dates", async () => { await mount({ ...data, undatedSettlements: 3 }); expect(host.textContent).toContain("3 paid records lack a usable settlement date"); });
it("recalculates when the metric or horizon changes", async () => {
  await mount({ ...data, series: demoHistory() });
  await click("Settled orders");
  expect(host.querySelector("caption")?.textContent).toContain("orders");
  expect(host.querySelector("tbody td")?.textContent).not.toContain("PHP");
  await act(async () => { const select = host.querySelector("select")!; select.value = "14"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelector("table")!.querySelectorAll("tbody tr")).toHaveLength(14);
});
it("does not retain the previous account forecast after data is cleared", async () => {
  await mount({ ...data, series: demoHistory() });
  await mount(null); expect(host.querySelectorAll("tbody tr")).toHaveLength(0);
  expect(host.textContent).toContain("Waiting for a verified administrator");
});
it("labels a retained snapshot when a refresh fails", async () => {
  await mount({ ...data, series: demoHistory() }, "Connection failed");
  expect(host.textContent).toContain("Showing the previous snapshot");
});
it("exports only actual-data forecast values with snapshot, evidence and algorithm provenance", async () => {
  let csv = "";
  const OriginalBlob = Blob;
  vi.stubGlobal("Blob", class extends OriginalBlob { constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts,options); csv=String(parts[0]); } });
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {createObjectURL:vi.fn(()=>"blob:forecast-test"),revokeObjectURL:vi.fn()}));
  const clickAnchor=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  await mount({...data,series:demoHistory()}); await click("Download forecast CSV");
  expect(clickAnchor).toHaveBeenCalledOnce();
  expect(csv).toContain("Actual eligible settlements"); expect(csv).toContain("adaptive-settlements-v2");
  expect(csv).toContain(data.generatedAt); expect(csv).toContain("Evidence");
  expect(csv.split("\n")).toHaveLength(8); expect(csv).not.toContain("DEMO");
});
it("marks synthetic exports and filenames so they cannot be mistaken for real sales", async () => {
  let csv = "", filename = "";
  const OriginalBlob = Blob;
  vi.stubGlobal("Blob", class extends OriginalBlob { constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts,options); csv=String(parts[0]); } });
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {createObjectURL:vi.fn(()=>"blob:forecast-test"),revokeObjectURL:vi.fn()}));
  vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement) { filename=this.download; });
  await mount({...data,version:3,series:demoHistory(),dataset:{kind:"synthetic",id:"classroom-v1",label:"Classroom"}});
  await click("Download forecast CSV");
  expect(csv).toContain("SYNTHETIC CLASSROOM DATA - NOT REAL SALES");
  expect(csv).toContain("classroom-v1"); expect(csv).toContain("synthetic scenario only");
  expect(csv).not.toContain("Actual eligible settlements");
  expect(filename).toContain("synthetic-classroom");
});
