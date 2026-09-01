# Feature modules

Feature code is organized by portal and business responsibility. A feature owns
its route-level screens, feature-only UI, and orchestration logic. Shared domain
rules remain in `src/lib`, external-system calls remain in `src/services`, and
truly reusable presentation belongs in `src/components`.

```text
features/
├── admin/        Staff-only catalog, operations, loyalty, content, and settings
└── storefront/   Customer authentication, catalog, commerce, and account flows
```

Features may depend on application context, domain libraries, services, and
shared components. They must not import another portal's implementation.
