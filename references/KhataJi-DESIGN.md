# KhataJi Design System

## Overview

This design system draft was generated from Figma and suggests a clear accent color for emphasis, a light and spacious background foundation, defined typography styles, named visual styles, structured layout patterns. It is intended as a working specification for UI generation, design system documentation, and AI-assisted layout exploration. Review semantic tokens and component rules before using it as a final source of truth.

---

## Colors

- Primary (#17BFA9): Main call-to-action buttons, active highlights, and strong emphasis.
- Background (#F6FAF9): Page background and large canvas areas.
- Surface (#FFF2EE): Cards, panels, modals, and elevated containers.
- Text (#464646): Headings, body copy, and primary reading content.
- Border (#C6D6D8): Subtle dividers, input borders, and low-emphasis outlines.
- Muted Text (#EAFDF7): Secondary copy, helper text, and low-emphasis metadata.
- Supporting Color (#000000): Secondary or contextual color requiring manual semantic review before reuse as a primary accent.
- Supporting Color (#FF7855): Secondary or contextual color requiring manual semantic review before reuse as a primary accent.
- Supporting Color (#FFFFFF): Secondary or contextual color requiring manual semantic review before reuse as a primary accent.

## Typography

- Headline Font: General Sans
- Body Font: Inter

- H1 / Heading: General Sans / Bold / 40px
- Body: Inter / Regular / 15px
- Button: General Sans / Medium / 16px
- Caption / Small Text: Inter / Regular / 12px

---

## Spacing

Base unit: **8px**
- xs: 4px — Tight inline gaps
- sm: 8px — Compact component spacing
- md: 16px — Default padding
- lg: 24px — Card padding and section gutters
- xl: 32px — Larger section spacing

## Border Radius

- sm: 4px — Small tags, chips, compact corners
- md: 8px — Buttons, inputs, cards
- lg: 16px — Panels, larger containers

## Elevation

- Gentle, diffused shadows are recommended unless stronger hierarchy is clearly required.
- sm: Buttons, chips, small overlays.
- DEFAULT: Cards, dropdowns, standard floating surfaces.
- md: Elevated cards, side panels, larger floating regions.
- lg: Modals and high-priority overlay containers.

## Components

### Buttons
- **Primary**: #17BFA9 fill, #FFFFFF text, no border, radius 8px.
- **Primary Hover**: #15AC98 fill, #FFFFFF text, no border.
- **Primary Focus**: #17BFA9 fill, #FFFFFF text, 3px ring #17BFA91F.
- **Primary Disabled**: #17BFA9 fill, #FFFFFF text, 40% opacity.

- **Secondary**: transparent fill, #464646 text, 1px #C6D6D8 border, radius 8px.
- **Secondary Hover**: #4646460A fill, #464646 text, 1px #C6D6D8 border.
- **Secondary Focus**: transparent fill, #464646 text, 1px #17BFA9 border, 3px ring #17BFA91F.
- **Secondary Disabled**: transparent fill, #EAFDF7 text, 1px #C6D6D8 border, 40% opacity.

- **Ghost**: transparent fill, #EAFDF7 text, no border, radius 8px.
- **Ghost Hover**: #46464606 fill, #464646 text, no border.
- **Ghost Focus**: transparent fill, #464646 text, 3px ring #17BFA91F.
- **Ghost Disabled**: transparent fill, #EAFDF7 text, no border, 40% opacity.

### Cards
- **Default**: #FFF2EE fill, 1px #C6D6D8 border, radius 8px.
- **Elevated**: #FFF2EE fill, soft elevation, radius 8px.
- **Large Panel**: #FFF2EE fill, subtle border or elevation, radius 16px.

### Inputs
- **Default**: #FFF2EE fill, 1px #C6D6D8 border, text color #464646, radius 8px.
- **Hover**: #FFF2EE fill, 1px #A2AFB1 border, text color #464646.
- **Focus**: #FFF2EE fill, 1px #17BFA9 border, 3px ring #17BFA91F.
- **Error**: #FFF2EE fill, 1px #EF4444 border, 3px ring #EF44441F.
- **Disabled**: #FFF3EF fill, 1px #C6D6D8 border, text color #EAFDF7, 40% opacity.

### Layout Containers
- Use #FFF2EE for contained regions.
- Use #F6FAF9 for page-level background areas.
- Use 16px only for larger panels or special containers.
- Keep radii and spacing consistent across repeated containers.

---

## Layout Principles

- Use generous whitespace between sections and repeated content groups.
- Prefer card-based grouping for related content and modular page regions.
- Maintain spacing rhythm based on the 8px system.
- Keep page background and surface colors visually distinct when depth or grouping is needed.
- Reuse existing auto layout patterns instead of inventing one-off container structures.

## Do's and Don'ts

1. **Do** use #17BFA9 for key interactive emphasis only.
2. **Do** keep page backgrounds consistent with #F6FAF9.
3. **Do** preserve strong readability with #464646 for core reading content.
4. **Do** maintain a compact, repeatable radius and spacing rhythm across repeated UI.
5. **Don't** introduce additional accent colors unless intentionally extending the system.
6. **Don't** use supporting colors as new CTA colors without explicitly defining their role.
7. **Don't** replace Primary with other extracted blues unless explicitly promoted to a semantic token.
8. **Don't** mix unrelated shadow styles or multiple border treatments without purpose.

## Extracted Source Notes

- Auto-generated from Figma on 2026-11-27.
- Source of truth: Figma file.
- File: KhataJi
- Scope: Selection
- Root nodes scanned: 8
- Auto layout containers found: 7
- This draft combines extracted signals with inferred semantic rules.
- Manual input required: Responsive
