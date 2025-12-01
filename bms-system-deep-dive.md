## SaaS BMS for Ethiopia – Product and Technical Plan

### 1. Purpose and Vision

This document defines the **SaaS strategy and implementation plan** for an **Enterprise Building Management System (BMS)** tailored to the Ethiopian market. It turns the original proposal into a concrete plan for:

- A **multi-tenant SaaS product** serving many property owners and management companies.
- A **subscription-based business model** with clear tiers and feature sets.
- A **phased delivery roadmap** from MVP to advanced IoT and compliance features.
- A **scalable, secure architecture** that can grow from a modular monolith into separated services.

The target customer base includes commercial, residential, and mixed-use buildings, with strong emphasis on:

- Local payment methods (Telebirr, CBE Birr, Chapa, HelloCash).
- Ethiopian accounting and **ERCA** tax compliance.
- Multi-language support (Amharic, English, Afaan Oromo, Tigrigna).
- Resilience to weak/unstable connectivity.

---

### 2. SaaS Product Strategy

#### 2.1 Target Segments

- **Small to mid-size property managers**: 1–10 buildings; need basic automation (rent, complaints, maintenance) and payment integrations.
- **Enterprise real estate and facility managers**: 10+ buildings; need portfolio analytics, integration with ERPs, deeper compliance and IoT features.
- **Specialized segments** (later): co-working spaces, mixed-use complexes with advanced parking and access control.

#### 2.2 Value Proposition (SaaS Lens)

- **One cloud platform** to run all building operations (finance, maintenance, utilities, security, communication).
- **No on-premise infrastructure**; updates and improvements shipped centrally.
- **Pay-as-you-grow** pricing based on number of buildings/units and advanced modules used.
- **Local-first**: optimized for Ethiopian payment rails and regulations, with language and connectivity constraints baked in.

#### 2.3 Pricing and Packaging (Draft)

This is a working model for go-to-market; exact numbers are TBD.

- **Tier 1 – Starter**
  - Target: Small property managers (up to X buildings / Y units).
  - Features:
    - Core modules: Building Admin, Tenant & Lease, basic Billing & Payments, Complaints, basic Maintenance.
    - Single organization, limited number of staff users.
    - Limited reporting.

- **Tier 2 – Growth**
  - Target: Mid-size managers with growing portfolios.
  - Includes Starter plus:
    - Advanced Maintenance (preventive schedules).
    - Utilities (manual readings + alerts).
    - Parking & Vehicle management.
    - Better analytics and exportable reports.
    - Priority support.

- **Tier 3 – Enterprise**
  - Target: Large firms and REITs.
  - Includes Growth plus:
    - Advanced reporting and ERCA-focused exports.
    - Integrations (ERP, HR, IoT gateways).
    - Advanced Security & Access (QR/RFID integration – phased).
    - Custom SLAs, dedicated support, and optional private deployments.

Pricing axes:

- Number of **organizations** and **buildings**.
- Number of **units/tenants** managed.
- Optional add-ons (IoT integration, ERCA/API integration, advanced analytics).

#### 2.4 SaaS Operational Model

- **Single global platform** deployed in at least one Ethiopian-friendly region (data residency to be considered).
- **Multi-tenant** at the database level (with tenant isolation via `organization_id` and strict RBAC).
- Centralized release management: versioned APIs, feature flags for gradual rollout.
- Support and operations:
  - Monitoring and alerting for uptime, errors, payment integration health.
  - Support channels (email, in-app chat, phone for enterprise).

---

### 3. Stakeholders, Personas, and Roles

#### 3.1 Personas (Ethiopian context)

- **Building Owner / Investor**
  - Needs: Portfolio-level visibility (ETB), profit and cost trends, energy and occupancy KPIs, ERCA-ready financial reports.
  - Pain points: Fragmented spreadsheets, delayed reporting, hidden energy waste, tenant churn.

