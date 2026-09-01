# Administration workspace

The administrator portal is divided by operational ownership:

| Module | Responsibility |
| --- | --- |
| `shell` | Authentication gate, navigation, notifications, and workspace layout |
| `catalog` | Products, categories, inventory, media, and specifications |
| `operations` | Dashboard, orders, payments, customers, reviews, support, reports, and audit activity |
| `loyalty` | Home Circle membership and tier monitoring |
| `merchandising` | Customer demand signals and storefront experience controls |
| `content` | Managed storefront content and promotional banners |
| `team-settings` | Staff access, roles, invitations, and store configuration |

Admin routes are loaded lazily from `src/app/App.tsx`. Shared administrator
layout belongs in `shell`; business-specific code stays in its owning module.
