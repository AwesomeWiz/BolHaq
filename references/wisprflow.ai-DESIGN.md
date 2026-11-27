---
version: alpha
name: Wisprflow
description: |
  Wispr Flow's design system embraces a refined, modern aesthetic rooted in
  clarity and precision. The visual identity balances high-contrast typography
  with generous whitespace, using a soft cream canvas punctuated by deep
  charcoal accents and a distinctive lavender primary brand color. The system
  feels simultaneously playful and professional, with serif display typography
  (Eb Garamond) conveying sophistication, while humanist sans-serif body copy
  (Figtree) ensures legibility and approachability. Decorative accent
  colors—deep teal, coral, citrine, and salmon—appear as focal points in
  isolated moments, never overwhelming the composition. The elevation strategy
  relies entirely on color blocking rather than shadows, creating a flat,
  intentional materiality that prioritizes content hierarchy through hue and
  typography scale alone.
source:
  url: "https://wisprflow.ai/"
  pagesAnalyzed: 1
  extractedAt: 2026-11-27
  tokensMeasured: true
colors:
  primary: "#F0D7FF"
  canvas: "#FFFFEB"
  surface: "#E4E4D0"
  surface-alt: "#1A1A1A"
  on-primary: "#1A1A1A"
  ink: "#1A1A1A"
  accent-1: "#034F46"
  accent-2: "#FFA946"
  accent-3: "#34D399"
  accent-4: "#FF6C4C"
  neutral-1: "#333333"
  neutral-2: "#000000"
typography:
  display-xxl:
    fontFamily: "Eb garamond"
    fontSize: 120px
    fontWeight: 400
    lineHeight: 0.85
    letterSpacing: -3.6px
  display-xl:
    fontFamily: "Eb garamond"
    fontSize: 96px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: -2.88px
  display-lg:
    fontFamily: "Eb garamond"
    fontSize: 75px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -2.25px
  display-lg-tight:
    fontFamily: "Eb garamond"
    fontSize: 75px
    fontWeight: 400
    lineHeight: 0.5
    letterSpacing: -2.25px
  display-md:
    fontFamily: "Eb garamond"
    fontSize: 64px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: -1.92px
  display-sm:
    fontFamily: "Eb garamond"
    fontSize: 48px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: -1.44px
  heading-md:
    fontFamily: Figtree
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0px
  heading-sm:
    fontFamily: "Eb garamond"
    fontSize: 32px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: -0.96px
  heading-xs:
    fontFamily: "Eb garamond"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: 0px
  body-xl:
    fontFamily: "Eb garamond"
    fontSize: 26.08px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: 0px
  body-lg:
    fontFamily: Figtree
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0px
  body-md:
    fontFamily: Figtree
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0px
  body-sm:
    fontFamily: Figtree
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0px
  body-xs:
    fontFamily: Figtree
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0px
  body-xs-uppercase:
    fontFamily: Figtree
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 1.12px
    textTransform: uppercase
  nav:
    fontFamily: Figtree
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0px
  caption:
    fontFamily: Figtree
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.54
    letterSpacing: -0.24px
  code:
    fontFamily: Jetbrainsmono
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0px
    textTransform: uppercase
rounded:
  none: 0px
  xs: 8px
  sm: 16px
  md: 32px
  lg: 48px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 28px
  xxxl: 32px
  section: 40px
  band: 44px
borderWidths:
  thin: 1px
  medium: 2px
elevationStrategy: color-blocking
themes:
  derived: dark   # the other theme is the site's measured palette
  light:
    bg: "#FFFFEB"
    surface: "#E4E4D0"
    surfaceRaised: "#DCDCC9"
    text: "#1A1A1A"
    textMuted: "#6A6A63"
    border: "#E4E4D2"
    accent: "#C25DFF"
    accentFg: "#000000"
    focusRing: "#F0D7FF"
    elevation: shadow
  dark:
    bg: "#0F0E11"
    surface: "#1D1C1F"
    surfaceRaised: "#29292B"
    text: "#FEFDFF"
    textMuted: "#A3A2A5"
    border: "#353537"
    accent: "#F0D7FF"
    accentFg: "#0B0B0C"
    focusRing: "#F0D7FF"
    elevation: "border+surface"
