# Administration workspace

The administrator portal is divided by operational ownership:

| Module | Responsibility |
| --- | --- |
| `shell` | Persistent `AdminLayout`: security gates, navigation, command palette, notifications, shortcuts |
| `catalog` | Products, categories, inventory, media, and specifications |
| `operations` | Overview and health (`OperationsManagement.tsx`), plus one file per page: `OrdersDesk`, `PaymentsPage`, `CustomersPage`, `ReviewsPage`, `SupportPage`, `ActivityLogsPage`, `ReportsPage` |
| `loyalty` | Home Circle membership and tier monitoring |
| `merchandising` | Customer demand signals and storefront experience controls |
| `content` | Managed storefront content and promotional banners |
| `team-settings` | Staff access, roles, invitations, and store configuration |

Admin routes are loaded lazily from `src/app/App.tsx` as children of the
persistent `AdminLayout`. Shared administrator UI lives in
`src/components/admin/` (see the Admin workspace section of
`docs/DESIGN_SYSTEM.md`); business-specific code stays in its owning module.
