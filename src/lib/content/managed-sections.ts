export type ManagedContentSection = {
  title: string;
  body: string;
};

function isSectionHeading(value: string) {
  const normalized = value.replace(/[^A-Za-z]/g, "");
  return (
    value.length <= 100 &&
    normalized.length >= 3 &&
    normalized === normalized.toUpperCase()
  );
}

export function parseManagedSections(body: string): ManagedContentSection[] {
  const lines = body.split(/\r?\n/g);
  if (!lines.some((line) => line.trim())) return [];

  const sections: ManagedContentSection[] = [];
  let current: ManagedContentSection | null = null;

  for (const line of lines) {
    const value = line.trim();
    if (!value) {
      if (current?.body && !current.body.endsWith("\n\n")) current.body += "\n\n";
      continue;
    }

    if (isSectionHeading(value)) {
      if (current) sections.push({ ...current, body: current.body.trim() });
      current = { title: value.replace(/\s+/g, " "), body: "" };
      continue;
    }

    if (!current) {
      current = { title: "Details", body: value };
      continue;
    }

    current.body += `${current.body && !current.body.endsWith("\n\n") ? "\n" : ""}${value}`;
  }

  if (current) sections.push({ ...current, body: current.body.trim() });
  return sections;
}

export function managedSectionTitle(title: string) {
  if (title === "Details") return title;
  return title
    .toLocaleLowerCase("en-PH")
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase("en-PH")}`,
    );
}
