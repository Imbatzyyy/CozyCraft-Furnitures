type Step = () => Promise<boolean>;
type AuditAction = "customer_reactivated" | "customer_suspended" | "customer_status_incomplete";
export async function changeStatus(active: boolean, profile: Step, auth: Step,
  record: (action: AuditAction, stage: string) => Promise<boolean>) {
  const safely = async (step: Step) => { try { return await step(); } catch { return false; } };
  // Restrict the profile first when suspending. Restore the profile last when
  // enabling so a failed Auth operation does not grant application access.
  const steps = active ? [["auth", auth], ["profile", profile]] as const
    : [["profile", profile], ["auth", auth]] as const;
  for (const [stage, step] of steps) {
    if (!await safely(step)) {
      const audited = await safely(() => record("customer_status_incomplete", stage));
      return { error: "Account status was not fully confirmed. Retry the same action." +
        (audited ? "" : " The audit entry could not be confirmed either.") };
    }
  }
  if (!await safely(() => record(active ? "customer_reactivated" : "customer_suspended", "complete"))) {
    return { error: "Account status was applied, but the audit entry was not confirmed. Retry the same action." };
  }
  return { success: true, message: active ? "Customer account reactivated." : "Customer account suspended." };
}
