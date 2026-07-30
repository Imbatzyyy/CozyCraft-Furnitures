ADMIN-SIDE APPLICATION

Also design a complete, modern, responsive, and interactive administrator dashboard for CozyCraft Furnitures.

The administrator dashboard will be part of the React.js + Vite web application. It must use the same brand identity, typography, spacing system, colors, and visual language as the customer-facing website, but the layout should be optimized for business management and data visibility.

The administrator dashboard must connect conceptually to the same RESTful APIs, backend services, and Supabase PostgreSQL database used by the customer-facing web and mobile applications.

ADMIN DESIGN DIRECTION

Create a professional and minimalist management interface using:

- Warm off-white background
- White content panels
- Charcoal text
- Soft gray borders
- Restrained warm beige accents
- Clear data hierarchy
- Compact but readable spacing
- Minimal shadows
- Simple line icons
- Accessible status colors
- Responsive layouts

The admin interface should feel modern and efficient rather than decorative. Avoid excessive gradients, glassmorphism, oversized cards, unnecessary animations, and bright dashboard colors.

ADMIN APPLICATION STRUCTURE

Use a secured admin route structure:

- /admin/login
- /admin
- /admin/products
- /admin/products/new
- /admin/products/:productId
- /admin/categories
- /admin/inventory
- /admin/orders
- /admin/orders/:orderId
- /admin/payments
- /admin/customers
- /admin/reviews
- /admin/reports
- /admin/activity-logs
- /admin/settings

ADMIN LOGIN PAGE

Create a secure administrator login page containing:

- CozyCraft Furnitures logo
- Email or username field
- Password field
- Password visibility toggle
- Remember Me option
- Forgot Password link
- Login button
- Form validation
- Invalid-credentials state
- Loading state
- Secure administrator-access message

Use a clean split-screen layout on desktop and a single-column layout on mobile.

ADMIN LAYOUT

Create a reusable admin layout containing:

1. Sidebar Navigation
   - Dashboard
   - Products
   - Categories
   - Inventory
   - Orders
   - Payments
   - Customers
   - Reviews
   - Reports
   - Activity Logs
   - Settings
   - Logout

2. Top Navigation Bar
   - Current page title
   - Search
   - Notifications
   - Administrator profile menu
   - Sidebar collapse control
   - Mobile navigation control

3. Main Content Area
   - Breadcrumbs
   - Page heading
   - Description or page actions
   - Responsive content panels

The sidebar should collapse on smaller desktop screens and become a drawer on tablets and mobile devices.

ADMIN DASHBOARD OVERVIEW

Create an administrator dashboard containing:

- Total sales
- Total orders
- Pending orders
- Completed orders
- Registered customers
- Total products
- Low-stock products
- Out-of-stock products

Include:

- Sales trend chart
- Order-status summary
- Best-selling products
- Recent customer orders
- Low-stock warning panel
- Recent administrator activity
- Quick-action buttons:
  - Add Product
  - View Orders
  - Update Inventory
  - Generate Report

Use realistic mock data and restrained visualizations. Charts should remain simple and practical to implement using a React-compatible chart library.

PRODUCT MANAGEMENT MODULE

Create a product-management page containing:

- Product search
- Category filter
- Stock-status filter
- Sort controls
- Product table or responsive card list
- Product image
- Product name
- Category
- Subcategory
- Price
- Available quantity
- Product status
- Date updated
- Edit action
- Deactivate action
- Delete action
- Add Product button
- Bulk-selection controls
- Pagination
- Loading and empty states

Create an Add/Edit Product form containing:

- Product name
- Category
- Subcategory
- Short description
- Full description
- Price
- Material
- Dimensions
- Stock quantity
- Low-stock threshold
- Product status
- Multiple image upload
- Image preview
- Featured-product option
- New-arrival option
- Save Draft
- Publish Product
- Cancel

Include:

- Required-field validation
- Numeric validation
- Image-upload progress
- Successful-save notification
- Error state
- Unsaved-changes warning

