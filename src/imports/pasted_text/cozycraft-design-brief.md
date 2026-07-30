Create a complete, modern, interactive, and responsive client-side e-commerce website design for a furniture brand named “CozyCraft Furnitures.”

Use the uploaded CozyCraft Furnitures logo as the official brand identity. Do not redesign, distort, crop, recolor, or replace the logo. Preserve its monochrome black and warm off-white appearance. The logo contains a minimalist sofa shape, so subtly reflect its rounded horizontal form in buttons, cards, image containers, and selected interface elements.

PROJECT CONTEXT

CozyCraft Furnitures is a Business-to-Consumer furniture e-commerce platform. The current scope focuses on three main product categories:

1. Living Room
   - Sofas
   - Coffee Tables
   - TV Stands

2. Bedroom
   - Beds
   - Wardrobes
   - Nightstands

3. Dining Room
   - Dining Tables
   - Dining Chairs
   - Dining Storage

The website will be developed using React.js and Vite. Design all pages and components so that they can be converted into reusable React components without relying on complicated visual effects or design structures that are difficult to implement.

DESIGN DIRECTION

Create a minimalist, premium, calm, and professional furniture-shopping experience. The visual style should feel similar to a modern interior-design catalog rather than a crowded online marketplace.

Use the following visual direction:

- Warm off-white main background: #F4F2EE
- White surface color: #FFFFFF
- Primary charcoal or near-black: #191919
- Secondary text: #66635F
- Soft border color: #DDD9D2
- Restrained warm beige accent: #B8A58D
- Optional muted sage accent for small status indicators only: #7E8975
- Avoid bright colors, gradients, glassmorphism, neon effects, excessive shadows, and overly rounded elements
- Use subtle shadows only when necessary
- Use generous spacing and a strong visual hierarchy
- Use large, high-quality furniture images with clean neutral interiors
- Use a modern sans-serif font such as Inter, Manrope, or Plus Jakarta Sans
- Optionally use an elegant serif font such as Cormorant Garamond only for selected hero headings
- Keep buttons and form controls professional, readable, and consistent
- Maintain strong contrast and accessibility

OVERALL LAYOUT

Create a desktop-first responsive design that also adapts properly to tablet and mobile screens.

Use a maximum content width of approximately 1280 to 1440 pixels with consistent horizontal spacing. Use a responsive 12-column grid on desktop, 8 columns on tablet, and 4 columns on mobile.

Do not create an administrator dashboard yet. Focus only on the customer-facing website.

GLOBAL HEADER

Create a clean sticky header containing:

- CozyCraft Furnitures logo on the left
- Navigation links:
  - Home
  - Living Room
  - Bedroom
  - Dining Room
  - New Arrivals
  - About
- Search icon
- Wishlist icon with count
- Shopping cart icon with count
- Account or profile icon
- Mobile hamburger menu for smaller screens

When the user scrolls, reduce the header height slightly and add a very subtle bottom border or shadow.

Create a large search overlay or expandable search field that supports:
- Product name search
- Suggested products
- Recent searches
- Category suggestions
- No-result state

HOME PAGE

Create a polished home page containing:

1. Announcement Bar
   - Short message about delivery, secure checkout, or a seasonal offer
   - Keep it minimal and dismissible

2. Hero Section
   - Large furniture lifestyle image
   - Short premium headline such as:
     “Furniture That Makes Home Feel Complete”
   - Supporting sentence
   - Primary button: “Shop Collection”
   - Secondary text button: “Explore Categories”
   - Avoid sliders or carousels in the hero
   - Add a subtle image transition or text entrance animation

3. Main Categories
   - Three large visual category cards:
     - Living Room
     - Bedroom
     - Dining Room
   - Each card must include a high-quality image, title, short description, and “Explore” action
   - Use a clean editorial layout rather than three generic identical boxes

4. Featured Products
   - Responsive product grid
   - Each product card must show:
     - Product image
     - Product name
     - Category
     - Price in Philippine peso
     - Available or low-stock label
     - Rating
     - Wishlist button
     - Quick-view action
     - Add-to-cart action
   - Add a subtle image zoom and button reveal on hover
   - On mobile, keep all essential actions accessible without hover

5. New Arrivals
   - Horizontal product section or structured grid
   - Include a “View All” action

6. Shop by Room
   - Interior room imagery with clickable product hotspots or product suggestions
   - Keep the implementation simple enough to reproduce in React

