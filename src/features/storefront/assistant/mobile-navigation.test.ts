import { describe, it, expect } from "vitest";
import { MOBILE_CARE_PAGES, mobilePageFor, mobileTaskSteps } from "../../../../supabase/functions/_shared/cozycraft-mobile-pages";
import { findMobileHelpGuides, mobileAssistantReference } from "../../../../supabase/functions/_shared/cozycraft-mobile-guides";
import { findHelpGuides } from "../../../../supabase/functions/_shared/cozycraft-assistant-knowledge";
import { classifyAssistantRequest } from "../../../../supabase/functions/_shared/cozycraft-assistant-scope";

describe("current mobile navigation knowledge", () => {
  it.each(MOBILE_CARE_PAGES)("documents $destination without a raw URL", page => {
    expect(page.steps.length).toBeGreaterThan(0);
    expect(page.steps.join(" ")).not.toMatch(/https?:|website footer|\/profile/);
  });
  it("has unique destinations and keeps the app roster distinct from company history", () => {
    expect(new Set(MOBILE_CARE_PAGES.map(p => p.destination)).size).toBe(MOBILE_CARE_PAGES.length);
    expect(mobileAssistantReference().team).toContain("Sammuel Guill Concepcion");
    expect(mobilePageFor("Where is Company History?")?.destination).toBe("history");
    expect(classifyAssistantRequest("Where is the Developers page?").allowed).toBe(true);
  });
  it("uses the mobile invoice workflow without altering website receipt guidance", () => {
    expect(findMobileHelpGuides("How do I request an invoice?", [])[0].steps.join(" ")).toContain("Request an invoice");
    expect(findHelpGuides("How do I request an invoice?")[0].steps.join(" ")).toContain("download receipt");
    expect(mobileTaskSteps("continue payment")?.join(" ")).toContain("already charged");
  });
  it("does not invent mobile device management or footer settings", () => {
    expect(findMobileHelpGuides("Where are signed-in devices?", [])[0].note).toContain("no signed-in-devices");
    expect(findMobileHelpGuides("Where is privacy?", [])[0].steps.join(" ")).toContain("navigation menu");
  });
});
