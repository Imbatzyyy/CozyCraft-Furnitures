import { describe, expect, it } from "vitest";
import { buildTeamInvitationEmail } from "../../../supabase/functions/_shared/team-invitation-email";

describe("team invitation email", () => {
  it("includes one secure call to action and a plain-text alternative", () => {
    const actionLink = "https://project.supabase.co/auth/v1/verify?type=invite&token=abc";
    const email = buildTeamInvitationEmail({
      actionLink,
      role: "admin",
      supportEmail: "support@example.com",
    });

    expect(email.subject).toBe(
      "Invitation to join CozyCraft Furnitures as Administrator",
    );
    expect(email.html).toContain(actionLink.replace("&", "&amp;"));
    expect(email.text).toContain(actionLink);
    expect(email.text).toContain("not a marketing message");
    expect(email.html.match(/Accept secure invitation/g)).toHaveLength(1);
  });

  it("describes only the assigned role", () => {
    const email = buildTeamInvitationEmail({
      actionLink: "https://project.supabase.co/auth/v1/verify?type=invite&token=abc",
      role: "staff",
      supportEmail: "support@example.com",
    });

    expect(email.text).toContain("Catalog, inventory, orders, reviews");
    expect(email.text).not.toContain("Full administrative access");
  });
});
