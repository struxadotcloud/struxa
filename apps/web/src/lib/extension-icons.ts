import {
  Activity,
  Blocks,
  Boxes,
  Database,
  Gauge,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Puzzle,
  Server,
  Settings2,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Allowlisted icons an extension manifest may reference by name. Keeping this a
 * fixed map (rather than importing arbitrary icons by string) avoids shipping
 * the whole Lucide set and prevents extensions from pulling in unexpected
 * components. Unknown names fall back to the Puzzle icon.
 */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  Blocks,
  Boxes,
  Database,
  Gauge,
  LayoutDashboard,
  Package,
  Puzzle,
  Server,
  Settings2,
  Sparkles,
  Users,
  Wrench,
  Zap,
};

export function getExtensionIcon(name: string | null | undefined): LucideIcon {
  if (name && name in ICONS) return ICONS[name]!;
  return Puzzle;
}
