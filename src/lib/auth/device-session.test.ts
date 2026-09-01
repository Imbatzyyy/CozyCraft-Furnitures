import { describe, expect, it } from "vitest";
import { describeDevice } from "./device-session";

describe("describeDevice", () => {
  it("recognizes Chrome on Windows", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Google Chrome", device: "Windows computer" });
  });

  it("recognizes Safari on iPhone", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "Safari", device: "iPhone" });
  });

  it("does not mistake Edge for Chrome", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
      ),
    ).toEqual({ browser: "Microsoft Edge", device: "Mac" });
  });
});
