# Plain-language admin navigation

## Navigation order

| Section | Pages, in order |
| --- | --- |
| Daily tasks (always visible) | Dashboard, Orders, Payments, Reports |
| Products & stock | Products, Stock levels, Product categories |
| Customers & help | Customers, Customer messages, Customer reviews, Member rewards |
| Website | Pages & emails, Shopping experience |
| Settings & team | Store settings, Staff & permissions, Website status, Change history |

The 17 existing routes are each listed exactly once. Entries and empty groups
are filtered by the existing role rules. No role, URL, database permission,
business operation, or mobile application is changed.

Page labels and search aliases are defined in `src/lib/admin/admin-navigation.ts`.
The same labels drive the sidebar, mobile group links, header, browser title,
search results and keyboard-shortcut help. Renamed page headings are aligned.
Search still recognizes previous terms such as inventory, merchandising,
operations health, support, member tiers and activity logs.

## Interaction and accessibility

- Main tasks need no group expansion. Secondary sections expand one at a time.
- The active page's group opens on navigation, search and direct links.
- Collapsed desktop navigation retains all allowed links, labels and badges.
- Mobile navigation scrolls independently, keeps close/sign-out controls
  reachable, supports safe-area insets and uses 44px links/buttons.
- Hidden group content is removed from keyboard and screen-reader navigation;
  group buttons expose their expanded state and controlled panel.
- Existing dialog focus trapping, Escape handling and return-focus are retained.
- Group expansion adds no page-data request or subscription. Existing security
  session activity and compact attention-count updates remain unchanged.

## Verification

- Unit tests cover complete page coverage, order, labels, route boundaries,
  role restrictions and old-name search aliases.
- Isolated browser fixtures cover desktop, tablet, 320px phones and landscape;
  all 17 links for super administrators and all staff links; administrator
  restrictions; menu keyboard handling, focus recovery, badges, sidebar
  persistence, responsive bounds, and search-based navigation.
- Run `npm run verify:release` and `npm run test:browser` before deployment.
- Repeat navigation fixtures against the hosted build with backend requests
  intercepted; production orders, payments and customer records are not edited.
