# Design

> Source of truth for typography, color, motion, layout, and component tokens.
> Read this before changing UI.

## Aesthetic direction

Expressive paper neo-brutalism: warm cream canvas, ink outlines, offset shadows, coral action color, and a tactile editorial chat workspace.

## Dials

- DESIGN_VARIANCE: 9 / 10
- MOTION_INTENSITY: 6 / 10
- VISUAL_DENSITY: 6 / 10

## Type stack

- Display and body: Space Grotesk via `next/font/google`
- Mono: JetBrains Mono via `next/font/google`
- Banned: Inter, Roboto, Arial as primary interface typography

## Color tokens

```css
:root {
  --surface: 255 249 232;      /* warm paper */
  --surface-raised: 255 255 255; /* clean paper card */
  --surface-overlay: 255 240 194; /* sun paper */
  --surface-mid: 255 229 120;  /* yellow chrome */
  --border: 27 26 22;          /* ink */
  --content: 27 26 22;
  --accent: 255 90 95;         /* coral */
}
```

Accent presets: Coral default, Sun, Cobalt, plus existing runtime choices. Never use a purple-to-blue gradient.

## Elevation and shape

- Major surfaces: 3px ink border, `6px 6px 0` hard offset shadow
- Buttons: 3px ink border, `4px 4px 0` shadow; press translates into its shadow
- Corners: 2px to 8px; use fully round shapes only for status dots or intentionally circular controls
- No blur, glassmorphism, soft shadows, or gradients as surface treatment

## Motion

- Framer Motion only; no GSAP added
- Spring entrance: stiffness 200, damping 18
- Stagger: 50ms for prompt suggestions
- CSS interaction: 150ms transform/color transitions
- Only animate transform and opacity; honor reduced motion

## Layout

- Chat reading column: `max-w-[860px]`
- Empty state: left-aligned asymmetric editorial headline, then 2-column dense prompt grid
- Sidebar: yellow chrome, explicit new-chat action, ink-bordered active conversation
- Mobile: single prompt column below `sm`, no horizontal overflow

## Project-specific bans

- No centered marketing hero, generic three-card feature row, or gradient headline
- No h-screen; use `100dvh`
- No emoji icons; use Lucide icons consistently
- No filler copy such as "Elevate", "Seamless", or "Unleash"

## Accessibility floor

- WCAG AA body-text contrast
- Visible focus rings
- 44px interactive targets on mobile
- Reduced-motion support retained

## Last updated

2026-07-11 — rebuilt chat frontend visual language as bright, expressive neo-brutalism.
