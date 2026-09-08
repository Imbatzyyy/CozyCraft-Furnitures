import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HomeCircleView } from "./HomeCircle";
import { ProfileOverview } from "./ProfileOverview";
import type { CircleSnapshot } from "@/services/content/home-circle.service";

const snapshot: CircleSnapshot = { account: { points_balance: 375, lifetime_eligible_spend: 18000, tier: "plus", tier_valid_until: null }, activity: Array.from({length: 12}, (_, i) => ({id:String(i),points:100,description:`Delivery ${i}`,created_at:"2026-09-01"})), rewards:[{id:"1",discount_amount:300,minimum_order_amount:5000,reward_source:"points",status:"available",expires_at:"2099-01-01"},{id:"2",discount_amount:999,minimum_order_amount:0,reward_source:"points",status:"available",expires_at:"2020-01-01"}] };
const render = (data: CircleSnapshot | null, error = "") => renderToStaticMarkup(<MemoryRouter><HomeCircleView snapshot={data} busy={false} error={error} refresh={() => {}}/></MemoryRouter>);
describe("Home Circle presentation", () => {
  it("uses persisted tier and spend, and renders only five recent entries", () => {
    const html=render(snapshot);
    expect(html).toContain("Cozy Plus"); expect(html).toContain("375"); expect(html).toContain("₱32,000");
    expect(html).toContain("Delivery 4"); expect(html).not.toContain("Delivery 5");
  });
  it("disables expired rewards and exposes website conversion", () => {
    const html=render(snapshot); expect(html).toContain("₱300 off");expect(html).toContain('disabled="">Expired / unavailable');expect(html).toContain("Convert to voucher");
  });
  it("does not misrepresent unavailable data as a zero balance", () => {
    const html=render(null,"Please try again"); expect(html).toContain("Please try again");expect(html).toContain("Refresh to load"); expect(html).not.toContain("Your level");
  });
  it("renders elite without another tier target", () => {
    const html=render({...snapshot,account:{...snapshot.account,tier:"elite",lifetime_eligible_spend:150000}});expect(html).toContain("highest Home Circle tier");expect(html).toContain("100%");
  });
  it("keeps read-only profile details legible with truthful verification", () => {
    const html=renderToStaticMarkup(<ProfileOverview name="Test Customer" username="customer" email="test@example.com" phone="" verified={false} gender="" birth="" openCircle={() => {}}/>);
    expect(html).toContain("Not added");expect(html).not.toContain("Verified");expect(html).toContain("Prefer not to say");expect(html).not.toContain("<input");
  });
});
