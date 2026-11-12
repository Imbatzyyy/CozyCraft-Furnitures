export const fileLimit = 5 * 1024 * 1024;
export async function evidenceType(file: File, allowPdf: boolean) {
  if (!file.size || file.size > fileLimit) return null;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...seq: number[]) => seq.every((n, i) => bytes[i] === n);
  const text = new TextDecoder().decode(bytes);
  let mime = "";
  if (starts(255, 216, 255)) mime = "image/jpeg";
  else if (starts(137, 80, 78, 71, 13, 10, 26, 10)) mime = "image/png";
  else if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") mime = "image/webp";
  else if (allowPdf && text.startsWith("%PDF-") && (await file.slice(-1024).text()).includes("%%EOF")) mime = "application/pdf";
  return mime && mime === file.type ? mime : null;
}

// Only remove unique, server-generated paths from THIS attempt. An uncertain
// database commit must never delete evidence that a real record may reference.
export async function saveEvidence(files: File[], path: (f: File) => string,
  upload: (p: string, f: File) => Promise<boolean>, remove: (p: string[]) => Promise<boolean>,
  commit: (p: string[]) => Promise<"saved" | "rejected" | "unknown">) {
  const paths: string[] = [];
  const clean = async () => {
    try { if (await remove(paths)) return; } catch { /* below */ }
    console.warn("customer_evidence_cleanup_unconfirmed"); // no identifiers or filenames
  };
  try {
    for (const f of files) {
      const p = path(f);
      paths.push(p);
      if (!await upload(p, f)) throw Error("upload failed");
    }
  } catch {
    await clean();
    return "upload_failed" as const;
  }
  let result: "saved" | "rejected" | "unknown" = "unknown";
  try { result = await commit(paths); } catch { /* unknown commit outcome */ }
  if (result === "rejected") await clean();
  if (result === "unknown") console.warn("customer_evidence_commit_unconfirmed");
  return result;
}