CATEGORY MANAGEMENT MODULE

Create a category-management page for:

- Living Room
- Bedroom
- Dining Room

Include subcategories:

Living Room:
- Sofas
- Coffee Tables
- TV Stands

Bedroom:
- Beds
- Wardrobes
- Nightstands

Dining Room:
- Dining Tables
- Dining Chairs
- Dining Storage

Allow administrators to:

- Add category
- Edit category
- Add subcategory
- Edit subcategory
- Reorder categories
- Activate or deactivate categories
- View associated product count

INVENTORY MANAGEMENT MODULE

Create an inventory-management page containing:

- Product name
- SKU or product reference
- Category
- Current stock
- Low-stock threshold
- Stock status
- Last updated
- Update-stock action

Include filters for:

- All products
- In stock
- Low stock
- Out of stock
- Category

Allow administrators to:

- Increase stock
- Decrease stock
- Set exact stock quantity
- Define low-stock threshold
- View inventory movement history
- Add inventory-adjustment reason
- Confirm stock adjustment

Include status badges:

- In Stock
- Low Stock
- Out of Stock

Create an inventory-history drawer or modal showing:

- Previous quantity
- New quantity
- Adjustment amount
- Reason
- Administrator
- Date and time

ORDER MANAGEMENT MODULE

Create an order-management page containing:

- Order reference number
- Customer
- Order date
- Number of products
- Total amount
- Payment status
- Order status
- Delivery status
- View-details action

Include filters for:

- Date range
- Payment status
- Order status
- Delivery status
- Customer
- Order reference

Use consistent order statuses:

- Order Confirmed
- Preparing for Shipment
- Shipped
- Out for Delivery
- Delivered
- Cancelled

Create an Order Details page containing:

- Order reference
- Customer information
- Delivery address
- Ordered products
- Product quantities
- Product prices
- Shipping fee
- Discount
- Total amount
- Payment method
- Payment status
- Order timeline
- Internal administrator notes
- Cancellation request details
- Update-status control
- Tracking reference field
- Print or export order summary

Allow administrators to:

- Confirm an order
- Update fulfillment status
- Approve or reject cancellation requests
- Add tracking information
- Record internal notes
- View payment information

PAYMENT MANAGEMENT MODULE

Create a payment-management page containing:

- Payment reference
- Order reference
- Customer
- Payment method
- Amount
- Date
- Payment status

Use statuses:

- Pending
- Successful
- Failed
- Cancelled
- Refunded

Allow administrators to:

- View transaction details
- Verify manual bank-transfer payments
- Update payment status when authorized
- Record refund information
- View associated order
- Search and filter transactions

Clearly separate simulated payment records from real external payment-gateway processing.

CUSTOMER MANAGEMENT MODULE

Create a customer-management page containing:

- Customer name
- Email
- Contact number
- Number of orders
- Total spending
- Account status
- Registration date
- View-profile action

Create a Customer Details page containing:

- Personal information
- Saved addresses
- Current orders
- Order history
- Wishlist summary
- Submitted reviews
- Account activity
- Account status

Allow authorized administrators to activate or deactivate accounts when necessary.

REVIEW MANAGEMENT MODULE

Create a review-moderation page containing:

- Product
- Customer
- Star rating
- Review text
- Submitted images
- Verified-purchase status
- Submission date
- Review status

Allow administrators to:

- Approve reviews
- Hide inappropriate reviews
- Remove invalid reviews
- View the associated product and order
- Search and filter by rating or status

SALES AND INVENTORY REPORTING MODULE

Create a reporting page containing:

- Date-range selector
- Report-type selector
- Generate Report button
- Export controls

Include reports for:

- Daily sales
- Weekly sales
- Monthly sales
- Yearly sales
- Product performance
- Best-selling products
- Order-status totals
- Payment-method distribution
- Inventory status
- Low-stock products
- Out-of-stock products
- Inventory movements

