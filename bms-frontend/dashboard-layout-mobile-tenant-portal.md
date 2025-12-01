# Dashboard Layout & Mobile Tenant Portal (Detailed Plan)

## Goals

- Create a reusable dashboard layout for all admin/staff routes (excluding tenant portal).
- Implement collapsible sidebar with role-based navigation.
- Build topbar with search, notifications, profile dropdown, and theme switcher.
- Design modular card system for dashboard widgets with loading/error states.
- Create separate mobile-first tenant portal UI optimized for small screens.

---

## Part 1 – Common Dashboard Layout (Admin/Staff)

### Step 1 – Dashboard Layout Component Structure

- **1.1 Create shared layout component**
  - **1.1.1** Create `src/components/layouts/DashboardLayout.tsx`:
    - Wraps all admin/staff routes.
    - Composes Sidebar, Topbar, and MainContentArea.
    - Handles responsive breakpoints (mobile sidebar becomes drawer).
    - Accepts `children` prop for page content.
  - **1.1.2** Structure:
    ```typescript
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <MainContentArea>{children}</MainContentArea>
      </div>
    </div>
    ```

- **1.2 Update route layouts**
  - **1.2.1** Modify `app/admin/layout.tsx`:
    - Import DashboardLayout.
    - Wrap children with DashboardLayout after auth guard.
  - **1.2.2** Modify `app/org/layout.tsx`:
    - Import DashboardLayout.
    - Wrap children with DashboardLayout after auth guard.
  - **1.2.3** Ensure tenant routes (`app/tenant/**`) do NOT use DashboardLayout:
    - Keep tenant layout separate for mobile-first design.

---

### Step 2 – Collapsible Sidebar Component

- **2.1 Create Sidebar component**
  - **2.1.1** Create `src/components/layouts/Sidebar.tsx`:
    - Collapsible state (expanded/collapsed) stored in localStorage or React context.
    - Toggle button (hamburger on mobile, collapse icon on desktop).
    - Smooth transition animations.
  - **2.1.2** Sidebar structure:
    - Logo/brand section at top.
    - Navigation menu in middle.
    - User info/collapse button at bottom.

- **2.2 Role-based menu items**
  - **2.2.1** Menu structure per role:
    - **SUPER_ADMIN**:
      - Dashboard, Organizations, System Settings, Users, Audit Logs.
    - **ORG_ADMIN**:
      - Dashboard, Buildings, Units, Tenants, Leases, Invoices, Payments, Complaints, Work Orders, Assets, Meters, Reports, Settings.
    - **BUILDING_MANAGER**:
      - Dashboard, Buildings (filtered), Units, Tenants, Complaints, Work Orders, Meters.
    - **FACILITY_MANAGER**:
      - Dashboard, Work Orders, Assets, Meters, Utilities, Maintenance Schedules.
    - **ACCOUNTANT**:
      - Dashboard, Invoices, Payments, Reports, Financial, Transactions.
    - **SECURITY**:
      - Dashboard, Visitors, Parking, Access Logs, Security Incidents.
    - **TECHNICIAN**:
      - Dashboard, My Work Orders, Assets, Tools, Schedule.
    - **AUDITOR**:
      - Dashboard, Reports (read-only), Audit Logs, Financial Reports.
  - **2.2.2** Menu item structure:
    - Icon (from lucide-react or similar).
    - Label (hidden when collapsed, show tooltip on hover).
    - Active route highlighting (match current pathname).
    - Optional nested submenus (for complex sections like Settings).

- **2.3 Create menu configuration**
  - **2.3.1** Create `src/lib/navigation/menu-items.ts`:
    - Define menu items per role with icons, labels, paths, permissions.
    - Type definition for menu item:
      ```typescript
      interface MenuItem {
        label: string;
        icon: React.ComponentType;
        path: string;
        roles: string[];
        children?: MenuItem[];
      }
      ```
  - **2.3.2** Helper function: `getMenuItemsForRole(role: string): MenuItem[]`.
  - **2.3.3** Filter menu items based on user's roles from session.

