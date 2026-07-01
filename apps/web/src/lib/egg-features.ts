export function parseEggFeatures(features: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(features ?? "[]");
    return Array.isArray(parsed) && parsed.every((f) => typeof f === "string") ? parsed : [];
  } catch {
    return [];
  }
}