Use:

- Summary cards
- Simple bar charts
- Simple line charts
- Pie or donut charts only when appropriate
- Responsive tables

Allow reports to be exported conceptually into:

- PDF
- CSV
- Spreadsheet format

Do not use fake complex business intelligence dashboards. Keep the reports understandable and realistic for a student e-commerce project.

ACTIVITY LOG MODULE

Create an administrator activity-log page containing:

- Administrator name
- Action performed
- Module
- Affected record
- Date and time
- IP address placeholder when available
- View-details action

Record example activities such as:

- Product created
- Product updated
- Product deactivated
- Inventory adjusted
- Order status changed
- Payment status updated
- Customer account status changed
- Review removed

Include search, filters, date range, pagination, and empty states.

ADMIN SETTINGS

Create a basic settings area containing:

- Store information
- Contact information
- Delivery settings
- Low-stock default threshold
- Notification preferences
- Administrator account settings
- Password and security
- Logout from all sessions

ROLE-BASED ACCESS

Prepare the interface for role-based access control.

Possible roles:

- Super Administrator
- Product Manager
- Inventory Staff
- Order Staff
- Report Viewer

Different administrator roles should only see the pages and actions permitted for them.

Do not expose administrator controls in the customer-facing application.

ADMIN INTERACTIONS

Include subtle and practical interactions:

- Sidebar collapse
- Mobile drawer navigation
- Search and filtering
- Confirmation dialogs
- Delete warnings
- Success and error toasts
- Form validation
- Loading skeletons
- Empty states
- Pagination
- Table sorting
- Responsive table-to-card transformation
- Unsaved-changes warning
- File-upload progress
- Accessible modal windows

REACT.JS + VITE COMPATIBILITY

Structure the administrator interface using reusable React components.

Suggested components:

- AdminLayout
- AdminSidebar
- AdminHeader
- AdminBreadcrumbs
- MetricCard
- DataTable
- FilterBar
- SearchInput
- StatusBadge
- ProductForm
- ImageUploader
- StockAdjustmentModal
- OrderTimeline
- ConfirmationDialog
- ReportChart
- ExportMenu
- ActivityLogTable
- Pagination
- LoadingSkeleton
- EmptyState
- ToastNotification

All tables, cards, charts, and forms must accept dynamic data from RESTful APIs.

Prepare the admin interface for these main API resources:

- /api/auth
- /api/products
- /api/categories
- /api/inventory
- /api/orders
- /api/payments
- /api/customers
- /api/reviews
- /api/reports
- /api/activity-logs

RESPONSIVENESS

Design complete administrator layouts for:

- Desktop: 1440px
- Laptop: 1280px
- Tablet: 768px
- Mobile: 390px

Ensure that:

- The sidebar becomes a drawer on mobile
- Wide tables become responsive cards or horizontally scrollable tables
- Forms use multiple columns on desktop and one column on mobile
- Charts resize without overflow
- Buttons maintain accessible touch sizes
- Modals fit smaller screens
- Important actions remain visible
- No administrative action depends only on hover

FINAL COMPLETE OUTPUT

Produce one unified CozyCraft Furnitures design system containing both:

1. Customer-facing e-commerce website
2. Administrator dashboard

The customer and administrator interfaces must share:

- Brand colors
- Typography
- Logo usage
- Button styles
- Form styles
- Status styles
- Spacing system
- Component behavior

However, the customer interface should feel visually immersive and product-focused, while the administrator interface should prioritize clarity, efficiency, management, and data presentation.

Create interactive prototype connections for both customer and administrator workflows.

The final design must be practical to implement using:

- React.js
- Vite
- React Router
- RESTful APIs
- Node.js and Express.js backend services
- Supabase PostgreSQL
- Reusable React components
- Responsive CSS or Tailwind CSS

Do not generate only static visual screens. Include realistic interactions, loading states, error states, empty states, success states, and reusable components for both sides of the system.