components:
  button-primary:
    typography: "{typography.nav}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.surface-alt}"
    height: 52px
    padding: "16px 24px 16px 24px"
    rounded: "{rounded.xs}"
    backgroundColor: "{colors.primary}"
  button-filled:
    typography: "{typography.nav}"
    textColor: "{colors.ink}"
    height: 32px
    padding: "8px 16px 8px 16px"
    rounded: 1600px
    backgroundColor: "rgb(255, 253, 249)"
  button-secondary:
    textColor: "{colors.canvas}"
    height: 36px
    padding: "8px 16px 8px 16px"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
    rounded: "{rounded.xs}"
    backgroundColor: "{colors.surface-alt}"
  button-filled-lg:
    textColor: "{colors.ink}"
    height: 36px
    padding: "8px 16px 8px 16px"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
    rounded: "{rounded.xs}"
    backgroundColor: "{colors.surface}"
  card:
    textColor: "{colors.ink}"
    padding: "55px 0px 0px 0px"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
    rounded: "{rounded.sm}"
    backgroundColor: "{colors.surface}"
  card-sm:
    textColor: "{colors.ink}"
    padding: "8px 32px 8px 8px"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
    rounded: 12px
    backgroundColor: "{colors.surface}"
  badge-filled:
    textColor: "rgb(55, 55, 52)"
    border: "1px solid {colors.canvas}"
    height: 24px
    padding: "0px 7.8px 0px 7.8px"
    fontSize: 16px
    boxShadow: "rgba(0, 0, 0, 0.1) 1px 1px 3px 0px"
    fontFamily: Figtree
    fontWeight: 700
    lineHeight: 1.3
    rounded: 1600px
    backgroundColor: "{colors.accent-2}"
  badge-text:
    textColor: "{colors.ink}"
    height: 71.0312px
    padding: "16px 16px 16px 16px"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
    rounded: 76px
    backgroundColor: "{colors.canvas}"
  navigation:
    textColor: "{colors.ink}"
    height: 52px
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
  footer:
    textColor: "{colors.ink}"
    padding: "0px 0px 50px 0px"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
  link:
    textColor: "{colors.ink}"
    padding: "16px 16px 16px 16px"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
    rounded: "{rounded.lg}"
  link-sm:
    textColor: "{colors.ink}"
    fontSize: 16px
    fontFamily: Figtree
    fontWeight: 400
    lineHeight: 1.3
states:
  other-focus:
    target: other
    state: focus
    outline: none
  input-focus:
    target: input
    state: focus
    borderColor: "rgb(56, 152, 236)"
  other-hover:
    target: other
    state: hover
    opacity: 1
  button-hover:
    target: button
    state: hover
    transform: "scale(0.98)"
  other-active:
    target: other
    state: active
    outline: "rgb(255, 255, 255) 0px"
    borderColor: "{colors.neutral-2}"
    borderWidth: 1px
    outlineColor: "rgb(255, 255, 255)"
  link-hover:
    target: link
    state: hover
    transform: "translate(0px)"
    backgroundColor: "rgb(255, 253, 249)"
  input-active:
    target: input
    state: active
    outline: "rgb(136, 109, 194) 3px"
    outlineColor: "rgb(136, 109, 194)"
    outlineWidth: 3px
  input-focus-visible:
    target: input
    state: focus-visible
    outline: "rgb(136, 109, 194) 3px"
    outlineColor: "rgb(136, 109, 194)"
    outlineWidth: 3px
  card-hover:
    target: card
    state: hover
    backgroundColor: "{colors.surface}"
  other-focus-visible:
    target: other
    state: focus-visible
    outline: "rgb(255, 255, 255) 3px"
    outlineColor: "rgb(255, 255, 255)"
    outlineWidth: 3px