7. Brand Value Section
   - Quality Furniture
   - Secure Payments
   - Reliable Delivery
   - Customer Support
   - Use simple line icons and concise text

8. Promotional Editorial Banner
   - Large image with a minimal message and one call-to-action
   - Do not use aggressive sale graphics

9. Customer Reviews
   - Show three clean review cards
   - Include name, rating, verified purchase, and short review
   - Add accessible carousel controls only when needed

10. Newsletter
   - Minimal email subscription field
   - Clear privacy-friendly message

11. Footer
   - Logo
   - Product categories
   - Customer service links
   - About links
   - Contact details
   - Social links
   - Payment-method indicators
   - Copyright
   - Terms and privacy links

PRODUCT CATALOG PAGE

Create a product-listing page for each main category.

Include:

- Breadcrumb navigation
- Category title and short description
- Product result count
- Sort options:
  - Featured
  - Newest
  - Price: Low to High
  - Price: High to Low
  - Best Rated
- Filters:
  - Category
  - Subcategory
  - Price range
  - Material
  - Availability
  - Rating
- Desktop filter sidebar
- Mobile filter drawer
- Grid and list-view controls
- Responsive product grid
- Loading skeletons
- Empty-results state
- Pagination or “Load More” button
- Active-filter chips with individual remove actions
- Clear-all-filters option

PRODUCT DETAILS PAGE

Create a detailed product page containing:

- Breadcrumbs
- Large image gallery
- Thumbnail navigation
- Image zoom
- Product name
- Category and subcategory
- Rating and review count
- Price
- Short product summary
- Material
- Dimensions
- Available stock
- Quantity selector
- Add to Cart button
- Buy Now button
- Wishlist button
- Delivery-location field
- Estimated delivery information
- Product-description accordion
- Specifications accordion
- Care instructions
- Warranty or return information
- Customer reviews
- Related products
- Recently viewed products

Keep the purchasing panel visible on desktop when scrolling through the product images, but avoid intrusive sticky behavior on mobile.

QUICK VIEW

Create a product quick-view modal containing:

- Product image
- Product name
- Price
- Availability
- Short description
- Quantity selector
- Add to Cart
- Link to full product details

SHOPPING CART

Create a responsive shopping-cart page with:

- Product thumbnail
- Product name and selected details
- Unit price
- Quantity stepper
- Subtotal
- Remove action
- Move to wishlist action
- Stock-warning message
- Coupon or promotional-code field
- Delivery estimate
- Order summary
- Subtotal
- Shipping fee
- Discount
- Total
- Continue Shopping button
- Proceed to Checkout button
- Empty-cart state with recommended products

CHECKOUT

Create a clean multi-step checkout process:

Step 1: Delivery Information
- Full name
- Phone number
- Email
- Complete address
- Region, province, city, and postal code
- Save-address option

Step 2: Delivery Method
- Standard delivery
- Scheduled delivery when available
- Estimated date and fee

Step 3: Payment Method
- E-wallet
- Debit or credit card
- Online banking
- Bank transfer
- Clearly state that final options depend on the selected payment gateway

Step 4: Review and Confirmation
- Ordered products
- Delivery information
- Payment method
- Fees and total
- Terms confirmation
- Place Order button

Include:
- Progress indicator
- Form validation
- Clear inline error messages
- Loading state
- Payment-failed state
- Successful-order confirmation page
- Generated order reference number

AUTHENTICATION PAGES

Create:

- Login
- Registration
- Forgot Password
- Reset Password

Use a split layout on desktop with furniture imagery on one side and the form on the other. Stack the layout on mobile.

Include:
- Password visibility toggle
- Password-strength guidance
- Remember Me
- Validation states
- Secure and simple form design
- Link between login and registration

CUSTOMER ACCOUNT

Create an account area with a clean sidebar on desktop and tabs or menu cards on mobile.

Include:

- Account Overview
- Personal Information
- Saved Addresses
- Wishlist
- Current Orders
- Order History
- Notifications
- Password and Security
- Logout

ORDER HISTORY AND TRACKING

Create:

1. Order History Page
   - Order reference
   - Date
   - Product summary
   - Total
   - Payment status
   - Order status
   - View Details button
   - Reorder button when appropriate

2. Order Details Page
   - Purchased products
   - Delivery address
   - Payment summary
   - Transaction timeline
   - Cancellation request when allowed