- **2.4 Mobile behavior**
  - **2.4.1** On mobile (< 768px):
    - Sidebar becomes overlay drawer.
    - Opens from left on hamburger click.
    - Closes on backdrop click or route change.
    - Full-screen overlay with backdrop blur.

---

### Step 3 – Topbar Component

- **3.1 Create Topbar component**
  - **3.1.1** Create `src/components/layouts/Topbar.tsx`:
    - Fixed/sticky at top of viewport.
    - Horizontal layout with left, center, right sections.

- **3.2 Search bar**
  - **3.2.1** Global search input:
    - Placeholder: "Search buildings, tenants, invoices..."
    - Debounced input (300ms delay).
    - Search icon on left, clear button on right.
  - **3.2.2** Search API endpoint: `GET /api/search?q=...`:
    - Returns results across entities: buildings, tenants, invoices, units, leases.
    - Grouped by entity type in dropdown.
    - Click result navigates to entity detail page.
  - **3.2.3** Search dropdown:
    - Shows when input has focus and query length > 0.
    - Loading state while fetching.
    - "No results" message.
    - Keyboard navigation (arrow keys, enter).

- **3.3 Notifications**
  - **3.3.1** Bell icon with badge count:
    - Red badge showing unread count.
    - Click opens notifications dropdown panel.
  - **3.3.2** Notifications dropdown:
    - List of recent notifications (last 10-20).
    - Each notification: icon, title, message, timestamp, "Mark as read" action.
    - "View all" link at bottom.
  - **3.3.3** API endpoint: `GET /api/notifications`:
    - Filtered by user role and organization.
    - Returns: `{ id, type, title, message, read, createdAt, link }`.
    - Types: complaint_assigned, invoice_overdue, work_order_assigned, payment_received, etc.
  - **3.3.4** Mark as read: `PATCH /api/notifications/[id]/read`.

- **3.4 Profile dropdown**
  - **3.4.1** User avatar/initials:
    - Circular avatar with user's initials or photo.
    - Click opens dropdown menu.
  - **3.4.2** Dropdown menu:
    - User name, email, role badge.
    - Divider.
    - Menu items: Profile, Settings, Logout.
    - Clicking profile navigates to `app/admin/profile/page.tsx`.

- **3.5 Theme switcher**
  - **3.5.1** Toggle button:
    - Sun icon (light mode) / Moon icon (dark mode).
    - Uses `next-themes` provider.
    - Toggles between light/dark themes.
  - **3.5.2** Persist theme preference in localStorage.

- **3.6 Responsive behavior**
  - **3.6.1** On mobile:
    - Search becomes icon-only (opens full search modal).
    - Notifications and profile remain as icons.
    - Hamburger menu button (toggles sidebar drawer).

---

### Step 4 – Main Content Area with Grid System

- **4.1 Create MainContentArea component**
  - **4.1.1** Create `src/components/layouts/MainContentArea.tsx`:
    - Container with padding and max-width.
    - Scrollable content area.
    - Accepts `children` prop.

- **4.2 Grid layout system**
  - **4.2.1** Use CSS Grid or Tailwind grid:
    - Responsive columns: 1 on mobile, 2 on tablet, 3-4 on desktop.
    - Gap between cards (e.g., `gap-4` or `gap-6`).
    - Auto-rows with min-height.
  - **4.2.2** Grid classes:
    - `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6`.

- **4.3 Dashboard page wrapper**
  - **4.3.1** Create `src/components/dashboard/DashboardPage.tsx`:
    - Provides grid container.
    - Optional page title and breadcrumbs.
    - Accepts `title`, `breadcrumbs`, `children` props.

---

### Step 5 – Modular Card System

