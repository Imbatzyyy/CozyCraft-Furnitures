# Mobile 1.0.81 shared-backend support

The additive `20261004090000_mobile_bounded_reads_and_recovery.sql` migration:

- Exposes five approved reviews per page with full-product totals, average and rating counts. It is security-invoker and retains the existing review RLS.
- Adds a partial product/review-history index.
- Publishes delivery areas for compatible clients.
- Publishes a read-only `mobile_storefront_signals` table containing only topic and timestamp. Triggers invalidate delivery areas and product reviews even when deactivation/moderation makes the original row invisible under RLS.
- Reuses the existing owner-bound `customer_order_page` function for mobile orders; no payment, inventory, pricing or settlement logic is changed.

The native app uses the existing Netlify Image CDN only for allowlisted public product images. The CDN route permits cross-origin images for Capacitor. Private avatars, signed images and review photos are not added to the public proxy allowlist. Full-screen photos retain their originals; failed transformations fall back to the original image.

Run `node scripts/verify-mobile-read-models.mjs --rehearse` before applying the migration and rerun without the flag afterward. All 16 checks run in a rolled-back transaction, including owner isolation, pagination/count accuracy, public review visibility, read-only signals and synthetic deactivation/moderation/deletion trigger checks. Synthetic trigger tables do not invoke production fulfillment/email triggers.

Apply only this migration to the linked shared project. Do not replay divergent mobile/website migration histories or redeploy old payment functions from the mobile repository. Preserve existing grants and RLS.

Deployment does not install the new native app on existing phones. GitHub release 1.0.81 is a testing APK/source release, not App Store or Play Store publication. Apple background push still needs the owner's APNs credentials. Browser fixtures and unsigned Simulator builds do not prove a physical-device payment or push-delivery journey.
