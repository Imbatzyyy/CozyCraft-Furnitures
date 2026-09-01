import { describe, expect, it } from "vitest";
import {
  formatPhilippineMobile,
  isSixDigitOtp,
  maskPhilippineMobile,
  normalizePhilippineMobile,
} from "./phone-verification";

describe("Philippine phone verification helpers", () => {
  it.each([
    ["0917 123 4567", "+639171234567"],
    ["0917-123-4567", "+639171234567"],
    ["639171234567", "+639171234567"],
    ["+639171234567", "+639171234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhilippineMobile(input)).toBe(expected);
  });

  it.each(["9171234567", "+6309171234567", "091712345", "hello"])(
    "rejects %s",
    (input) => expect(normalizePhilippineMobile(input)).toBeNull(),
  );

  it("formats and masks without exposing the whole number", () => {
    expect(formatPhilippineMobile("+639171234567")).toBe("0917 123 4567");
    expect(maskPhilippineMobile("+639171234567")).toBe("+6391•••4567");
  });

  it("accepts only a six digit OTP", () => {
    expect(isSixDigitOtp("123456")).toBe(true);
    expect(isSixDigitOtp("12345")).toBe(false);
    expect(isSixDigitOtp("12345a")).toBe(false);
  });
});