- **5.1 Base card component**
  - **5.1.1** Create `src/components/ui/DashboardCard.tsx`:
    - Props:
      - `title`: string (card title).
      - `subtitle`: string (optional subtitle).
      - `icon`: React component (optional icon).
      - `children`: ReactNode (card content).
      - `loading`: boolean (show loading state).
      - `error`: string | null (show error state).
      - `actions`: ReactNode (optional action buttons in header).
      - `colSpan`: number (1-4, grid column span).
    - **5.1.2** Loading state:
      - Skeleton loader or spinner with "Loading..." text.
      - Use shadcn/ui Skeleton component if available.
    - **5.1.3** Error state:
      - Error message with retry button.
      - Icon indicating error.
    - **5.1.4** Empty state:
      - Optional empty message prop.
      - "No data" illustration or message.

- **5.2 Specific card widgets**
  - **5.2.1** Create `src/components/dashboard/cards/StatCard.tsx`:
    - Displays single metric (number + label + trend indicator).
    - Props: `label`, `value`, `trend` (optional: { value: number, direction: 'up' | 'down' }), `icon`, `formatValue` (function to format number).
    - Example metrics: "Total Revenue", "Occupancy Rate", "Pending Complaints", "Outstanding Receivables".
  - **5.2.2** Create `src/components/dashboard/cards/ChartCard.tsx`:
    - Wraps chart library (recharts or chart.js).
    - Props: `title`, `data`, `type` ('line' | 'bar' | 'pie' | 'area'), `xAxis`, `yAxis`, `loading`, `error`.
    - Responsive chart sizing.
  - **5.2.3** Create `src/components/dashboard/cards/TableCard.tsx`:
    - Displays data table with pagination.
    - Props: `title`, `columns` (array of column definitions), `data`, `loading`, `pagination` (optional), `onRowClick` (optional).
    - Uses shadcn/ui Table component if available.
  - **5.2.4** Create `src/components/dashboard/cards/ListCard.tsx`:
    - Simple list of items (e.g., recent activities, notifications).
    - Props: `title`, `items`, `renderItem` (function to render each item), `emptyMessage`, `loading`, `maxItems` (optional limit).
    - Scrollable list with max height.

- **5.3 Card data hooks/utilities**
  - **5.3.1** Create `src/hooks/useDashboardStats.ts`:
    - Fetches dashboard statistics from `GET /api/dashboard/stats`.
    - Returns: `{ data, loading, error, refetch }`.
    - Handles org scoping automatically.
  - **5.3.2** Create `src/hooks/useRecentActivity.ts`:
    - Fetches recent activities from `GET /api/dashboard/activity`.
    - Returns: `{ activities, loading, error }`.
  - **5.3.3** Create `src/hooks/useOverdueInvoices.ts`:
    - Fetches overdue invoices for dashboard.
    - Returns: `{ invoices, loading, error }`.

---

### Step 6 – Dashboard Pages

- **6.1 Admin dashboard (SUPER_ADMIN)**
  - **6.1.1** Create/update `app/admin/page.tsx`:
    - Uses DashboardLayout.
    - Grid of cards:
      - StatCard: Total Organizations, Total Buildings, Total Tenants, System Health.
      - ChartCard: Revenue trends (cross-org if applicable).
      - TableCard: Recent organizations, recent users.
    - Role-based: Only SUPER_ADMIN sees org-level stats.

- **6.2 Org dashboard (ORG_ADMIN and other org roles)**
  - **6.2.1** Create/update `app/org/page.tsx`:
    - Uses DashboardLayout.
    - Grid of cards:
      - StatCard: Total Buildings, Occupied Units, Vacancy Rate, Total Revenue, Outstanding Receivables, Pending Complaints.
      - ChartCard: Occupancy trends, revenue by building, monthly revenue.
      - ListCard: Recent complaints, overdue invoices, recent payments.
      - TableCard: Recent leases, recent tenants.
    - Role-based filtering: Show only data user has permission to see.

- **6.3 Building manager dashboard (optional)**
  - **6.3.1** Create `app/admin/buildings/[id]/dashboard/page.tsx`:
    - Building-specific metrics and widgets.
    - StatCard: Occupancy, Revenue, Outstanding, Complaints.
    - ChartCard: Unit status breakdown, revenue trends.
    - ListCard: Recent complaints, work orders for this building.