3. Tracking Timeline
   - Order Confirmed
   - Preparing for Shipment
   - Shipped
   - Out for Delivery
   - Delivered

Show completed, current, and upcoming stages clearly. Do not claim live GPS tracking unless an actual logistics API will support it.

WISHLIST

Create a wishlist page with:

- Product cards
- Price
- Availability
- Add to Cart
- Remove
- Clear Wishlist
- Empty-wishlist state

RATINGS AND REVIEWS

Allow verified customers to:

- Select a star rating
- Write a review
- Upload optional product images
- Submit only after an order is delivered

Display:
- Average rating
- Rating distribution
- Verified-purchase label
- Sort and filter controls

SUPPORT PAGES

Create:

- About CozyCraft Furnitures
- Contact Us
- Frequently Asked Questions
- Delivery Information
- Returns and Warranty
- Privacy Policy
- Terms and Conditions

INTERACTIONS AND MICRO-ANIMATIONS

Use subtle and professional interactions:

- Smooth page transitions
- Product-card hover elevation
- Image zoom on hover
- Wishlist icon state change
- Add-to-cart confirmation toast
- Cart-count animation
- Filter drawer animation
- Accordion expansion
- Form-validation feedback
- Skeleton loading states
- Success and error notifications
- Smooth scrolling
- Respect reduced-motion accessibility settings

Do not use excessive animations, parallax effects, floating decorative objects, or auto-playing video.

RESPONSIVENESS

Create complete designs for:

- Desktop: 1440px
- Laptop: 1280px
- Tablet: 768px
- Mobile: 390px

Ensure that:

- Navigation becomes a drawer on mobile
- Product grids adapt from four columns to two and then one or two columns depending on space
- Filters become a mobile bottom sheet or drawer
- Checkout forms stack correctly
- Buttons meet accessible touch-target sizes
- Text does not overflow
- Product images maintain proper aspect ratios
- No element depends only on hover
- Tables become mobile cards when necessary

REACT.JS + VITE IMPLEMENTATION COMPATIBILITY

Structure the design so it can be converted into reusable React components.

Suggested reusable components:

- Header
- MobileNavigationDrawer
- Footer
- SearchOverlay
- Breadcrumbs
- CategoryCard
- ProductCard
- ProductGrid
- FilterSidebar
- MobileFilterDrawer
- SortDropdown
- ProductGallery
- QuantitySelector
- RatingStars
- ReviewCard
- CartItem
- OrderSummary
- CheckoutStepper
- FormField
- StatusBadge
- OrderTimeline
- Modal
- ToastNotification
- LoadingSkeleton
- EmptyState

Use route-ready page organization:

- /
- /living-room
- /bedroom
- /dining-room
- /products
- /products/:productId
- /search
- /wishlist
- /cart
- /checkout
- /order-success
- /login
- /register
- /forgot-password
- /account
- /account/orders
- /account/orders/:orderId
- /account/addresses
- /account/settings
- /about
- /contact
- /faq

Use semantic HTML structures, accessible labels, keyboard-friendly controls, visible focus states, alt-text placeholders, and WCAG-friendly color contrast.

Do not hard-code the layout around one product. Design all listings to accept dynamic data from RESTful APIs. Use realistic mock furniture data that can later be replaced with API responses.

Prepare the interface for these data fields:

Product:
- id
- name
- category
- subcategory
- description
- price
- dimensions
- material
- stockQuantity
- stockStatus
- imageUrls
- averageRating
- reviewCount

Cart item:
- productId
- quantity
- unitPrice
- subtotal

Order:
- orderId
- customerId
- items
- deliveryAddress
- paymentMethod
- paymentStatus
- orderStatus
- shippingFee
- totalAmount
- createdAt

FINAL OUTPUT

Produce a cohesive client-side design system and interactive website prototype for CozyCraft Furnitures.

Include:

- Brand color styles
- Typography styles
- Spacing system
- Button variants
- Form states
- Status badges
- Product-card states
- Desktop, tablet, and mobile layouts
- Reusable components
- Interactive prototype connections
- Loading, empty, success, and error states

The final result must look premium, minimalist, realistic, and suitable for a modern furniture business. It should remain visually aligned with the uploaded monochrome CozyCraft Furnitures logo and be practical to implement using React.js, Vite, RESTful APIs, and reusable frontend components.

Do not generate an admin dashboard in this version. Focus entirely on the customer-facing website.