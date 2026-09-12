import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareCustomerPhoto } from "./prepare-photo";
const mocks = vi.hoisted(() => ({ convert: vi.fn(), optimize: vi.fn() }));
vi.mock("heic-to/csp", () => ({ heicTo: mocks.convert }));
vi.mock("./image-upload", () => ({ optimizeImageUpload: mocks.optimize }));
afterEach(() => vi.resetAllMocks());
describe("iPhone photo conversion workflow", () => {
  it("converts HEIC locally before the normal upload optimizer", async () => {
    mocks.convert.mockResolvedValue(new Blob(["jpeg-output"], { type: "image/jpeg" })); mocks.optimize.mockImplementation(file => file);
    const result = await prepareCustomerPhoto(new File(["heic-input"], "IMG_1.HEIC", { type: "image/heic" }));
    expect(result.name).toBe("IMG_1.jpg"); expect(result.type).toBe("image/jpeg");
    expect(mocks.convert).toHaveBeenCalledWith(expect.objectContaining({ type: "image/jpeg", quality: 0.84 }));
    expect(mocks.optimize).toHaveBeenCalledWith(result, { maxDimension: 1600, quality: 0.84 });
  });
  it("does not load a converter for ordinary photos and explains conversion failures", async () => {
    mocks.optimize.mockImplementation(file => file); const ordinary = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });
    expect(await prepareCustomerPhoto(ordinary)).toBe(ordinary); expect(mocks.convert).not.toHaveBeenCalled();
    mocks.convert.mockRejectedValue(new Error("invalid format"));
    await expect(prepareCustomerPhoto(new File(["invalid"], "photo.heic"))).rejects.toThrow("export it as JPG");
  });
});