---

## Part 2 – Mobile-First Tenant Portal

### Step 7 – Tenant Mobile Layout

- **7.1 Create TenantMobileLayout component**
  - **7.1.1** Create `src/components/layouts/TenantMobileLayout.tsx`:
    - Bottom navigation bar (fixed at bottom):
      - Icons: Home, Invoices, Complaints, Profile.
      - Active route highlighting.
      - Touch-friendly (min 44x44px targets).
    - Top header (sticky):
      - Tenant name/avatar, balance indicator, notifications icon.
      - Simple, minimal design.
      - Back button on nested pages.
    - Main content area:
      - Full-width, no sidebar.
      - Scrollable with padding (`p-4`).
      - Safe area insets for mobile devices.

- **7.2 Update tenant layout**
  - **7.2.1** Modify `app/tenant/layout.tsx`:
    - Use TenantMobileLayout for authenticated tenant routes.
    - Keep public routes (login, signup) without layout (or use minimal layout).
    - Conditional rendering: public routes = no layout, authenticated = TenantMobileLayout.

---

### Step 8 – Tenant Dashboard (Mobile)

- **8.1 Update tenant dashboard page**
  - **8.1.1** Update `app/tenant/dashboard/page.tsx`:
    - Mobile-first design:
      - Large, touch-friendly buttons/cards.
      - Current balance card (prominent, large text).
      - Next due date card (with countdown if applicable).
      - Quick actions: Pay Now, Submit Complaint, View Lease.
    - List view for recent invoices:
      - Swipeable cards (optional swipe to pay).
      - Each invoice card: number, amount, due date, status badge, action button.
    - Pull-to-refresh functionality (optional, using browser API or library).

- **8.2 Dashboard cards for tenant**
  - **8.2.1** Balance card:
    - Large balance amount, currency (ETB).
    - "Pay Now" button (primary CTA).
  - **8.2.2** Next invoice card:
    - Due date, amount, days until due.
    - "View Invoice" button.
  - **8.2.3** Quick stats:
    - Total paid this month, invoices count, complaints count.

---

### Step 9 – Tenant Mobile Components

- **9.1 Mobile-optimized components**
  - **9.1.1** Create `src/components/tenant/MobileCard.tsx`:
    - Full-width card with large touch targets.
    - Clear typography (min 16px font size).
    - Adequate spacing (min 16px padding).
    - Shadow/elevation for depth.
  - **9.1.2** Create `src/components/tenant/MobileList.tsx`:
    - Simple list with large items, easy scrolling.
    - Divider between items.
    - Pull-to-refresh support.
  - **9.1.3** Create `src/components/tenant/MobileForm.tsx`:
    - Full-width inputs, large buttons.
    - Mobile keyboard-friendly (proper input types).
    - Form validation with clear error messages.

- **9.2 Tenant-specific pages**
  - **9.2.1** Create `app/tenant/invoices/page.tsx`:
    - List of invoices (mobile cards).
    - Filter by status (paid, unpaid, overdue).
    - Each card: invoice number, amount, due date, status, "View Details" button.
    - Infinite scroll or pagination.
  - **9.2.2** Create `app/tenant/payments/page.tsx`:
    - Payment history list.
    - "Pay Now" button at top (opens payment flow).
    - Each payment: date, amount, method, invoice link, receipt download.
  - **9.2.3** Create `app/tenant/complaints/page.tsx`:
    - List of complaints (submitted by tenant).
    - "Submit Complaint" FAB (floating action button) at bottom right.
    - Each complaint: category, description preview, status badge, date.
    - Tap to view details and track status.
  - **9.2.4** Create `app/tenant/complaints/new/page.tsx`:
    - Mobile form to submit complaint.
    - Fields: category (dropdown), title, description (textarea), photos (camera/gallery).
    - Submit button (large, primary).
  - **9.2.5** Create `app/tenant/lease/page.tsx`:
    - Lease details (mobile-friendly view).
    - Sections: Lease Info, Unit Info, Terms, Charges.
    - Collapsible sections for better mobile UX.
  - **9.2.6** Create `app/tenant/profile/page.tsx`:
    - Profile and settings.
    - Editable fields: name, phone, email, preferred language.
    - Change password section.
    - Logout button.

