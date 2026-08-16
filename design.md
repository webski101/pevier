# Design — Pevier Signal Desk

The shared design contract for Pevier’s public site, signed-in operator workspace, and legal pages.

## Product character

Pevier is a policy control plane, not a generic social dashboard. The interface combines a calm editorial reading surface with the precision of an operations desk. It should feel accountable, legible, and ready for real publication traffic.

## Genre and macrostructures

- Genre: modern minimal with industrial telemetry.
- Public site: Narrative Workflow. A 7 / 5 split hero pairs a direct product statement with a real policy-decision instrument.
- Operator workspace: Workbench. A compact graphite rail frames dense but breathable operational surfaces.
- Legal pages: Long Document. Typography, rules, and readable line lengths carry the page.

## Signal Desk theme

- Warm bone paper replaces pure white.
- Graphite is reserved for the command rail, decision instruments, and footer.
- Policy green appears only on safe states, active navigation, and the primary action.
- Warning and danger colours are semantic containment signals, never decoration.
- Tonal surface changes communicate elevation. Shadows are exceptional.

The complete values live in [`tokens.css`](tokens.css). Material 3 semantic aliases and shadcn-compatible aliases resolve back to the same Pevier tokens; they do not introduce separate themes.

## Typography

- Display: Space Grotesk Variable, roman, 600–700.
- Body: Manrope Variable, 400–700.
- Machine data: JetBrains Mono, limited to IDs, hashes, timestamps, and compact status labels.
- Public hero: `clamp(3.25rem, 9vw, 6.7rem)`.
- App page title: `clamp(2.75rem, 5vw, 4.75rem)`.
- Body measure: 48–62 characters.

## Geometry and spacing

- Four-point spacing foundation with named tokens.
- Controls share a 44 px minimum height.
- Corners are 4, 8, 12, and 16 px. Pills are limited to genuine status indicators.
- Public content is constrained to 86 rem. Operator content is constrained to 88 rem.
- Nested card-on-card containment is avoided. Rules, spacing, and tonal shifts do most grouping.

## Navigation

- Public: N9 Edge-aligned Minimal. Brand and one account action only; legal links move to the footer.
- App: N3 Side Rail. Compact persistent rail on desktop, off-canvas rail on smaller widths.
- Footer: Ft5 Statement. A clear closing product position followed by the compact legal colophon.

## Motion

- One GSAP entrance timeline for the public hero.
- One GSAP ScrollTrigger reveal for the four workflow stages on viewports at least 40 rem wide.
- App state changes remain CSS-based and functional.
- Animation uses opacity and transform only.
- Reduced motion removes spatial movement and leaves content immediately visible.

## Interaction contract

- Every control has visible focus via `--color-focus`.
- Touch targets are at least 44 × 44 CSS px.
- Inputs keep a constant one-pixel border across states; focus uses an outline.
- Hover is supplemental and exists only for fine pointers.
- Buttons use direct verbs. Errors name what failed and what to do next.
- Successful actions stay quiet when their result is already visible.

## Responsive contract

- Verified targets: 320, 375, 414, 768, 1024, and 1440 CSS pixels.
- Root overflow uses `clip`, never `hidden`.
- Public hero stacks below 60 rem.
- App rail becomes an off-canvas drawer below 60 rem.
- Tables collapse into labelled record cards below 40 rem.
- Controls reflow; their labels never wrap.

## Page allowances

- Marketing may use one hand-built decision instrument and no decorative stock imagery.
- App views use live data, state, and evidence as their visual material.
- Legal pages remain still and typography-led.
- Platform brand colours may identify Instagram and Bluesky; they never replace Pevier’s system colours.

## Component guidance

- Use Phosphor icons throughout and select weight intentionally.
- Material 3 contributes semantic roles, tonal elevation, adaptive navigation, and touch dimensions.
- shadcn contributes compositional conventions for buttons, fields, dialogs, and semantic token aliases.
- Do not mix in additional icon families or component themes.

## Exports

### Source tokens

[`tokens.css`](tokens.css) is the complete source of truth for light, dark, semantic, Material 3, and shadcn-compatible roles.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(97.5% 0.009 105);
  --color-surface: oklch(94.8% 0.012 110);
  --color-ink: oklch(18% 0.024 150);
  --color-muted: oklch(43% 0.022 145);
  --color-accent: oklch(72% 0.185 144);
  --color-accent-ink: oklch(15% 0.035 150);
  --font-display: "Space Grotesk Variable", sans-serif;
  --font-body: "Manrope Variable", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --radius-card: 0.75rem;
  --radius-input: 0.5rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(97.5% 0.009 105)", "$type": "color" },
    "surface": { "$value": "oklch(94.8% 0.012 110)", "$type": "color" },
    "ink": { "$value": "oklch(18% 0.024 150)", "$type": "color" },
    "muted": { "$value": "oklch(43% 0.022 145)", "$type": "color" },
    "accent": { "$value": "oklch(72% 0.185 144)", "$type": "color" },
    "accent-ink": { "$value": "oklch(15% 0.035 150)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk Variable, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "Manrope Variable, sans-serif", "$type": "fontFamily" },
    "mono": { "$value": "JetBrains Mono, monospace", "$type": "fontFamily" }
  },
  "space": {
    "xs": { "$value": "0.5rem", "$type": "dimension" },
    "sm": { "$value": "0.75rem", "$type": "dimension" },
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" },
    "xl": { "$value": "2rem", "$type": "dimension" }
  }
}
```

### shadcn/ui variables

```css
:root {
  --background: 97.5% 0.009 105;
  --foreground: 18% 0.024 150;
  --card: 99% 0.004 105;
  --card-foreground: 18% 0.024 150;
  --primary: 72% 0.185 144;
  --primary-foreground: 15% 0.035 150;
  --muted: 94.8% 0.012 110;
  --muted-foreground: 43% 0.022 145;
  --destructive: 52% 0.2 28;
  --border: 84% 0.024 112;
  --input: 84% 0.024 112;
  --ring: 49% 0.18 255;
  --radius: 0.5rem;
}
```