- **Property Manager / Organization Admin**
  - Needs: Smooth operations across buildings, high occupancy, timely rent collection, fast complaint resolution, compliance.
  - Pain points: Manual rent tracking, juggling Telebirr/CBE Birr/Chapa, poor tenant communication.

- **Building Manager**
  - Needs: Clear view of building status (occupancy, arrears, complaints, maintenance) and tools to act.
  - Pain points: Paper-based workflows, no centralized history, ad‑hoc communication.

- **Facility Manager**
  - Needs: Preventive maintenance planning, work-order tracking, asset health visibility, utility usage monitoring.
  - Pain points: Reactive fixes, no asset history, no meter-based insights into leaks or overuse.

- **Accountant / Finance Officer**
  - Needs: Accurate invoicing, automated payment reconciliation from Telebirr/CBE Birr/Chapa/HelloCash, ERCA-compliant reports.
  - Pain points: Time-consuming reconciliation, disputes over payment status, manual tax prep.

- **Maintenance Technician**
  - Needs: Clear, prioritized tasks on mobile, asset details, easy status updates and notes.
  - Pain points: Vague tickets, lack of context, no visibility into priorities and SLAs.

- **Security Supervisor / Guard**
  - Needs: Visitor and incident logging, basic parking control, quick tenant lookup.
  - Pain points: Paper logbooks, no centralized history, no easy blacklist/watchlist.

- **Tenant (Residential / Commercial)**
  - Needs: Easy local payments (Telebirr, CBE Birr, Chapa, HelloCash), transparent billing, complaint tracking, localized language UI.
  - Pain points: Office visits for payment, unclear balances, unresolved complaints, language barriers (Amharic, Afaan Oromo, Tigrigna).

- **Visitor**
  - Needs: Fast check‑in and parking.
  - Pain points: Long queues, unclear rules.

- **Vendor / Service Provider**
  - Needs: Reliable payment pipeline and clear service expectations.
  - Pain points: Lost paperwork, delayed approvals.

- **Auditor / Investor Representative**
  - Needs: Read‑only access to reports and logs for verification.
  - Pain points: Scattered or incomplete records.

- **Regulator (ERCA, fire safety, municipality)**
  - Needs: Accurate, timely reporting and evidence of compliance.
  - Pain points: Informal/unstructured submissions, lack of standardized records.

#### 3.2 Roles and RBAC (high level)

- **Super Admin (Platform provider)**  
  Manages global configuration, organizations, high-level monitoring.

- **Organization Admin (Owner/Management Company Admin)**  
  Manages buildings, staff, roles, payment integrations, and global settings for their organization.

- **Building Manager**  
  Manages a specific building: units, tenants, leases, complaints, local staff, notices.

- **Facility Manager**  
  Manages assets, meters, preventive schedules, work orders, technicians.

- **Accountant**  
  Manages invoices, payments, vendor bills, reconciliations, financial and tax reports.

- **Security Supervisor / Guard**  
  Manages visitor logs, incidents, basic parking operations, and gate records.

- **Maintenance Technician**  
  Executes work orders and logs maintenance activities.

- **Tenant User**  
  Manages their own lease, payments, complaints, vehicles, and visitor codes (future).

- **Auditor / Read-only Analyst**  
  Read-only access to selected reports and audit logs.

#### 3.3 RBAC by Module (summary)

- **Building Administration**  
  Organization Admin: full CRUD; Building Manager: building-level CRUD; others: read-only.
- **Tenant & Lease Management**  
  Organization Admin and Building Manager: CRUD; Accountant: read; Tenant: read own.
- **Financial & Accounting**  
  Accountant: full; Org Admin: full/view; Building Manager: limited view; Tenant: own; Auditor: read.
- **Utilities & Energy**  
  Facility Manager: full; Building Manager: view; Org Admin: aggregate; Tenant: own unit (where metered).
