// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ForecastView, type ForecastInputs } from "./ForecastPanel";
import { demoHistory } from "@/lib/intelligence/forecast";
vi.mock("@/app/core", () => ({ money: (n: number) => `PHP ${n.toFixed(2)}`, useAdminSession: vi.fn() }));
vi.mock("@/services/supabase/client", () => ({ adminSupabase: { rpc: vi.fn() } }));
vi.mock("recharts", () => ({ Area: () => null, Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>, ComposedChart: () => <div>Chart</div> }));
let root: Root, host: HTMLDivElement;
const data: ForecastInputs = { version: 1, generatedAt: new Date().toISOString(), through: "2026-09-21", timezone: "Asia/Manila", basis: "Fixture", series: [], eligibleOrders: 0, excludedTestPayments: 72, undatedSettlements: 0 };
const mount = async (input: ForecastInputs | null = data, error = "") => act(async () => root.render(<ForecastView data={input} error={error} loading={false} refresh={vi.fn()} />));
const click = async (name: string) => act(async () => [...host.querySelectorAll("button")].find(el => el.textContent?.includes(name))!.click());
beforeEach(async () => { vi.stubGlobal("Worker", undefined); host = document.createElement("div"); document.body.append(host); root = createRoot(host); await mount(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("shows insufficient data instead of fictional zero predictions", () => { expect(host.textContent).toContain("Building reliable history"); expect(host.textContent).toContain("72 test payments excluded"); expect(host.querySelector("tbody")).toBeNull(); });
it("keeps synthetic demo separate and labels every export and table", async () => {
  await click("Explore model demo"); expect(host.textContent).toContain("Demonstration only"); expect(host.textContent).toContain("Synthetic demo forecast");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(7); await click("Return to live data"); expect(host.querySelector("tbody")).toBeNull();
});
it("allows complete forecasts without Worker support", async () => { await mount({ ...data, series: demoHistory() }); expect(host.querySelectorAll("tbody tr")).toHaveLength(7); expect(host.textContent).toContain("Independent holdout error"); });
it("shows a recoverable data error, not empty totals", async () => { await mount(null, "Connection failed"); expect(host.querySelector('[role="alert"]')?.textContent).toContain("Connection failed"); expect(host.querySelectorAll("tbody tr")).toHaveLength(0); });
it("discloses excluded records without usable settlement dates", async () => { await mount({ ...data, undatedSettlements: 3 }); expect(host.textContent).toContain("3 paid records lack a usable settlement date"); });
it("recalculates when the metric or horizon changes", async () => {
  await click("Explore model demo");
  await click("Settled orders");
  expect(host.querySelector("caption")?.textContent).toContain("orders");
  expect(host.querySelector("tbody td")?.textContent).not.toContain("PHP");
  await act(async () => { const select = host.querySelector("select")!; select.value = "14"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelectorAll("tbody tr")).toHaveLength(14);
});