breakpoints:
  - width: 375
    containerWidth: 335
    gridColumns: 6
    navLinksVisible: 0
    menuToggleVisible: true
    headingPx: 56
    bodyPx: 16
    sectionPaddingX: 0
  - width: 768
    containerWidth: 688
    gridColumns: 8
    navLinksVisible: 0
    menuToggleVisible: true
    headingPx: 96
    bodyPx: 16
    sectionPaddingX: 0
  - width: 1024
    containerWidth: 944
    gridColumns: 8
    navLinksVisible: 4
    menuToggleVisible: false
    headingPx: 120
    bodyPx: 16
    sectionPaddingX: 0
  - width: 1280
    containerWidth: 1240
    gridColumns: 8
    navLinksVisible: 4
    menuToggleVisible: false
    headingPx: 120
    bodyPx: 16
    sectionPaddingX: 0
  - width: 1440
    containerWidth: 1240
    gridColumns: 8
    navLinksVisible: 4
    menuToggleVisible: false
    headingPx: 120
    bodyPx: 16
    sectionPaddingX: 0
coverage:
  statesFound: 62
  gradientsFound: 0
  rolesUnassigned: 6
  archetypesUnnamed: 0
  archetypesDetected: 0
  responsiveMeasured: true
  stylesheetsBlocked: false
  semanticRampDeclared: false
---

# Design System Inspired by Wispr Flow

## 1. Visual Theme & Atmosphere

Wispr Flow's design system embraces a refined, modern aesthetic rooted in clarity and precision. The visual identity balances high-contrast typography with generous whitespace, using a soft cream canvas punctuated by deep charcoal accents and a distinctive lavender primary brand color. The system feels simultaneously playful and professional, with serif display typography (Eb Garamond) conveying sophistication, while humanist sans-serif body copy (Figtree) ensures legibility and approachability. Decorative accent colors—deep teal, coral, citrine, and salmon—appear as focal points in isolated moments, never overwhelming the composition. The elevation strategy relies entirely on color blocking rather than shadows, creating a flat, intentional materiality that prioritizes content hierarchy through hue and typography scale alone.

**Key Characteristics**

- **Serif-driven display hierarchy**: Eb Garamond at extreme scales (up to 120px) with tight letter-spacing creates dramatic impact for headings and hero copy
- **Lavender brand accent**: Primary call-to-action surfaces use `{colors.primary}` (`#F0D7FF`), creating a confident, inviting visual signal
- **Generous typographic scale**: Nine distinct display and body sizes accommodate everything from 12px captions to 120px hero headlines
- **High-contrast simplicity**: Cream canvas against deep charcoal text, with minimal shadow usage; depth through surface-color transitions only
- **Geometric button language**: Pill-shaped "filled" variants (`{rounded.full}`) contrast with square-cornered primary actions (`{rounded.xs}`), signaling affordance through form
- **Responsive typography**: Display sizes collapse predictably across breakpoints (120px → 96px → 56px), maintaining legibility without scale distortion
- **Multi-weight sans-serif**: Figtree ranges from 400 to 600 weight, allowing subtle typographic texture within a cohesive family

## 2. Color Palette & Roles

### Primary
- **Brand Accent** (`{colors.primary}` — `#F0D7FF`): Lavender; used for primary CTA buttons, active states, and strategic visual focus points on the cream canvas

### Accent Colors (Decorative)
- **Deep Teal** (`{colors.accent-1}` — `#034F46`): Decorative; used in isolated moments, hero band backgrounds, and secondary compositional emphasis
- **Coral** (`{colors.accent-2}` — `#FFA946`): Decorative; appears in badge fills and accent elements
- **Citrine** (`{colors.accent-3}` — `#34D399`): Decorative; supplementary accent for highlights and status badges
- **Salmon** (`{colors.accent-4}` — `#FF6C4C`): Decorative; additional accent palette for dynamic moments

### Neutral Scale
- **Canvas** (`{colors.canvas}` — `#FFFFEB`): Default page background; warm cream providing the foundational reading surface
- **Surface** (`{colors.surface}` — `#E4E4D0`): Card and panel backgrounds; slightly warmer than canvas, used for contained content areas and hover states
- **Ink / Dark** (`{colors.surface-alt}` — `#1A1A1A`): Primary text color on light surfaces; also used as label text on brand surfaces and hero band text
- **Neutral Dark** (`{colors.neutral-1}` — `#333333`): Secondary dark tone; used in secondary text and subtle UI elements
- **Black** (`{colors.neutral-2}` — `#000000`): Extreme dark for borders, outlines, and high-contrast moments