- **Maintenance**  
  Facility Manager: full; Building Manager: raise/monitor; Technician: update assigned; Tenant: create/track own requests.
- **Security & Access**  
  Security Supervisor: full; Guard: operational actions; Building Manager/Org Admin: view.
- **Parking & Vehicles**  
  Building Manager/Security Supervisor: configure/assign; Guard: log; Tenant: manage own vehicles.
- **Communication & Notifications**  
  Org Admin/Building Manager: broadcast; System: automated; Tenant/User: receive.
- **Compliance & Reporting**  
  Org Admin/Accountant: generate; Building Manager: view building; Auditor: read.

---

### 4. SaaS-Oriented Module Capabilities (MVP vs Future)

This section keeps the original modules but interprets them explicitly as **SaaS features** offered in different tiers and phases.

#### 4.1 Building Administration

- **MVP**
  - Create and configure organizations and buildings.
  - Define building attributes (location, type, floors, units).
  - Create staff users and assign roles per building.
  - Portfolio and building dashboards (occupancy, arrears, open complaints, maintenance backlog).
- **Future**
  - SLA configuration per building and SLA monitoring.
  - Custom approval workflows per building.

#### 4.2 Tenant & Lease Management

- **MVP**
  - Tenant registration with contact info and preferred language.
  - Lease creation linking tenant to unit, with rent, service charge, deposit, cycle.
  - Upload or template-based lease documents.
  - Automatic recurring invoice generation from leases.
  - Tenant portal to view lease, balances, download receipts.
  - Lease termination and final settlement handling.
- **Future**
  - Digital signatures for leases.
  - Tenant-initiated renewal or upgrade requests.
  - Complex pricing (step-up, discounts) and multi-currency.

#### 4.3 Financial & Accounting

- **MVP**
  - Scheduled rent invoice generation for active leases.
  - Ad-hoc invoices (maintenance, penalties, parking).
  - Local payment integrations: Telebirr, CBE Birr, Chapa, HelloCash.
  - Payment reconciliation via provider callbacks and references.
  - Arrears/aging reports by tenant and building.
  - Vendor invoice recording and payment tracking.
  - Financial reporting (income, expenses, basic balance/summary) with ERCA-friendly exports.
- **Future**
  - Direct ERCA e-invoicing/integration.
  - Profitability by building/portfolio.
  - Full ERP integration.

#### 4.4 Utility & Energy Management

- **MVP**
  - Meter registration (electricity, water, gas) at building/unit/asset level.
  - Manual entry or import of meter readings.
  - Consumption and cost calculation by period.
  - Threshold-based alerts for abnormal usage.
  - Tenant visibility into unit-level consumption where applicable.
- **Future**
  - Live IoT integrations for meters.
  - Automated energy-anomaly detection and recommendations.
  - Cross-building efficiency benchmarking.

#### 4.5 Maintenance Management

- **MVP**
  - Asset registration with key technical and cost data.
  - Preventive maintenance schedules for critical assets.
  - Complaint-based maintenance requests from tenants/building managers.
  - Work-order creation, assignment, prioritization, and tracking.
  - Technician mobile workflow with status updates and notes/photos.
  - Maintenance history per asset and unit.
- **Future**
  - Predictive maintenance using IoT data.
  - Spare parts inventory management and re-order.

#### 4.6 Security & Access Control

- **MVP**
  - Security staff registration and shift management (basic).
  - Visitor registration at entry (identity, contact, host, purpose).
  - Incident logging with descriptions and attachments.
  - Visitor and incident reporting per building.
- **Future**
  - Tenant-generated visitor QR codes.
  - Integration with RFID/QR gates and access devices.
  - CCTV integration and event tagging.

#### 4.7 Parking & Vehicle Management

- **MVP**
  - Parking space configuration (tenant vs visitor).
  - Tenant vehicle registration.
  - Visitor parking assignment and entry/exit logs.
  - Parking utilization and violation reporting (manually logged).
