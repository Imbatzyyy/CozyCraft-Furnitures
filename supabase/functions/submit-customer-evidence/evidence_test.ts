import assert from "node:assert/strict";
import { evidenceType, saveEvidence } from "./evidence.ts";

Deno.test("evidence checks actual signatures, declared content type and support-only PDFs", async () => {
  const pdf = new File(["%PDF-1.7\n%%EOF"], "sample.pdf", { type:"application/pdf" });
  assert.equal(await evidenceType(pdf, true), "application/pdf");
  assert.equal(await evidenceType(pdf, false), null);
  assert.equal(await evidenceType(new File(["plain text"], "image.png", {type:"image/png"}), false), null);
  assert.equal(await evidenceType(new File([new Uint8Array([137,80,78,71,13,10,26,10])], "image.png", {type:"image/png"}), false), "image/png");
});
for (const mode of ["upload-failure","saved","rejected","unknown","commit-throws"] as const) {
  Deno.test("evidence lifecycle: " + mode, async () => {
    const files = ["one","two","three"].map(n => new File(["test"], n));
    let removed: string[] = [], commits = 0;
    const result = await saveEvidence(files, f => f.name, async p => !(p === "two" && mode === "upload-failure"),
      async paths => { removed = paths.slice(); return true; }, async paths => {
        commits++; assert.deepEqual(paths, ["one","two","three"]);
        if (mode === "commit-throws") throw Error("transport lost");
        if (mode === "upload-failure") throw Error("unexpected commit");
        return mode;
      });
    assert.equal(result, mode === "upload-failure" ? "upload_failed" : mode === "commit-throws" ? "unknown" : mode);
    assert.equal(commits, mode === "upload-failure" ? 0 : 1);
    assert.deepEqual(removed, mode === "upload-failure" ? ["one","two"] : mode === "rejected" ? ["one","two","three"] : []);
  });
}
