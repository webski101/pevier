# Design — Pevier

A locked design system for the Pevier operator application. Every control surface shares this system; new pages extend it instead of inventing a new theme.

## Genre

Atmospheric technical. The app should feel like a calm operations room after dark, not a generic SaaS admin template.

## Macrostructure family

- Marketing surfaces: Narrative Workflow, with product proof replacing feature cards.
- App surfaces: Map / Diagram, with one dominant operational instrument and supporting rails.
- Content surfaces: Long Document, using the same type and palette without enrichment.

## Theme — Night Signal

- `--color-paper`: `oklch(11% 0.024 150)`
- `--color-surface`: `oklch(15% 0.028 150)`
- `--color-surface-raised`: `oklch(19% 0.03 150)`
- `--color-ink`: `oklch(95% 0.016 95)`
- `--color-muted`: `oklch(69% 0.022 120)`
- `--color-rule`: `oklch(25% 0.032 150)`
- `--color-accent`: `oklch(78% 0.19 142)`
- `--color-focus`: `oklch(78% 0.19 142)`

Phosphor green is used only for active, safe, and primary states. Ember red is semantic containment, never decoration. The light theme uses warm bone rather than pure white.

## Typography

- Display: Space Grotesk Variable, weight 700, roman
- Body: Manrope Variable, weight 400–700
- Mono: JetBrains Mono, limited to hashes, code, and machine timestamps
- Display tracking: `-0.055em`
- Display anchor: `clamp(3rem, 6vw, 6rem)`

## Spacing

Four-point named scale from `--space-3xs` through `--space-3xl`. App surfaces use fewer containers and larger internal gaps; equal card grids are avoided.

## Motion

- Entry: one opacity/translate reveal on route change
- State changes: `--ease-in-out`
- Incident events: short sequential ink-on
- Reduced motion: no spatial movement, maximum 150 ms

## Microinteractions stance

- Silent success when the result is already visible
- Focus indicators appear immediately
- Destructive portfolio kill requires explicit confirmation
- Hover never carries functionality unavailable to touch

## CTA voice

- Primary: phosphor fill, dark ink, 12 px radius, direct verb
- Secondary: elevated surface with a quiet boundary
- Destructive: transparent ember boundary until confirmation

## Per-page allowances

- App pages use live state, maps, and diagrams as the visual material. No decorative imagery.
- Marketing pages may use a hand-built system diagram.
- Content pages are typography-only.

## What pages must share

- Pevier shield and wordmark
- Night Signal palette and semantic state colors
- Space Grotesk + Manrope pairing
- Button geometry and focus treatment
- Dominant-instrument hierarchy

## What pages may differ on

- The dominant instrument: governor, queue, incident, or audit chain
- Supporting rail placement
- Data density, as long as mobile tables collapse to cards

## Exports

### tokens.css

The complete source of truth is [`tokens.css`](tokens.css). Core portable subset:

```css
:root {
  --color-paper: oklch(11% 0.024 150);
  --color-surface: oklch(15% 0.028 150);
  --color-ink: oklch(95% 0.016 95);
  --color-muted: oklch(69% 0.022 120);
  --color-rule: oklch(25% 0.032 150);
  --color-accent: oklch(78% 0.19 142);
  --color-accent-ink: oklch(13% 0.035 150);
  --color-focus: oklch(78% 0.19 142);
  --font-display: "Space Grotesk Variable", sans-serif;
  --font-body: "Manrope Variable", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius-sm: 0.75rem;
  --radius-md: 1.125rem;
  --radius-lg: 1.75rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 220ms;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(11% 0.024 150);
  --color-surface: oklch(15% 0.028 150);
  --color-ink: oklch(95% 0.016 95);
  --color-accent: oklch(78% 0.19 142);
  --font-display: "Space Grotesk Variable", sans-serif;
  --font-body: "Manrope Variable", sans-serif;
  --spacing-md: 1rem;
  --spacing-xl: 2.5rem;
  --radius-card: 1.125rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(11% 0.024 150)", "$type": "color" },
    "surface": { "$value": "oklch(15% 0.028 150)", "$type": "color" },
    "ink": { "$value": "oklch(95% 0.016 95)", "$type": "color" },
    "accent": { "$value": "oklch(78% 0.19 142)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk Variable", "$type": "fontFamily" },
    "body": { "$value": "Manrope Variable", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" },
    "xl": { "$value": "2.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 11% 0.024 150;
  --foreground: 95% 0.016 95;
  --card: 15% 0.028 150;
  --card-foreground: 95% 0.016 95;
  --primary: 78% 0.19 142;
  --primary-foreground: 13% 0.035 150;
  --muted: 25% 0.032 150;
  --muted-foreground: 69% 0.022 120;
  --destructive: 70% 0.20 28;
  --destructive-foreground: 13% 0.035 150;
  --border: 25% 0.032 150;
  --input: 25% 0.032 150;
  --ring: 78% 0.19 142;
  --radius: 1.125rem;
}
```
