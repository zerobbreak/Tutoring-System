# Theme Palette

This document centralizes the color system already used by the app. New UI work should prefer these tokens and existing semantic Tailwind classes before introducing any new hex values.

## Brand Palette

### Core light theme tokens

- `--sea-ink` `#173a40`
- `--sea-ink-soft` `#416166`
- `--lagoon` `#4fb8b2`
- `--lagoon-deep` `#328f97`
- `--palm` `#2f6a4a`
- `--sand` `#e7f0e8`
- `--foam` `#f3faf5`
- `--bg-base` `#e7f3ec`

### Supporting surface tokens

- `--surface` `rgba(255, 255, 255, 0.74)`
- `--surface-strong` `rgba(255, 255, 255, 0.9)`
- `--line` `rgba(23, 58, 64, 0.14)`
- `--inset-glint` `rgba(255, 255, 255, 0.82)`
- `--kicker` `rgba(47, 106, 74, 0.9)`
- `--header-bg` `rgba(251, 255, 248, 0.84)`
- `--chip-bg` `rgba(255, 255, 255, 0.8)`
- `--chip-line` `rgba(47, 106, 74, 0.18)`
- `--hero-a` `rgba(79, 184, 178, 0.36)`
- `--hero-b` `rgba(47, 106, 74, 0.2)`

## Dark Mode Tokens

### Core dark theme tokens

- `--sea-ink` `#d7ece8`
- `--sea-ink-soft` `#afcdc8`
- `--lagoon` `#60d7cf`
- `--lagoon-deep` `#8de5db`
- `--palm` `#6ec89a`
- `--sand` `#0f1a1e`
- `--foam` `#101d22`
- `--bg-base` `#0a1418`

### Supporting dark surface tokens

- `--surface` `rgba(16, 30, 34, 0.8)`
- `--surface-strong` `rgba(15, 27, 31, 0.92)`
- `--line` `rgba(141, 229, 219, 0.18)`
- `--inset-glint` `rgba(194, 247, 238, 0.14)`
- `--kicker` `#b8efe5`
- `--header-bg` `rgba(10, 20, 24, 0.8)`
- `--chip-bg` `rgba(13, 28, 32, 0.9)`
- `--chip-line` `rgba(141, 229, 219, 0.24)`
- `--hero-a` `rgba(96, 215, 207, 0.18)`
- `--hero-b` `rgba(110, 200, 154, 0.12)`

## Semantic Tailwind Tokens

These are the theme tokens exposed through `@theme inline` in `src/styles.css` and should be preferred over ad hoc color values:

- `bg-background`
- `text-foreground`
- `bg-card`
- `text-card-foreground`
- `bg-popover`
- `text-popover-foreground`
- `bg-primary`
- `text-primary-foreground`
- `bg-secondary`
- `text-secondary-foreground`
- `bg-muted`
- `text-muted-foreground`
- `bg-accent`
- `text-accent-foreground`
- `border-border`
- `ring-ring`
- `bg-destructive`
- `text-destructive-foreground`
- `bg-sidebar`
- `text-sidebar-foreground`
- `bg-sidebar-primary`
- `text-sidebar-primary-foreground`
- `bg-sidebar-accent`
- `text-sidebar-accent-foreground`

## Neutral And Status Colors Already Used

The app also uses standard Tailwind semantic colors in a few places. Keep using them when they communicate status clearly:

- `emerald` for success and approved/completed states
- `amber` for warnings, pending work, and attention states
- `red`/`destructive` for errors and destructive actions

## Usage Rules

- Do not create new colors unless the palette is being formally expanded.
- Do not update existing colors casually; only change them intentionally and document the reason.
- Prefer the theme CSS variables in `src/styles.css` for brand-specific color work.
- Prefer semantic Tailwind classes for layouts, cards, text, borders, and common states.
- Avoid introducing one-off hex colors in new components unless the palette file is updated first.
- If a new color is needed, add it to `src/styles.css` first and document it here.
- Keep light and dark mode values paired when adding or changing a token.
- Do not replace accessible semantic status colors with brand colors when the meaning would become less clear.
- Keep the existing font stack unchanged unless there is a deliberate typography update.
- If two colors are effectively the same, consolidate them into one shared token or CSS variable and give that shared value a single clear name.

## Auth marketing tokens

Used on unauthenticated `/auth/*` routes (login, register, password recovery, MFA). Add or change these in `src/styles.css` only—do not use raw hex in auth route files.

| Token | Light | Role |
|-------|-------|------|
| `--auth-canvas` | `#f7f7f7` | Page background |
| `--auth-ink` | `#0a1128` | Headings, labels, primary buttons, focus rings |
| `--auth-accent` | `#ff6f61` | Hero highlight italic text and text links |
| `--auth-hero-overlay` | `#0a1128` | Sidebar image gradient base |
| `--auth-muted` | `#6b7280` | Form footers, secondary copy |
| `--auth-muted-subtle` | `#9ca3af` | Fine print, hints |
| `--auth-hero-muted` | `rgba(255,255,255,0.72)` | Hero description on dark overlay |
| `--auth-border` | `#e5e7eb` | Input borders on auth forms |

Dark mode uses paired values on `.dark`. Prefer `text-(--auth-ink)`, `bg-(--auth-canvas)`, etc., or helpers in `src/components/auth/auth-marketing-styles.ts`.

## Design Intent

The app’s visual language is a calm lagoon/sea palette:

- deep teal for primary brand emphasis
- aqua lagoon for highlights and focus states
- soft moss/green for positive or calm secondary accents
- sand/foam for airy backgrounds and surfaces
- amber and emerald reserved for status signaling