---

### Step 10 – Mobile UX Enhancements

- **10.1 Mobile-specific features**
  - **10.1.1** Swipe gestures (optional):
    - Swipe right on invoice to pay.
    - Swipe left to view details.
    - Use library like `react-swipeable` or `framer-motion`.
  - **10.1.2** Bottom sheet modals:
    - For actions like "Pay Now", "Submit Complaint".
    - Slides up from bottom, backdrop overlay.
    - Easy to dismiss (swipe down or tap backdrop).
  - **10.1.3** Large, accessible touch targets:
    - Minimum 44x44px for all interactive elements.
    - Adequate spacing between buttons (min 8px).
  - **10.1.4** Optimize for mobile bandwidth:
    - Lazy load images.
    - Compress assets.
    - Use Next.js Image component with optimization.

- **10.2 Progressive Web App (PWA) support**
  - **10.2.1** Create `public/manifest.json`:
    - App name, icons, theme colors, display mode.
    - Start URL, scope.
  - **10.2.2** Create service worker (optional, for offline support):
    - Cache static assets.
    - Offline fallback page.
  - **10.2.3** Add PWA meta tags to `app/layout.tsx`:
    - Theme color, viewport, apple-touch-icon.

- **10.3 Responsive breakpoints**
  - **10.3.1** Mobile-first approach:
    - Design for mobile (320px+), enhance for tablet/desktop.
    - Use Tailwind breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px).
  - **10.3.2** Tenant portal should:
    - Work excellently on mobile (< 768px).
    - Be acceptable on tablet (768px - 1024px).
    - Be functional on desktop (> 1024px) but optimized for mobile.

---

## Implementation Notes

- **Dependencies to install:**
  - `next-themes` (if not already installed) for theme switching.
  - `lucide-react` (if not already installed) for icons.
  - `recharts` or `chart.js` for charts (optional, for ChartCard).
  - `react-swipeable` or `framer-motion` for swipe gestures (optional).

- **Styling:**
  - Use existing UI components from `src/lib/components/ui/` (button, card, etc.).
  - Ensure all components support dark mode (Tailwind `dark:` classes).
  - Follow existing design system/color scheme.

- **Data fetching:**
  - All API calls should use existing auth session and org scoping.
  - Sidebar and topbar should fetch user data from session.
  - Dashboard cards should use React Server Components where possible for data fetching.
  - Use React Query or SWR for client-side data fetching if needed.

- **Performance:**
  - Lazy load dashboard cards that are below the fold.
  - Optimize images and assets.
  - Use Next.js Image component for all images.

- **Accessibility:**
  - Ensure keyboard navigation works in sidebar and topbar.
  - Add ARIA labels for screen readers.
  - Ensure sufficient color contrast.

---

## Exit Criteria

- **Admin/staff routes:**
  - All admin/staff routes use DashboardLayout with collapsible sidebar and topbar.
  - Sidebar shows role-appropriate menu items with icons and labels.
  - Sidebar collapses/expands smoothly and works on mobile as drawer.
  - Topbar includes working search (with dropdown results), notifications (with unread count), profile dropdown, and theme switcher.
  - Dashboard pages display modular cards with loading/error states.
  - Cards are responsive and work in grid layout.

- **Tenant portal:**
  - Tenant portal is mobile-first with bottom navigation and optimized UI.
  - All tenant pages are touch-friendly with large targets.
  - Tenant dashboard shows balance, next due date, and quick actions.
  - Tenant can view invoices, make payments, submit complaints, view lease, and manage profile.
  - Mobile UX enhancements (swipe gestures, bottom sheets) are implemented (optional but recommended).

- **General:**
  - All components are responsive and support light/dark themes.
  - No layout conflicts between admin and tenant portals.
  - Performance is acceptable (lazy loading, optimized assets).