- **Future**
  - Visitor parking QR codes with time windows.
  - Automated gates and ANPR integration.

#### 4.8 Facility & Asset Management

- **MVP**
  - Asset registry (equipment, furniture, infrastructure).
  - Asset linkage to maintenance history and work orders.
  - Basic depreciation tracking and linkage to financials.
- **Future**
  - Full lifecycle tracking (procurement → disposal).
  - Deep ERP asset accounting integration.

#### 4.9 Communication & Notifications

- **MVP**
  - Digital notice board per building.
  - In-app and SMS/email notifications for payment reminders and maintenance status updates.
  - Multi-language messages (Amharic, English, Afaan Oromo, Tigrigna where relevant).
- **Future**
  - Targeted communication by segment (floor, tenant type).
  - Automated escalations for overdue issues.

#### 4.10 Compliance & Reporting

- **MVP**
  - Standardized financial reports consistent with Ethiopian practice.
  - Compliance checklists (fire drills, extinguisher checks, elevator inspections) with status tracking.
  - Exportable audit and investor reports (CSV/PDF).
- **Future**
  - ERCA-specific report generation and potential direct submissions.
  - Automated alerts for overdue compliance tasks.

#### 4.11 Integrations & Expansion

- **MVP**
  - Payment gateway configuration for Telebirr, CBE Birr, Chapa, HelloCash.
  - Payment callback handling and invoice reconciliation.
  - CSV/Excel exports to external accounting systems.
- **Future**
  - ERP and HR system integrations.
  - IoT platforms for meters, locks, sensors.

#### 4.12 Mobile App (Web/PWA + Native)

- **MVP**
  - Phone/OTP-based login for tenants.
  - Tenant views invoices, pays via local methods, sees receipts.
  - Complaint submission and status tracking.
  - Notices and emergency alerts.
  - Language switching (Amharic, English, Afaan Oromo, Tigrigna).
- **Future**
  - Technician and guard modes for operational staff.
  - Visitor/parking QR management by tenants.

---

### 5. End-to-End Workflows (SaaS Flows)

These workflows are critical flows we will implement and optimize across customers; they are central to onboarding, adoption, and retention.

#### 5.1 Tenant Onboarding and Lease Creation

1. Org Admin/Building Manager configures building, units, rent/service charge templates.
2. Building Manager captures tenant info and preferred language; creates tenant record.
3. Building Manager creates lease (unit, rent, charges, deposit, cycle, dates).
4. System generates lease record and links to tenant and unit.
5. Lease document is uploaded or generated from template and manually/digitally signed.
6. Tenant receives SMS/app invite and logs in.
7. Next billing cycle triggers first invoice; tenant sees balance and due date.

#### 5.2 Recurring Rent Invoicing and Local Payment

1. Scheduler generates invoices for due leases.
2. Tenants receive notifications (app/SMS/email) with invoice details and payment options.
3. Tenant opens app and selects payment method (Telebirr, CBE Birr, Chapa, HelloCash).
4. Payment is processed via provider flow.
5. Payment provider sends callback/webhook with transaction details.
6. System matches payment reference to invoice, updates status, and records payment.
7. Tenant sees updated balance and digital receipt; Accountant sees updated reports.
8. Data is included in ERCA-compatible exports.

#### 5.3 Complaint Submission and Resolution

1. Tenant submits complaint in app (category, description, photo, preferred time).
2. System creates ticket linked to tenant, unit, and building.
3. Building Manager/Facility Manager reviews and either resolves quickly or creates a work order.
4. Work order is assigned to Technician with priority and due date.
5. Technician visits site, updates status (“In progress”, “Resolved”), adds notes/photos.
6. System sends status updates to tenant.
7. Tenant confirms resolution or reopens complaint (optional).
8. Ticket and work order history are stored for analytics and asset history.

