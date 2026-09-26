# CozyCraft design system

This document records the visual and interaction rules used across the customer
storefront and administration workspace. The source-of-truth design tokens are
defined in `src/styles/theme.css`.

## Design principles

- Calm and editorial: furniture and room photography remain the visual focus.
- Clear before clever: prices, stock, status, totals, and primary actions must be
  immediately understandable.
- Consistent across roles: customer and admin pages use the same spacing,
  feedback, focus, and responsive standards.
- Mobile complete: no workflow is considered finished until it is usable with
  touch, a narrow viewport, and the on-screen keyboard.
- Accessible by default: semantic controls, visible focus, sufficient contrast,
  meaningful labels, and reduced-motion support are required.

## Brand tokens

| Purpose | Token | Value |
| --- | --- | --- |
| Page background | `--background` | `#f4f2ee` |
| Primary text and actions | `--foreground`, `--primary` | `#1c1b19` |
| Surface | `--card`, `--popover` | `#ffffff` |
| Soft surface | `--secondary`, `--muted` | Warm neutral tones |
| Accent | `--accent` | `#b8a58d` |
| Border | `--border` | `#ded9d0` |
| Error or destructive action | `--destructive` | `#a8483f` |
| Focus ring | `--ring` | `#88745d` |
| Admin navigation | `--sidebar` | `#1d1c1a` |

Use the CSS tokens instead of introducing close duplicate colors. Status colors
must always include text or an icon so meaning is not communicated by color
alone.

## Typography

- Customer pages use self-hosted variable fonts from `@fontsource-variable`
  (imported in `src/main.tsx`): **Inter** for body and interface text and
  **Fraunces** (with optical sizing) for editorial headings. Both are scoped to
  the storefront through `:root[data-surface="store"]` in
  `src/styles/storefront.css`; the admin workspace keeps the system stack.
- Use `font-serif` for display headings. Do not reference font families that
  are not loaded (for example `font-[Playfair_Display]`).
- Customer-facing text should not go below 11 px; eyebrow labels use 11 px,
  bold, uppercase, and generous letter-spacing.
- Base browser font size is 16 px; do not reduce form controls below 16 px on
  mobile because it can trigger unwanted browser zoom.
- Eyebrow labels are short, uppercase, and letter-spaced. They introduce a
  section but never replace a meaningful heading.
- Philippine peso values use `₱` with grouped thousands and two decimals when
  centavo precision is relevant.
- Customer-facing date and time values use Asia/Manila unless the interface
  explicitly states another timezone.

## Spacing and layout

- Use normal document flow, Flexbox, and Grid. Absolute positioning is reserved
  for decorative elements, badges, and overlays that cannot affect layout.
- Page content must have a readable maximum width and responsive horizontal
  padding.
- Cards use consistent warm borders and moderate radii based on `--radius`.
- Keep one clear primary action per form or decision area.
- Long admin tables require filtering, pagination, or bounded scrolling rather
  than making the entire page excessively long.

## Motion

Motion lives in `src/styles/storefront.css` and
`src/components/storefront/motion.tsx`. Use the shared tokens instead of
one-off timings:

| Token | Use |
| --- | --- |
| `--ease-out` | Entrances, drawers, reveals |
| `--ease-in-out` | Exits and collapses |
| `--dur-1` … `--dur-4` | 160 ms press feedback to 720 ms page-level reveals |

- Overlays (dialogs, drawers, bottom sheets, popovers) mount through
  `usePresence` and set `data-state` so the `cc-backdrop`, `cc-dialog`,
  `cc-drawer`, `cc-sheet` and `cc-popover` classes can play both enter and exit.
  `cc-sheet` is a bottom sheet on phones and a side drawer from tablet up.
- Sections reveal on scroll with `data-reveal` (optionally `="fade"` or
  `="scale"`); `RevealObserver` in the storefront layout handles observation.
- Images fade in once decoded (`ResilientImage` sets `data-loaded`); wrap image
  frames in `cc-media` for a shimmer while they load, and use `cc-skeleton`
  blocks instead of spinners while content loads.
- Product-card images morph into the product page through React Router view
  transitions (`viewTransition` links and the `cc-product-media` name).
- Everything respects `prefers-reduced-motion`; never animate layout-critical
  properties on elements that contain `position: fixed` children.

## Storefront patterns

- **Product cards** show a wishlist heart on the image, quick view and add to
  bag on hover (a round add button on touch devices), star ratings, and a
  quiet compare checkbox. Stock badges only appear for scarcity
  ("Only 3 left", "Sold out").
- **Adding to the bag** opens the mini-cart drawer; saving to the wishlist flies
  the product photo to the heart and bumps its badge.
- **Collection filters** live in the URL so links, refreshes and Back keep the
  shopper's view.
- **Sticky mobile action bars** (product, bag, checkout) sit above the tab bar
  and only appear once the primary action has scrolled away.
- Customer copy never names infrastructure providers; describe outcomes
  ("saved securely to your account") instead.

## Controls and feedback

- Button labels describe the result: `Create product`, `Save address`, or
  `Approve review` rather than a generic `Submit`.
- Destructive actions require explicit confirmation and identify the affected
  record. Low-risk customer removals (bag rows, wishlist items) may instead be
  reversible immediately through an Undo toast.
- Loading states preserve layout with skeletons or an inline progress message.
- Empty states explain why the area is empty and, when useful, provide the next
  action.
- Success and error notifications use plain language and can be dismissed.
  Storefront toasts show a tone icon, stay five seconds (seven with an action,
  eight for errors); admin notifications keep the eight-second default.
- Disabled controls remain legible and explain unmet requirements when the
  reason is not obvious.

## Responsive behavior

- Supported widths begin at 320 px and scale through tablet and desktop.
- Touch targets should be at least 44 by 44 px.
- Navigation, notifications, dialogs, product galleries, checkout forms, and
  admin tables must remain fully operable without horizontal page scrolling.
- Dialogs use a bounded viewport height and their own scroll area on small
  screens.
- Fixed mobile navigation must not cover page actions or the customer care
  control; pages include the necessary safe-area padding.

## Accessibility checklist

- Every interactive element works with a keyboard.
- Focus uses the shared visible ring and is never removed without replacement.
- Icon-only controls have an accessible name.
- Form errors are connected to their input and not shown by color alone.
- Images include useful alternative text or an empty `alt` value when purely
  decorative.
- Animations respect `prefers-reduced-motion`.
- Heading levels follow the content structure rather than visual size.

## Asset rules

- Brand assets live in `src/assets/branding` or `public` when a direct public URL
  is required.
- Product images are catalog data stored in Supabase Storage, not bundled in the
  application source.
- Team images used by the About page live in the existing public team-image
  collection and must be compressed before release.
- Remove unused exports and scratch images after verifying they have no runtime
  references.
