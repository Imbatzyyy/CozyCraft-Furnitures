export type MaterialSpec = {
  type: string;
  description: string;
};

export type DimensionSpec = {
  label: string;
  value: string;
  unit: string;
};

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const parseJsonArray = (value: string): unknown[] | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const legacyLines = (value: string) =>
  value
    .split(/\n|•/)
    .map((line) => line.replace(/^[-–—]\s*/, "").trim())
    .filter(Boolean);

export function parseMaterialSpecs(value?: string | null): MaterialSpec[] {
  const source = clean(value);
  if (!source) return [{ type: "", description: "" }];

  const parsed = parseJsonArray(source);
  if (parsed) {
    const rows = parsed
      .map((item): MaterialSpec | null => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const type = clean(record.type);
        const description = clean(record.description);
        return type || description ? { type, description } : null;
      })
      .filter((row): row is MaterialSpec => Boolean(row));
    return rows.length ? rows : [{ type: "", description: "" }];
  }

  return legacyLines(source).map((line) => {
    const match = line.match(/^([^:–—]+?)\s*(?::|–|—)\s*(.+)$/);
    return match
      ? { type: match[1].trim(), description: match[2].trim() }
      : { type: line, description: "" };
  });
}

export function serializeMaterialSpecs(rows: MaterialSpec[]) {
  return JSON.stringify(
    rows
      .map((row) => ({
        type: clean(row.type),
        description: clean(row.description),
      }))
      .filter((row) => row.type || row.description),
  );
}

const dimensionNames: Record<string, string> = {
  W: "Width",
  D: "Depth",
  H: "Height",
  L: "Length",
};

function parseLegacyDimension(line: string): DimensionSpec[] {
  const compact = [...line.matchAll(/(\d+(?:\.\d+)?)\s*([WDHL])\b/gi)];
  if (compact.length > 1) {
    const unit = line.match(/\b(mm|cm|m|in|ft)\b/i)?.[1] ?? "cm";
    return compact.map((match) => ({
      label: dimensionNames[match[2].toUpperCase()] ?? match[2].toUpperCase(),
      value: match[1],
      unit,
    }));
  }

  const labelled = line.match(
    /^([^:–—]+?)\s*(?::|–|—)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft)?$/i,
  );
  if (labelled) {
    return [{
      label: labelled[1].trim(),
      value: labelled[2],
      unit: labelled[3] ?? "cm",
    }];
  }

  return [{ label: "Overall", value: line, unit: "" }];
}

export function parseDimensionSpecs(value?: string | null): DimensionSpec[] {
  const source = clean(value);
  if (!source) return [{ label: "", value: "", unit: "cm" }];

  const parsed = parseJsonArray(source);
  if (parsed) {
    const rows = parsed
      .map((item): DimensionSpec | null => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const label = clean(record.label);
        const dimensionValue = clean(record.value);
        const unit = clean(record.unit);
        return label || dimensionValue ? { label, value: dimensionValue, unit } : null;
      })
      .filter((row): row is DimensionSpec => Boolean(row));
    return rows.length ? rows : [{ label: "", value: "", unit: "cm" }];
  }

  return legacyLines(source).flatMap(parseLegacyDimension);
}

export function serializeDimensionSpecs(rows: DimensionSpec[]) {
  return JSON.stringify(
    rows
      .map((row) => ({
        label: clean(row.label),
        value: clean(row.value),
        unit: clean(row.unit),
      }))
      .filter((row) => row.label || row.value),
  );
}