### Surface & Borders
- **Secondary Surface** (`{colors.surface}` — `#E4E4D0`): Differentiates cards, sections, and hover states from the primary canvas
- **Border Secondary** (`{colors.surface}` — `#E4E4D0`): Soft border color used in input focus states and subtle dividers

## 3. Typography Rules

### Font Family

**Primary Display Font**: Eb Garamond (serif)
- Fallback stack: `Eb Garamond, Georgia, serif`
- Used for all headlines, display copy, and hero messaging

**Secondary Body Font**: Figtree (humanist sans-serif)
- Fallback stack: `Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Used for all body, button, link, and UI text

**Monospace Font**: JetBrains Mono (code)
- Fallback stack: `JetBrains Mono, "Courier New", monospace`
- Used for code, technical references, and uppercase transposed text

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display XL | Eb Garamond | 96px | 400 | 0.95 (91px) | -2.88px | Hero headlines, extreme scale |
| Display XXL | Eb Garamond | 120px | 400 | 0.85 (102px) | -3.6px | Largest display role; maximum drama |
| Display LG | Eb Garamond | 75px | 400 | 1 (75px) | -2.25px | Large section heads |
| Display LG Tight | Eb Garamond | 75px | 400 | 0.5 (37px) | -2.25px | Display variant with condensed line height |
| Display MD | Eb Garamond | 64px | 400 | 0.95 (60.8px) | -1.92px | Medium display scale |
| Display SM | Eb Garamond | 48px | 400 | 0.95 (45.6px) | -1.44px | Smaller display, subsections |
| Heading MD | Figtree | 36px | 600 | 1.3 (46.8px) | 0px | Major section headers, strong hierarchy |
| Heading SM | Figtree | 32px | 400 | 0.95 (30.4px) | -0.96px | Secondary headings |
| Heading XS | Figtree | 20px | 400 | 0.95 (19px) | 0px | Tertiary headings, card titles |
| Body XL | Figtree | 26.08px | 400 | 0.95 (24.776px) | 0px | Large body, prominent copy |
| Body LG | Figtree | 20px | 500 | 1.3 (26px) | 0px | Medium body, slightly boosted |
| Body MD | Figtree | 18px | 600 | 1.3 (23.4px) | 0px | Standard body, descriptions |
| Body SM | Figtree | 16px | 600 | 1.3 (20.8px) | 0px | Compact body, button text |
| Body XS | Figtree | 14px | 500 | 1.3 (18.2px) | 0px | Small body, links, metadata |
| Body XS Uppercase | Figtree | 14px | 500 | 1.3 (18.2px) | 1.12px | Small uppercase, section labels |
| Navigation | Figtree | 16px | 600 | 1 (16px) | 0px | Nav links, tight leading |
| Caption | Figtree | 12px | 600 | 1.54 (18.48px) | -0.24px | Fine print, annotations |
| Code | JetBrains Mono | 18px | 500 | 1.3 (23.4px) | 0px | Code block, transposed uppercase |

### Principles

- **Extreme display scale**: Eb Garamond runs from 48px to 120px, with consistent tight tracking (`-1.44px` to `-3.6px`) that reinforces elegance and reads as intentional rather than broken
- **Negative letter-spacing on serifs**: All display sizes employ negative tracking; this is a defining trait and must not be rounded to zero
- **Sans-serif for utility**: Figtree body ranges 12px–36px with no negative tracking, providing clarity and neutrality in service of content
- **Generous line-height on body**: Body text uses 1.3 line height; display copy uses tighter ratios (0.5–1) to control visual density
- **Monospace and all-caps**: Code role combines JetBrains Mono with uppercase transformation, signaling technical content
- **Semantic weight shifts**: Buttons and nav use 600 weight for emphasis; body prose uses 400–500 for readability

## 4. Component Stylings

### Buttons

**Primary Button**
- Font: `{typography.body-sm}` (Figtree, 16px, 600, 1.3)
- Background: `{colors.primary}` (`#F0D7FF`)
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Padding: `16px 24px`
- Border Radius: `{rounded.xs}` (8px)
- Border: `2px solid {colors.surface-alt}` (`#1A1A1A`)
- Height: 52px
- Width: 183px
- Box Shadow: none
- Hover State: `transform: scale(0.98)`, color shifts to `{colors.surface-alt}`

