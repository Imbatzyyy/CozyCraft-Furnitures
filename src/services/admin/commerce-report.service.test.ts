import { describe, expect, it, vi, beforeEach } from "vitest";
import { ALL_COMMERCE_FILTERS, BASIC_REPORT_DETAILS } from "@/lib/admin/commerce-report";
import { loadCommerceReport } from "./commerce-report.service";
const mocks = vi.hoisted(() => ({ read: vi.fn(), rpc: vi.fn() }));
vi.mock("@/services/supabase/client", () => ({ adminSupabase: { rpc: mocks.rpc } }));
const batch = (overrides = {}) => ({ rows: [{ id: "one" }], total: 1, hasMore: false, nextCursor: null, asOf: "2026-10-22T01:00:00Z", snapshotKey: "hash", summary: {}, ...overrides });
const load = (format: "pdf" | "csv" = "csv", signal = new AbortController().signal) => loadCommerceReport("orders", ALL_COMMERCE_FILTERS, BASIC_REPORT_DETAILS, format, signal, vi.fn());
beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockImplementation(() => ({ abortSignal: mocks.read })); });
describe("complete commerce report download", () => {
  it("loads every page with one cutoff and a cursor", async () => {
    const cursor = { id: "one", created_at: "2026-10-21T00:00:00Z" };
    mocks.read.mockResolvedValueOnce({ data: batch({ total: 2, hasMore: true, nextCursor: cursor }) }).mockResolvedValueOnce({ data: batch({ total: 2, rows: [{ id: "two" }] }) });
    expect((await load()).rows.map(r => r.id)).toEqual(["one", "two"]);
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_after: cursor, p_as_of: "2026-10-22T01:00:00Z", p_size: 250 });
  });
  it.each([
    [{ total: 2 }, /complete report/],
    [{ total: 5001 }, /more than 5,000/],
    [{ rows: null }, /incomplete/],
  ])("refuses partial, oversized or malformed PDFs", async (value, error) => {
    mocks.read.mockResolvedValue({ data: batch(value) }); await expect(load("pdf")).rejects.toThrow(error);
  });
  it("detects changing records instead of mixing report snapshots", async () => {
    mocks.read.mockResolvedValueOnce({ data: batch({ total: 2, hasMore: true, nextCursor: { id: "one", created_at: "2026-10-21T00:00:00Z" } }) }).mockResolvedValueOnce({ data: batch({ total: 2, snapshotKey: "changed" }) });
    await expect(load()).rejects.toThrow("changed while preparing");
  });
  it("rejects duplicate rows and cancellation", async () => {
    mocks.read.mockResolvedValueOnce({ data: batch({ rows: [{ id: "one" }, { id: "one" }], total: 2 }) });
    await expect(load()).rejects.toThrow("pagination could not be verified");
    const controller = new AbortController(); controller.abort(); await expect(load("csv", controller.signal)).rejects.toThrow("cancelled");
  });
  it("exports an empty match truthfully", async () => {
    mocks.read.mockResolvedValue({ data: batch({ rows: [], total: 0 }) }); expect((await load()).rows).toEqual([]);
  });
});
