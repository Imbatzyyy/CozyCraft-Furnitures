export type TicketFilter = {
  status: "active" | "all" | "open" | "in_progress" | "resolved" | "closed";
  owner: "all" | "mine" | "unassigned";
  priority: "all" | "urgent";
};

export const defaultTicketFilter: TicketFilter = { status: "all", owner: "all", priority: "all" };

/** Statuses to request for a filter, or null for every status. */
export function ticketFilterStatuses(status: TicketFilter["status"]): string[] | null {
  if (status === "all") return null;
  if (status === "active") return ["open", "in_progress"];
  return [status];
}