**Secondary Button (Filled Dark)**
- Font: `{typography.body-sm}` (Figtree, 16px, 400, 1.3)
- Background: `{colors.surface-alt}` (`#1A1A1A`)
- Text Color: `{colors.canvas}` (`#FFFFEB`)
- Padding: `8px 16px`
- Border Radius: `{rounded.xs}` (8px)
- Border: none
- Height: 36px
- Width: 102px
- Box Shadow: none
- Hover State: `transform: scale(0.98)`, color property updates

**Filled Button (Pill)**
- Font: `{typography.body-sm}` (Figtree, 16px, 600, 1.3)
- Background: `#FFFDF9`
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Padding: `8px 16px`
- Border Radius: `{rounded.full}` (9999px)
- Border: none
- Height: 32px
- Width: 98px
- Box Shadow: none
- Hover State: background shifts on interaction

**Filled Button Large (Alternative)**
- Font: `{typography.body-sm}` (Figtree, 16px, 400, 1.3)
- Background: `{colors.surface}` (`#E4E4D0`)
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Padding: `8px 16px`
- Border Radius: `{rounded.xs}` (8px)
- Border: none
- Height: 36px
- Width: 80px
- Box Shadow: none

### Cards & Containers

**Card Default**
- Background: `{colors.surface}` (`#E4E4D0`)
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Padding: `55px 0px 0px 0px` (top-heavy)
- Border Radius: `{rounded.sm}` (16px)
- Border: none
- Height: 233px
- Width: 400px
- Box Shadow: none
- Hover State: `backgroundColor: {colors.surface}`

**Card Small**
- Background: `{colors.surface}` (`#E4E4D0`)
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Padding: `8px 32px 8px 8px`
- Border Radius: 12px
- Border: `2px solid rgba(26, 26, 26, 0)`
- Height: 170px
- Width: 612px
- Box Shadow: none
- Font: `{typography.body-sm}` (Figtree, 16px, 400, 1.3)

### Inputs & Forms

**Text Input (Base)**
- Border: `1px solid` (thin border)
- Border Radius: varies by context
- Font: `{typography.body-sm}` (Figtree, 16px, 600, 1.3)
- Background: typically canvas or surface
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Focus State: `outline: 3px solid rgb(136, 109, 194)`, `borderColor: rgb(0, 0, 0)`, `borderWidth: 0px`
- Focus-Visible State: `outline: 3px solid rgb(136, 109, 194)`

**Input Focus Behavior**
- Outline color shifts to purple (`rgb(136, 109, 194)`) with `3px` width
- Border is hidden during focus (borderWidth 0)
- Outline provides the visual feedback ring

### Navigation

**Nav Default**
- Font: `{typography.nav}` (Figtree, 16px, 600, 1)
- Background: transparent
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Padding: `0px`
- Border Radius: none
- Height: 52px
- Width: 370px
- Box Shadow: none
- Hover State: color shifts, background may update to `{colors.surface}`

### Badge

**Badge Filled**
- Font: Figtree, 16px, 700, 1.3
- Background: `{colors.accent-2}` (`#FFA946`)
- Text Color: `#373734`
- Padding: `0px 7.8px`
- Border Radius: `{rounded.full}` (9999px)
- Border: `1px solid {colors.canvas}` (`#FFFFEB`)
- Height: 24px
- Width: 50px
- Box Shadow: `rgba(0, 0, 0, 0.1) 1px 1px 3px 0px`

**Badge Text**
- Font: Figtree, 16px, 400, 1.3
- Background: `{colors.canvas}` (`#FFFFEB`)
- Text Color: `{colors.surface-alt}` (`#1A1A1A`)
- Padding: `16px 16px`
- Border Radius: 76px
- Border: none
- Height: 71px
- Width: 244px
- Box Shadow: none

## 5. Layout Principles

### Spacing System

Base unit: `{spacing.xs}` (8px). The system scales in graduated steps, from `{spacing.xxs}` (4px) for micro-adjustments through `{spacing.band}` (44px) for major section separation.

