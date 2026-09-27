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

- Both surfaces use self-hosted variable fonts from `@fontsource-variable`
  (imported in `src/main.tsx`): **Inter** for body and interface text and
  **Fraunces** (with optical sizing) for editorial headings. They are scoped
  through `:root[data-surface="store"]` in `src/styles/storefront.css` and
  `:root[data-surface="admin"]` in `src/styles/admin.css`.
- Numbers in tables, totals and counters use `adm-num` (tabular, lining
  figures) so columns line up.
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
  Toasts show a tone icon, stay five seconds (seven with an action, eight for
  errors). Pass an explicit `tone` whenever the caller knows the outcome; in
  the admin, `useNotice()` does this so failures never look like successes.
- Disabled controls remain legible and explain unmet requirements when the
  reason is not obvious.

## Admin workspace

The operations workspace shares the brand but is tuned for speed and density.
Styles live in `src/styles/admin.css`; components in `src/components/admin/`.

- **Frame.** `AdminLayout` (in `features/admin/shell`) is one persistent route
  that owns security checks, the collapsible sidebar (full or icon rail), the
  header, the command palette (⌘K), notifications, and keyboard shortcuts.
  Pages render through its `<Outlet/>`, so navigation never re-runs security
  checks. Sidebar badges come from a shared, cached attention summary.
- **Page anatomy.** Every page starts with `PageHeader` (eyebrow, serif
  title, one-line description, actions) and, when useful, a `StatStrip` of
  three or four linked metrics. Content sits in `Card` + `CardHeader`.
- **Tokens.** Use semantic colors: `bg-canvas`, `bg-card`, `bg-subtle`,
  `bg-inverse`, `bg-brand`, and tone pairs such as
  `bg-success-soft text-success-ink` (also warning, danger, info). `Pill` and
  `Status` map states to these tones.
- **Themes.** Light, dark, or automatic (profile menu or ⌘K). Dark values
  redefine the shared tokens under `[data-admin-theme="dark"]`, so components
  written with tokens need no dark-specific classes.
- **Controls.** `adm-btn` (+ `-primary`, `-danger`, `-ghost`, `-sm`,
  `-icon`), `adm-input`, `adm-select`, `adm-textarea`, `adm-label`,
  `adm-chip`, `Switch`, `Segmented` (gliding highlight), `SearchField`
  (focus with `/`), `ActionMenu`, `CopyButton`, and `Pagination`.
- **Tables.** `adm-table` gives sticky headers, right-aligned numeric columns
  (`adm-right adm-num`), sortable headers (`adm-sort`) and selected rows
  (`data-selected`). Below `md`, tables switch to stacked rows.
- **Overlays.** `Sheet` (right panel; full-height sheet on phones), `Dialog`,
  and `confirmAction`/`promptAction` from `components/admin/confirm.tsx`.
  Never use `window.confirm` or `window.prompt`. Risky actions (deletes,
  role changes, bulk updates, refunds, marking cash received) must confirm;
  permanent deletions also require typing a phrase.
- **Master–detail.** Orders, customers and support show list and detail side
  by side on large screens and open the detail in a `Sheet` on smaller ones.
- **Data loading.** Pass `{ keepPrevious: true }` to `useAdminQuery` for
  paged or filtered views: the last results stay visible with a `BusyBar`
  while the next page loads, instead of blanking the screen.
- **Formats.** Use `src/lib/admin/format.ts` (`formatDate`,
  `formatDateTime`, `relativeTime`, `ageLabel`, `plural`, `humanize`) for
  Manila-time dates and consistent wording.
- **Motion.** Admin timings are shorter than the storefront's (`--dur-1…4`
  are redefined to 110–380 ms). Page content fades up once (`adm-page`,
  fill-mode `backwards` so fixed children are not trapped), rows flash
  (`adm-flash`) when live data changes them, and sections expand with
  `adm-collapse`.
- **Keyboard.** ⌘K / Ctrl K search and jump, `/` search this page, `?`
  shortcuts, `G` then a letter to navigate; the order desk adds `J`/`K`, `X`
  and `P`.

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
