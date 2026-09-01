# Source code map

The web source uses feature-oriented modules so storefront and admin work remain
easy to locate without duplicating shared business rules.

- `app`: application composition, route registration, root state, and shared
  runtime context.
- `assets`: imported brand assets.
- `components`: reusable presentational controls and resilient media helpers.
- `features`: administrator and storefront vertical slices. Feature-specific
  screens and UI stay within their owning business area.
- `lib`: framework-light domain rules grouped by business area. Tests are
  colocated with these modules.
- `services`: Supabase and authentication integration boundaries.
- `styles`: global entry points, brand tokens, fonts, and responsive safeguards.

New feature-specific UI belongs in `features/<portal>/<feature>`. Move code into `components`
only after it is genuinely shared. Move deterministic business rules into `lib`
so they can be unit tested without rendering a page.