**Complete Scale:**
- `{spacing.xxs}`: 4px — micro spacing, tight kerning adjustments
- `{spacing.xs}`: 8px — compact spacing, inline padding
- `{spacing.sm}`: 12px — small padding, component internal spacing
- `{spacing.md}`: 16px — standard padding, most component internal spacing
- `{spacing.lg}`: 20px — moderate spacing, component gaps
- `{spacing.xl}`: 24px — breathing room between elements
- `{spacing.xxl}`: 28px — generous spacing, section edges
- `{spacing.xxxl}`: 32px — large section padding
- `{spacing.section}`: 40px — major section separation
- `{spacing.band}`: 44px — full-width section padding and hero bands

### Grid & Container

- **Desktop (1440px+)**: Max content width 1240px, centered with equal side gutters
- **Tablet (768px–1024px)**: Content column 688–944px, responsive scaling
- **Mobile (375px)**: Content column 335px; padding removed (0px section padding-x), full-width sections
- **Column Strategy**: 8-column grid at tablet and desktop; content scales proportionally
- **Section Padding**: Horizontal padding remains consistent at 0px across all measured breakpoints; padding-y uses `{spacing.band}` and `{spacing.xxxl}` for major vertical rhythm

### Whitespace Philosophy

Whitespace is generous and purposeful, using the full `{spacing.band}` (44px) between major sections to create visual rest. Internally, components use `{spacing.md}` to `{spacing.lg}` for breathing room, while tighter `{spacing.sm}` and `{spacing.xs}` serve micro-adjustments. Hero sections and display typography benefit from extreme negative space above/below to amplify their impact. The cream canvas (`{colors.canvas}`) itself acts as whitespace, with colored surfaces (cards, bands) interrupting it strategically.

### Border Radius Scale

- `{rounded.none}`: 0px — sharp corners; images, full-bleed overlays
- `{rounded.xs}`: 8px — primary buttons, slight softness
- `{rounded.sm}`: 16px — cards, moderate corner treatment
- `{rounded.md}`: 32px — large containers, hero rounded regions
- `{rounded.lg}`: 48px — extra-large elements, expansive links
- `{rounded.full}`: 9999px — pills and badges; "filled" button variant

### Border Widths

- **Thin**: `1px` — input borders, badge borders, subtle dividers
- **Medium**: `2px` — primary button borders, strong emphasis

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat (Base) | No shadow; solid background color only | Canvas, text, inline content |
| Surface | `{colors.surface}` (`#E4E4D0`) background; no shadow | Cards, panels, containers; color-blocking depth |
| Raised Section | `{colors.accent-1}` (`#034F46`) or hero band color; no shadow | Full-width sections, visual breaks |

**Elevation Philosophy:**
Wispr Flow employs a purely color-blocking depth strategy. No CSS box-shadows are used; instead, visual hierarchy emerges through surface color transitions. The warm cream canvas (`#FFFFEB`) contrasts against slightly warmer `{colors.surface}` (`#E4E4D0`), and bold hero bands use `{colors.accent-1}` (`#034F46`) or brand accent to command attention. This flat aesthetic prioritizes content and type over material depth, lending the design a modern, deliberate character.

### Opacity Levels

- **100%** (1.0): Full opacity; primary content, default state
- **80%** (0.8): Slight transparency; hover states on decorative elements
- **74%** (0.74): Medium opacity; overlay or secondary emphasis
- **60%** (0.60): Moderate fade; disabled or recessive elements
- **50%** (0.5): Half opacity; hover states on badges or containers
- **35%** (0.35): Low opacity; very subtle overlays or borders
- **30%** (0.3): Faint opacity; minimal visual presence
- **25%** (0.25): Near-invisible; fine separator lines or borders

### Z-index / Layering

- **1–7**: Base layering for standard page elements (cards, text, sections)
- **10**: Dropdown menus, overlays above main content

## 7. Do's and Don'ts

### Do

