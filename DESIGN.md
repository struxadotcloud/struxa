# Design Reference

This document defines the visual design language for all UI in this project. It is derived from the Bee.host game server management panel — a dark, dense, operator-focused interface. All UI work must follow these patterns.

---

## Overview

The aesthetic is a **dark ops panel**: the intersection of a terminal emulator and a modern SaaS dashboard. It prioritizes information density, functional clarity, and operational trust. Color is used sparingly — only for status signals, data charts, and critical actions. There is no decoration.

---

## Color Palette

| Role                                   | Value                                 |
| -------------------------------------- | ------------------------------------- |
| Background (base)                      | `#0a0a0a`                             |
| Surface (panels, cards)                | `#141414`                             |
| Surface elevated                       | `#1a1a1a`                             |
| Border / separator                     | `#222222` or `rgba(255,255,255,0.07)` |
| Text primary                           | `#ffffff`                             |
| Text secondary / labels                | `#888888`                             |
| Text tertiary / muted                  | `#555555`                             |
| Accent green (status, charts)          | `#22c55e`                             |
| Accent yellow/gold (logo, primary CTA) | `#f59e0b`                             |
| Danger / destructive                   | `#f43f5e`                             |
| Neutral action                         | `#374151`                             |

In Tailwind terms: use `zinc` and `neutral` scales for surfaces, `green-500` for connected/active states, `amber-400` for primary, `rose-500` for destructive.

---

## Typography

- **UI font**: Clean modern sans-serif — Inter or Geist. Never serif.
- **Terminal/console font**: Monospace — JetBrains Mono or Fira Code.
- **Stat labels**: ALL CAPS, letter-spacing wide (`tracking-widest`), small size (`text-xs`), muted color (`text-neutral-500`). Example: `ADDRESS`, `UPTIME`, `CPU`.
- **Stat values**: Large (`text-2xl`+), bold (`font-bold`), white (`text-white`). High visual weight.
- **Secondary values** (limits, maxes): Inline, same line or immediately after, muted gray, smaller. Example: `/ 4 GB`, `/ 200%`.
- **Nav labels**: Regular weight, muted when inactive, white when active.

---

## Layout System

Three-column fixed structure, full viewport height:

```
┌──────────┬───────────────────────────────┬────────────┐
│          │  Header / Breadcrumb bar       │            │
│ Sidebar  ├───────────────────────────────┤ Stats      │
│ ~200px   │  Main content (scrollable)    │ Panel      │
│ fixed    │  flex-grow                    │ ~280px     │
│          │                               │ fixed      │
└──────────┴───────────────────────────────┴────────────┘
```

- Sidebar: fixed, full-height, no scroll.
- Main content: takes remaining width, scrollable vertically.
- Right stats panel: fixed, full-height, vertically stacked metric rows.
- All three panels share the same base background; surfaces inside use slightly elevated colors.

---

## Sidebar Navigation

- Logo at top: brand icon (color) + wordmark (white). Clear visual anchor.
- Resource/context label below logo: small, all-caps, muted. Identifies the active resource (e.g. `WAFFLESMP`).
- Nav items: `icon + label`, full-width, left-aligned, comfortable padding.
  - **Active**: light background fill (e.g. `bg-white/10` or `bg-neutral-800`) with white text and icon.
  - **Inactive**: muted gray icon and text, no background. Hover: subtle background tint.
- User row pinned to bottom: avatar thumbnail + display name + secondary info (e.g. account balance), with a context menu affordance.

---

## Header & Breadcrumb Bar

- Minimal top bar, no heavy chrome.
- Left: breadcrumb — `Icon > Resource Type > Resource Name`, flat and small, separators in muted gray.
- Right: action buttons — flat (no rounding), color-coded:
  - **Primary / Start**: `bg-white text-black` (dark mode) / `bg-black text-white` (light mode) — monochromatic
  - **Restart**: `bg-neutral-700 text-white`
  - **Stop**: `bg-rose-500 text-white`
- Buttons are compact, not full-width. Group them tightly.

---

## Main Content Panel

The main area hosts the active view (console, file manager, settings, etc.).

### Console / Terminal View

- Full-bleed dark fill, no inner border radius.
- **Status bar** at top of console area: colored status dot + label left-aligned; gear icon + fullscreen icon right-aligned.
  - Connected: green dot (`bg-green-500`) + `Connected` text.
