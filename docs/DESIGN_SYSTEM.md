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

- Body text uses the project sans-serif stack loaded from `src/styles/fonts.css`.
- Editorial product and campaign headings may use the project serif family.
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

## Controls and feedback

- Button labels describe the result: `Create product`, `Save address`, or
  `Approve review` rather than a generic `Submit`.
- Destructive actions require explicit confirmation and identify the affected
  record.
- Loading states preserve layout with skeletons or an inline progress message.
- Empty states explain why the area is empty and, when useful, provide the next
  action.
- Success and error notifications use plain language, can be dismissed, and
  normally disappear after eight seconds.
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