- **Lead with display typography**: Use `{typography.display-xl}` and above for hero messaging; the negative letter-spacing will read as confident and intentional
- **Respect the spacing scale**: Use only values from the nine-step system (`{spacing.xxs}` through `{spacing.band}`); never invent intermediate spacing
- **Leverage color blocking**: Create depth and hierarchy through surface color changes (canvas → surface → accent) rather than shadows
- **Maintain high contrast on small text**: Pair `{colors.surface-alt}` (`#1A1A1A`) text against `{colors.canvas}` or lighter backgrounds; never use accent colors for body copy
- **Apply border-radius predictably**: Primary buttons use `{rounded.xs}`, pills use `{rounded.full}`, cards use `{rounded.sm}`; don't mix radius scales within a component role
- **Use Figtree for utility UI**: Navigation, buttons, forms, captions—all rely on the sans-serif for clarity; reserve Eb Garamond for display and hero moments only
- **Optimize for mobile-first**: At 375px, section padding-x is 0px and display sizes collapse to 56px; design compact first, expand upward
- **Employ opacity for state feedback**: Use the opacity scale (0.5–0.8) for hover and disabled states rather than adding shadows or new colors

### Don't

- **Don't layer shadows**: The system has no box-shadow values; depth comes only from color and opacity
- **Don't use serif fonts in UI**: Figtree or similar humanist sans-serif handles buttons, navigation, and form labels; Eb Garamond is display-only
- **Don't apply negative letter-spacing to body copy**: Tight tracking (`-2.88px` to `-3.6px`) is exclusive to display sizes (48px and above)
- **Don't mix border-radius styles within one component role**: If buttons use `{rounded.xs}`, all primary buttons must use 8px; pill variants are exceptions with their own explicit rule
- **Don't invent spacing values**: Every gap, padding, and margin must pull from the ten-step scale; adhoc pixel adjustments break visual rhythm
- **Don't set links or small UI text in accent colors**: Primary text is always `{colors.surface-alt}` on light surfaces; accent colors are for badges, highlights, and decorative moments
- **Don't apply opacity to text**: Opacity rules apply to backgrounds, borders, and containers; text opacity should shift through the color palette instead (using `{colors.neutral-1}` or `{colors.neutral-2}` for diminished text)
- **Don't use more than one display font**: Eb Garamond is the sole serif; never mix it with alternate serif families

## 8. Responsive Behavior

### Breakpoints

| Breakpoint | Viewport Width | Content Width | Grid Columns | Nav Links Visible | Largest Display | Body Text | Section Padding-X |
|---|---|---|---|---|---|---|---|
| Mobile | 375px | 335px | 6 | 0 | 56px | 16px | 0px |
| Tablet | 768px | 688px | 8 | 0 | 96px | 16px | 0px |
| Desktop | 1024px | 944px | 8 | 4 | 120px | 16px | 0px |
| Desktop LG | 1280px | 1240px | 8 | 4 | 120px | 16px | 0px |
| Desktop XL | 1440px | 1240px | 8 | 4 | 120px | 16px | 0px |

**Collapse Points:**
- Navigation menu collapse occurs between mobile and tablet; a menu toggle appears at 375px, and 4 nav links are visible at 1024px and above
- Display typography scales aggressively on mobile: `{typography.display-xxl}` (120px) → `{typography.display-xl}` (96px) → `{typography.display-sm}` (56px) as viewport shrinks
- Content padding remains 0px across all measured breakpoints; vertical rhythm scales via section padding (y-axis)
- Grid column count stays at 8 for tablet, desktop, and beyond; mobile uses 6 columns

### Touch Targets

Minimum interactive element sizes (buttons, links, form controls):
- **Height**: 32px minimum (pill buttons, small inputs)
- **Width**: 50px minimum (badge, icon button)
- **Preferred**: 44–52px for primary actions (primary button: 52px height)
- **Padding**: 8px–16px internal padding ensures comfortable tap zones; external margin may be reduced on mobile but internal padding must not drop below 8px

### Collapsing Strategy

