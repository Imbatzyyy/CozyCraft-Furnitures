import { describe, expect, it } from "vitest";
import { avatarObjectPath } from "./avatar-url";

describe("avatarObjectPath", () => {
  it("keeps private avatar object paths", () => {
    expect(avatarObjectPath("user-id/avatar.webp")).toBe(
      "user-id/avatar.webp",
    );
  });

  it("converts legacy public avatar URLs to storage paths", () => {
    expect(
      avatarObjectPath(
        "https://example.supabase.co/storage/v1/object/public/avatars/user-id/My%20Photo.jpg?width=96",
      ),
    ).toBe("user-id/My Photo.jpg");
  });

  it("does not try to sign third-party identity-provider images", () => {
    expect(avatarObjectPath("https://lh3.googleusercontent.com/avatar")).toBeNull();
  });
});
