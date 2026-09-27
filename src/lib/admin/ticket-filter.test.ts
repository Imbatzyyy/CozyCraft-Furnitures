import { expect, it } from "vitest";
import { ticketFilterStatuses } from "./ticket-filter";

it("maps inbox filters to ticket statuses", () => {
  expect(ticketFilterStatuses("all")).toBeNull();
  expect(ticketFilterStatuses("active")).toEqual(["open", "in_progress"]);
  expect(ticketFilterStatuses("resolved")).toEqual(["resolved"]);
});
