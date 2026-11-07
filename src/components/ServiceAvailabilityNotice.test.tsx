// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ServiceAvailabilityNotice } from "./ServiceAvailabilityNotice";
import { databaseGeneration, finishDatabaseRequest } from "@/lib/shared/service-health";

afterEach(() => { finishDatabaseRequest(databaseGeneration(), 200); vi.useRealTimers(); });
it("shows an honest outage, defers manual retries and never queues a payment", async () => {
  vi.useFakeTimers(); const element = document.createElement("div");document.body.append(element);
  const root = createRoot(element); const online = vi.fn();window.addEventListener("online", online);
  try {
    await act(async () => { finishDatabaseRequest(databaseGeneration(), 402); root.render(<ServiceAvailabilityNotice admin />); });
    expect(element.textContent).toContain("An empty result does not confirm");
    let button = element.querySelector("button")!;expect(button.disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(60_100); });expect(button.disabled).toBe(false);
    await act(async () => button.click());expect(online).toHaveBeenCalledOnce();expect(button.disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(15_001); });expect(button.disabled).toBe(false);
    await act(async () => finishDatabaseRequest(databaseGeneration(), 200));expect(element.textContent).toBe("");
  } finally { window.removeEventListener("online", online); await act(async () => root.unmount()); element.remove(); }
});
