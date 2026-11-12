import assert from "node:assert/strict";
import { changeStatus } from "./status.ts";
for (const active of [true, false]) {
  for (const failure of ["auth", "profile", "audit", "none"]) {
    Deno.test("customer status active=" + active + " failure=" + failure, async () => {
      const calls: string[] = [];
      const step = (name: string) => async () => { calls.push(name); if (failure === "auth" && name === failure) throw Error("provider offline"); return name !== failure; };
      const result = await changeStatus(active, step("profile"), step("auth"), async (action, stage) => {
        calls.push(action + ":" + stage); return failure !== "audit";
      });
      const sequence = active ? ["auth", "profile"] : ["profile", "auth"];
      const failedAt = sequence.indexOf(failure);
      assert.deepEqual(calls, failedAt < 0 ? [...sequence, (active ? "customer_reactivated" : "customer_suspended") + ":complete"] :
        [...sequence.slice(0, failedAt + 1), "customer_status_incomplete:" + failure]);
      assert.equal(result.success === true, failure === "none");
      assert.equal(Boolean(result.error), failure !== "none");
    });
  }
}
