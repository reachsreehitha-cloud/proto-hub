/** Deterministic unique cover look per prototype - no shared localhost preview. */

const PALETTES = [
  ["#0f766e", "#134e4a", "#99f6e4"],
  ["#1d4ed8", "#1e3a8a", "#93c5fd"],
  ["#7c3aed", "#4c1d95", "#c4b5fd"],
  ["#be185d", "#831843", "#fbcfe8"],
  ["#c2410c", "#7c2d12", "#fed7aa"],
  ["#0f766e", "#164e63", "#a5f3fc"],
  ["#a16207", "#713f12", "#fde68a"],
  ["#047857", "#064e3b", "#6ee7b7"],
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function coverPaletteFor(id: string) {
  const hash = hashString(id || "prototype");
  const palette = PALETTES[hash % PALETTES.length];
  const angle = 120 + (hash % 160);
  return {
    from: palette[0],
    via: palette[1],
    to: palette[2],
    angle,
  };
}

export function coverInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Shared localhost cannot identify which draft is running - never use as a card cover. */
export function isSharedLocalPreview(url?: string | null): boolean {
  if (!url?.trim()) return true;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return true;
  }
}