- **Terminal output**: scrollable, monospace font.
  - Timestamps: muted gray, right-padded. Example: `16:33:14`.
  - Command prompts: cyan or green highlight. Example: `container@waffle.host~`.
  - Output text: white.
- **Input bar** fixed at bottom of console: full-width dark input, `Type a command...` placeholder, send button (icon, right side, accent color on hover).

### General Content Panels

- Content sits on `surface` background inside the main area.
- Internal sections use subtle `border-b border-neutral-800` separators.
- No drop shadows — separation via color only.

---

## Right Stats Panel

Stacked metric rows with thin horizontal rules between them.

### Metric Row Structure

```
[icon]  LABEL NAME              [optional action icon]
        Large Bold Value   / secondary muted value
```

- Label line: `text-xs tracking-widest text-neutral-500 uppercase` + lucide/heroicon at 14px.
- Value line: `text-2xl font-bold text-white`.
- Secondary value: inline, `text-neutral-500 text-sm`. Example: `/ 10 GB`, `/ 20`.
- Rows are separated by `border-b border-neutral-800`.

### Sparkline / Chart Rows

- Used for network metrics (INBOUND, OUTBOUND).
- Small area chart, no axes, no labels — pure signal.
- Fill color: accent green (`#22c55e`) at low opacity, stroke green at full opacity.
- Height: ~60–80px within the row.

### Special Rows

- **ADDRESS**: value is a monospace connection string; copy-to-clipboard icon on the right.
- **PLAYERS**: format `current / max` (e.g. `0 / 20`).

---

## Component Patterns

### Button

```
px-4 py-1.5 text-sm font-medium
```

No rounding (`rounded-*` is forbidden). No border, no shadow. Intent communicated through fill color:

- **Primary**: `bg-white text-black` in dark mode, `bg-black text-white` in light mode — monochromatic.
- **Destructive**: `bg-rose-500 text-white`.
- **Neutral**: `bg-neutral-700 text-white`.

### Status Dot

```
w-2 h-2 rounded-full bg-green-500 inline-block
```

Green = connected/active. Red/orange = error/stopped. Gray = unknown/offline.

### Stat Card Row

See Right Stats Panel above. The pattern: label (icon + allcaps muted) → value (large bold white) → optional secondary (muted). Always vertically stacked within a fixed-width panel.

### Sparkline Chart

No axes, no grid, no labels. Area fill at 20% opacity, stroke at 100%. Accent green. Embedded inline within a metric row, not a standalone chart.

### Section List Panel

Use for any list of items inside a content region (server list, file list, user list, etc.). Do **not** use floating cards with individual 4-sided borders.

Structure:

- Outer container: `border-l border-t border-[#222222]` — provides the top and left edges.
- Each item: `border-r border-b border-[#222222]` — completes the cell border; all borders collapse to 1px shared lines with no gaps.
- Item background: transparent (inherits base `#0a0a0a`). Hover: `hover:bg-[#111111]`.
- For multi-column: use `grid grid-cols-N` on the container — the border collapse trick works for any column count.
- No `gap`. No `rounded-*`. No shadow.

This mirrors the Right Stats Panel — sections share walls rather than floating independently.

### Nav Item

```
flex items-center gap-2 px-3 py-2 rounded-md text-sm
```

Active: `bg-white/10 text-white`. Inactive: `text-neutral-400 hover:bg-white/5`.

### Breadcrumb

```
Icon  >  "Resource Type"  >  "Resource Name"
```

Separator: `text-neutral-600`. Items: `text-neutral-400`, active leaf: `text-white`.

### Terminal Line

```
[timestamp]  [prompt-colored]  [output text]
```

Rendered in monospace. Timestamps right-padded in a fixed-width column. Prompt segments colored (cyan, green). Output white.

### Input Bar

Full-width, dark background (`bg-neutral-900`), subtle border (`border border-neutral-800`), placeholder in `text-neutral-500`. Send button: icon-only, right-aligned, accent color on hover.

---

## Tone & Personality

- **Dark, dense, technical.** Built for operators who live in terminals.
- **High information density without clutter.** Every visible element carries data.
- **Color used sparingly.** Only for status signals (green = live), data visualization (charts), and critical actions (red = stop). Everything else is white on black.
- **No decoration.** No gradients on UI chrome, no drop shadows, no illustrations, no empty states with playful art.
- **Flat hierarchy.** Separation is achieved through color lightness, not shadows or elevation.
- **Monospace is a first-class font.** Terminal interfaces are not styled away — they are embraced.