- **Mobile (375px)**: Full-width sections with 0px side padding; display text scales down (56px maximum), body remains 16px; hamburger menu replaces nav links; cards stack vertically, single column
- **Tablet (768px)**: Content expands to 688px with centered margins; display sizes grow to 96px; nav links remain hidden (menu toggle still visible); cards begin to flex horizontally with 2–3 column layouts
- **Desktop (1024px+)**: Content width caps at 1240px; display scales to full 120px; nav links become visible (4 links at top); cards flex to full grid width; horizontal rhythm stabilizes

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA**: Brand Accent (`{colors.primary}` — `#F0D7FF`) — lavender, used for primary buttons and focal points
- **Background**: Canvas (`{colors.canvas}` — `#FFFFEB`) — warm cream default
- **Surfaces**: Surface (`{colors.surface}` — `#E4E4D0`) — slightly warmer than canvas for cards and panels
- **Primary Text**: Ink (`{colors.surface-alt}` — `#1A1A1A`) — deep charcoal on light backgrounds
- **Accents**: Coral (`#FFA946`) for badges, Deep Teal (`#034F46`) for hero bands, Citrine (`#34D399`) and Salmon (`#FF6C4C`) for supplementary moments
- **Borders**: Thin (`1px`) used on inputs; Medium (`2px`) on primary buttons; color typically `{colors.surface-alt}`

### Iteration Guide

1. **Display hierarchy before decoration**: Eb Garamond display copy (48px–120px) with tight negative tracking (`-1.44px` to `-3.6px`) establishes visual dominance; never reduce letter-spacing or it will read broken
2. **Depth through color, not shadow**: All sections transition via background color (`canvas` → `surface` → accent bands); no box-shadows exist in the system
3. **Spacing is a grid of ten**: Every margin, padding, and gap must be a value from `{spacing.xxs}` (4px) through `{spacing.band}` (44px); ad-hoc adjustments break the system
4. **Buttons have three main forms**: Primary (outline, 2px border, lavender fill), Secondary (solid dark fill), and Filled Pill (rounded, 9999px border-radius); each has distinct padding and radius
5. **Figtree is the workhorse**: All body text, buttons, navigation, captions, and forms use Figtree at weights 400–600; Eb Garamond is display-only
6. **Mobile padding is zero**: Horizontal section padding is 0px on mobile, so full-width colored sections extend edge-to-edge; vertical rhythm uses `{spacing.band}` and `{spacing.xxxl}` between sections
7. **Responsive display scales aggressively**: Display typography drops from 120px (desktop) to 96px (tablet) to 56px (mobile); never make display text fixed
8. **Opacity for state, not new colors**: Hover states use opacity shifts (0.5–0.8) or color transforms, not entirely new palette entries; disabled states use 0.5 opacity
9. **Focus outlines are purple**: Input focus uses `3px solid rgb(136, 109, 194)` outline with hidden border; this is the only custom focus color
10. **Radius is role-specific**: Primary buttons are `{rounded.xs}` (8px), cards are `{rounded.sm}` (16px), pills are `{rounded.full}` (9999px); each role has one fixed radius

## 10. Known Gaps

- **No semantic color ramp**: The site does not expose error, success, warning, or info states in its markup or CSS; a semantic status palette was not extracted and should not be invented
- **No gradients or decorative meshes**: The design system uses flat colors only; no gradient overlays, mesh backgrounds, or complex decorative color blends were detected
- **No explicit dark mode**: One theme was measured; no alternate dark or high-contrast variant was observed
- **Six decorative accent colors without assigned roles**: `{colors.accent-1}`, `{colors.accent-2}`, `{colors.accent-3}`, and `{colors.accent-4}` appear in limited isolated contexts (badge fills, hero bands, supplementary graphics) but have no formally declared UI role; they are described as decorative only
- **Limited interaction state visibility**: Only focus, hover, and active states for buttons, inputs, and links were extracted; states for disabled form fields, loading spinners, or error messages were not measured (page analyzed was public, not behind authentication)
- **Single-page sample**: Only the public homepage was analyzed; surfaces behind authentication, dashboard views, and app-specific UI were not visited
- **No animation or transition timings**: CSS animations, transform durations, or easing curves were not extracted from the site's stylesheets; this document covers static appearance only
- **Shadow and elevation partial**: No box-shadow values are used in the system; the elevation section relies entirely on color blocking, confirming a flat design approach
- **Badge variant behavior unclear**: Badge text variant and filled variant appear to have different sizes and purposes; exact use context (count badges vs. status tags) was not fully determined from extraction alone