#### 5.4 Preventive Maintenance Lifecycle

1. Facility Manager registers assets and defines PM schedules (time or usage-based).
2. System generates future PM tasks and marks upcoming tasks.
3. When due, tasks are assigned to technicians.
4. Technicians perform maintenance and log work, parts, and time.
5. System stores maintenance history and calculates next due dates.
6. Facility Manager monitors completion and overdue tasks; Owner sees reliability summary.

#### 5.5 Utility Consumption Monitoring and Alerting

1. Facility Manager sets up meters with thresholds.
2. Meter readings are collected (manual or IoT in later phase).
3. System calculates consumption vs previous periods and thresholds.
4. Abnormal spikes trigger alerts to Facility Manager and Building Manager.
5. Investigation may create maintenance work orders.
6. Utility charges feed into tenant or building-level invoicing where applicable.

#### 5.6 Visitor Management and Parking

1. Security Supervisor configures parking spaces and rules.
2. Visitor arrives:
   - MVP: Guard registers visitor details, host, vehicle, and assigns parking slot.
   - Future: Visitor presents QR code generated by tenant; system validates and auto-logs entry.
3. System logs entry time, host unit, vehicle, and parking allocation.
4. On exit, guard logs departure; parking and visitor history are updated.
5. Building Manager/Security Supervisor analyze visitor and parking patterns.

---

### 6. Domain Model Sketch (Multi-Tenant)

Core entities (simplified):

- **Organization**: groups buildings and users; has `tin_number`, legal name, address.
- **Building**: belongs to Organization; has many Units, Meters, Assets, ParkingSpaces, WorkOrders, Complaints, VisitorLogs.
- **Unit**: belongs to Building; has many Leases, Complaints, Meters; linked to ParkingSpaces.
- **Tenant**: has many Leases, Payments, Complaints, Vehicles, VisitorInvites; has `primary_phone`, `national_id`, `language`.
- **Lease**: belongs to Tenant and Unit; has many Invoices; tracks rent, charges, deposit, cycle, status.
- **Invoice**: belongs to Lease (or building-level account); has many Payments; includes ERCA-related attributes (future).
- **Payment**: belongs to Invoice; stores amount, provider (Telebirr, CBE Birr, Chapa, HelloCash, etc.), provider reference, status, timestamps.
- **User**: belongs to Organization; linked to roles and optionally Tenant or staff profiles; holds auth data and language.
- **Role & Permission**: defines access per module/action; associated with Users and optionally Buildings.
- **Complaint/Ticket**: belongs to Tenant, Unit, Building; may link to WorkOrder.
- **WorkOrder**: belongs to Building; can link to Unit and Asset; assigned to Technician; tracks type, status, priority, logs.
- **Asset**: belongs to Building (and optionally Unit); has maintenance and depreciation info; links to WorkOrders and MaintenanceHistory.
- **MaintenanceHistory**: links Asset and WorkOrder; logs work performed and parts used.
- **Meter**: belongs to Building/Unit/Asset; tracks type, meter number, IoT details; has many MeterReadings.
- **MeterReading**: belongs to Meter; logs reading value, timestamp, and source.
- **ParkingSpace**: belongs to Building; type (tenant/visitor), allocation and status.
- **Vehicle**: belongs to Tenant; includes plate, make, color.
- **VisitorInvite** (future): belongs to Tenant; includes guest details, validity window, QR code.
- **VisitorLog**: belongs to Building; logs visitor identity, host, vehicle, entry/exit.
- **Notification**: belongs to User/Tenant; type, content, channels, delivery status.
- **TaxReport/ComplianceRecord**: belongs to Organization/Building; period, type (ERCA, fire, inspection), status, exported file.

Ethiopia-specific attributes are embedded where needed (TIN, ERCA references, local payment references, language).

---

### 7. Architecture Overview (SaaS)

#### 7.1 Architectural Style

