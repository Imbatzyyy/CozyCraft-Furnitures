import { describe, expect, it } from "vitest";
import {
  customerAuthHref,
  isCheckoutAuthDestination,
  resolveCustomerAuthDestination,
} from "./customer-auth-destination";

describe("customer authentication destinations", () => {
  it("preserves an embedded checkout route", () => {
    expect(resolveCustomerAuthDestination("/checkout", "?items=a,b")).toBe(
      "/checkout?items=a,b",
    );
  });

  it("honors safe next destinations and rejects external redirects", () => {
    expect(resolveCustomerAuthDestination("/login", "?next=%2Fcheckout")).toBe(
      "/checkout",
    );
    expect(resolveCustomerAuthDestination("/login", "?next=%2F%2Fevil.test")).toBe(
      "/profile",
    );
  });

  it("keeps the checkout destination when switching auth modes", () => {
    expect(customerAuthHref("/signup", "/checkout?items=a,b")).toBe(
      "/signup?next=%2Fcheckout%3Fitems%3Da%2Cb",
    );
    expect(customerAuthHref("/login", "/profile")).toBe("/login");
  });

  it("recognizes checkout destinations with or without a query", () => {
    expect(isCheckoutAuthDestination("/checkout")).toBe(true);
    expect(isCheckoutAuthDestination("/checkout?items=a")).toBe(true);
    expect(isCheckoutAuthDestination("/profile")).toBe(false);
  });
});
