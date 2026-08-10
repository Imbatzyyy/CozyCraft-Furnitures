import { describe, expect, it } from "vitest";
import {
  functionErrorMessage,
  isHandledFunctionResponse,
} from "./function-error";

describe("functionErrorMessage", () => {
  it("reads the useful JSON error returned by an Edge Function", async () => {
    const response = new Response(
      JSON.stringify({ error: "Delivery address not found" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );

    await expect(
      functionErrorMessage(
        {
          message: "Edge Function returned a non-2xx status code",
          context: response,
        },
        "Unable to start secure payment.",
      ),
    ).resolves.toBe("Delivery address not found");
    expect(isHandledFunctionResponse({ context: response })).toBe(true);
  });

  it("does not expose the generic SDK message", async () => {
    await expect(
      functionErrorMessage(
        { message: "Edge Function returned a non-2xx status code" },
        "Unable to start secure payment.",
      ),
    ).resolves.toBe("Unable to start secure payment.");
  });
});