- **Modular monolith** backend for MVP with clear domain modules:
  - Tenant & Lease Management
  - Billing & Accounting
  - Maintenance & Assets
  - Utilities
  - Security & Access
  - Communication & Notifications
  - Compliance & Reporting
- Future microservices can be carved out along these module boundaries as scale and complexity increase.

#### 7.2 Layers

- **Presentation**
  - Web front-end for management and staff.
  - Mobile/PWA front-end for tenants, technicians, guards.
- **API**
  - REST (optionally GraphQL for dashboards), JWT/OAuth2 security, tenant-aware routes.
- **Domain/Service**
  - Encapsulates business rules: leasing, billing, arrears, complaint flows, maintenance scheduling, notification logic.
- **Persistence**
  - Relational database (e.g., PostgreSQL) with tenant-aware schema (Organization ID on all relevant tables).
  - Future: separate store for time-series IoT data if needed.
- **Integrations**
  - Payment integration modules for Telebirr, CBE Birr, Chapa, HelloCash.
  - Webhook/callback handlers with idempotency and retry.
  - Future connectors for ERCA, ERP, and IoT gateways.
  - Message queue/event bus for async operations (payments, notifications, IoT events).

#### 7.3 Cross-cutting Concerns

- **Security & RBAC**
  - Role-based access control enforced at API and UI; per-organization and per-building scoping.
  - Strong authentication (phone/OTP for tenants, password + 2FA optional for staff).
- **Auditability**
  - Audit logs for key actions (financial changes, access/security operations, configuration changes).
- **Reliability**
  - Idempotent payment processing, webhook retry, background jobs for scheduled tasks.
- **Offline & Connectivity**
  - Mobile app with local caching and queued actions (complaints, work-order updates) for later sync.
  - SMS fallbacks for critical notifications (payment due, emergencies).
- **Internationalization**
  - Multi-language UI content and notifications with locale-aware formatting.

---

### 8. Delivery Roadmap (High-Level)

This roadmap is a **product and engineering plan**, not a strict project schedule. Timelines depend on team size and budget.

#### 8.1 Phase 1 – MVP (Core SaaS)

- Multi-tenant platform with:
  - Organizations, buildings, units, roles, and users.
  - Tenant & Lease Management.
  - Core Billing & Accounting with Telebirr/CBE Birr/Chapa/HelloCash integrations.
  - Complaints and basic Maintenance (reactive + simple PM).
  - Basic reports and ERCA-friendly exports.
  - Tenant web/PWA app with local payments, complaints, and notices.

Success metrics:

- Onboard first paying customers (1–3 organizations, 5–10 buildings).
- At least X% of rent collected digitally.
- Reduction in complaint resolution time for pilot customers.

#### 8.2 Phase 2 – Growth and Operations

- Utilities module (manual readings + alerts).
- Richer Maintenance & Assets (PM schedules, history).
- Parking & Vehicle management.
- Better analytics dashboards and exports.
- Technician and guard mobile flows.
- More robust RBAC, audit logs, and organizational controls.

Success metrics:

- Increased number of active organizations and buildings.
- Measurable reduction in energy costs and maintenance downtime.

#### 8.3 Phase 3 – Enterprise and IoT

- IoT integrations: smart meters and basic device telemetry.
- Advanced Security & Access (QR/RFID integrations, visitor QR flows).
- Deeper ERCA integration (API-based, where feasible).
- ERP and HR integrations for large customers.
- Optional service extraction from the modular monolith (e.g., billing, IoT ingestion) where scale requires.

Success metrics:

- Enterprise contracts signed (multi-year deals).
- Stable platform under higher load with IoT data streams.
- Strong NPS and retention among enterprise customers.

---

This SaaS plan, requirements, and architecture overview will guide detailed backlog creation, sprint planning, UI/UX design, and implementation for the Ethiopian BMS platform. It should be evolved as we learn from early customers and pilots.
