// Quote CSV and neutralize spreadsheet formulas in user-controlled text.
export function reportCsv(rows: Array<Array<string | number | null>>) {
  return rows.map(row => row.map(value => {
    const text = String(value ?? "");
    const safe = typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}
