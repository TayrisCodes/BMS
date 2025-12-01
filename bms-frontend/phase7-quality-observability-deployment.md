## Phase 7 – Quality, Observability, and Deployment Readiness (Detailed Plan)

### Goals

- Implement comprehensive testing strategy (unit tests, API tests, integration tests).
- Set up structured logging and observability (metrics, health checks, error tracking).
- Harden security (input validation, org scoping review, authentication audit).
- Create production deployment plan with containerization and hosting strategy.

### Current State Analysis

**✅ Already Implemented:**

- Docker setup: `docker-compose.yml` with MongoDB and web services.
- Dockerfile: Multi-stage build for Next.js app.
- Basic health check: `/api/health` endpoint.
- ESLint and Prettier: Code quality tools configured.

**❌ Needs Implementation:**

- Testing framework and test infrastructure.
- Unit tests for domain logic.
- API/integration tests for critical flows.
- Structured logging system.
- Metrics collection and monitoring.
- Enhanced health checks.
- Security audit and hardening.
- Production Docker configuration.
- Deployment documentation and CI/CD setup.

---

### Step 1 – Set Up Testing Infrastructure

- **1.1 Install testing dependencies**
  - **1.1.1** Install testing frameworks:
    - `npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event`
    - `npm install -D jest-environment-jsdom` (for React component testing).
    - `npm install -D @types/jest` (TypeScript support).
  - **1.1.2** Install API testing tools:
    - `npm install -D supertest @types/supertest` (for API endpoint testing).
    - Or use `node:test` (built-in Node.js test runner) for simpler setup.

- **1.2 Configure Jest**
  - **1.2.1** Create `jest.config.js`:
    - Configure for Next.js App Router.
    - Set up module path aliases (`@/lib/*`, `@/modules/*`).
    - Configure test environment (jsdom for React, node for API tests).
    - Set up coverage collection.
  - **1.2.2** Create `jest.setup.js`:
    - Import `@testing-library/jest-dom` for DOM matchers.
    - Mock Next.js router and other Next.js-specific modules.

- **1.3 Create test utilities**
  - **1.3.1** Create `src/__tests__/utils/test-helpers.ts`:
    - `createMockAuthContext()`: Create mock auth context for testing.
    - `createMockRequest()`: Create mock Next.js Request objects.
    - `createMockResponse()`: Create mock Next.js Response objects.
    - Database test helpers (setup, teardown, seed data).

- **1.4 Set up test database**
  - **1.4.1** Create test database configuration:
    - Use separate MongoDB database for tests (e.g., `bms-test`).
    - Environment variable: `MONGODB_TEST_URI`.
    - Test database cleanup before/after test suites.

- **1.5 Add test scripts**
  - **1.5.1** Update `package.json`:
    - `"test": "jest"`
    - `"test:watch": "jest --watch"`
    - `"test:coverage": "jest --coverage"`
    - `"test:ci": "jest --ci --coverage --maxWorkers=2"`

---

### Step 2 – Unit Tests for Domain Logic

- **2.1 Invoice generation tests**
  - **2.1.1** Create `src/modules/billing/__tests__/invoice-generation.test.ts`:
    - Test `generateInvoicesForLeases()`:
      - Generate invoices for active leases.
      - Skip if invoice already exists for period.
      - Handle partial periods (lease starts mid-cycle).
      - Handle lease termination mid-cycle (proration).
      - Calculate due dates correctly based on `dueDay`.
    - Test edge cases:
      - Multiple leases with different billing cycles.
      - Leases with additional charges.
      - Empty lease list.

- **2.2 RBAC authorization tests**
  - **2.2.1** Create `src/lib/auth/__tests__/authz.test.ts`:
    - Test `isSuperAdmin()`: Returns true for SUPER_ADMIN, false for others.
    - Test `hasOrgRole()`: Returns true for users with required role, false otherwise.
    - Test `requirePermission()`: Throws error for insufficient permissions.
    - Test permission checks for different roles and actions.

- **2.3 Organization scoping tests**
  - **2.3.1** Create `src/lib/organizations/__tests__/scoping.test.ts`:
    - Test `withOrganizationScope()`: Adds organizationId to query.
    - Test `withOptionalOrganizationScope()`: Allows SUPER_ADMIN to query across orgs.
    - Test `validateOrganizationAccess()`: Throws error for cross-org access.
    - Test SUPER_ADMIN bypass behavior.

- **2.4 Consumption calculation tests**
  - **2.4.1** Create `src/modules/utilities/__tests__/consumption.test.ts`:
    - Test `calculateMonthlyConsumption()`: Calculates consumption for a month.
    - Test `calculatePeriodConsumption()`: Calculates for custom period.
    - Test `detectAnomalies()`: Detects consumption spikes.
    - Test edge cases: missing readings, negative consumption (meter reset).

- **2.5 Payment intent tests**
  - **2.5.1** Create `src/modules/payments/__tests__/payment-intent.test.ts`:
    - Test `createPaymentIntent()`: Creates intent with correct metadata.
    - Test `getPaymentIntentStatus()`: Returns correct status.
    - Test `cancelPaymentIntent()`: Cancels pending intents.
    - Test idempotency: prevent duplicate intents.

---

### Step 3 – API Integration Tests

- **3.1 Authentication API tests**
  - **3.1.1** Create `src/__tests__/api/auth.test.ts`:
    - Test `POST /api/auth/login`:
      - Success with valid credentials.
      - Failure with invalid credentials.
      - Failure with non-existent user.
    - Test `POST /api/auth/request-otp`:
      - Success for valid tenant phone.
      - Failure for non-tenant phone.
      - OTP generation and storage.
    - Test `POST /api/auth/verify-otp`:
      - Success with valid OTP.
      - Failure with invalid OTP.
      - Failure with expired OTP.
      - Session creation on success.

- **3.2 Payment API tests**
  - **3.2.1** Create `src/__tests__/api/payments.test.ts`:
    - Test `POST /api/tenant/payments/intent`:
      - Creates payment intent.
      - Validates invoice ownership.
      - Returns redirect URL or instructions.
    - Test `POST /api/webhooks/payments/[provider]`:
      - Processes successful payment webhook.
      - Updates payment intent status.
      - Creates payment record.
      - Updates invoice status.
      - Idempotency (duplicate webhook handling).

- **3.3 Complaints API tests**
  - **3.3.1** Create `src/__tests__/api/complaints.test.ts`:
    - Test `POST /api/tenant/complaints`:
      - Tenant can create complaint.
      - Complaint is scoped to tenant's organization.
      - Photo upload works (if implemented).
    - Test `GET /api/complaints`:
      - Returns only org-scoped complaints.
      - Filters work correctly (status, priority).
    - Test `PATCH /api/complaints/[id]`:
      - Status updates work.
      - Assignment works.
      - RBAC enforced (only authorized roles can update).

- **3.4 Work orders API tests**
  - **3.4.1** Create `src/__tests__/api/work-orders.test.ts`:
    - Test `POST /api/work-orders`:
      - Creates work order with proper org scoping.
      - Links to complaint if provided.
    - Test `PATCH /api/work-orders/[id]/status`:
      - Status transitions work correctly.
      - Technician can only update assigned work orders.
      - Facility manager can update any work order in their org.

- **3.5 Organization scoping tests**
  - **3.5.1** Create `src/__tests__/api/org-scoping.test.ts`:
    - Test cross-organization data access is prevented:
      - User from Org A cannot access Org B's buildings.
      - User from Org A cannot access Org B's tenants.
      - User from Org A cannot access Org B's invoices.
    - Test SUPER_ADMIN can access all organizations (when explicitly allowed).

---

### Step 4 – Structured Logging

- **4.1 Install logging library**
  - **4.1.1** Install structured logging library:
    - Option 1: `npm install pino` (fast, structured JSON logging).
    - Option 2: `npm install winston` (feature-rich, flexible).
    - Recommendation: `pino` for performance and simplicity.

- **4.2 Create logger utility**
  - **4.2.1** Create `src/lib/logger/logger.ts`:
    - Initialize logger with configuration:
      - Log level from environment (`LOG_LEVEL`).
      - Pretty printing in development, JSON in production.
      - Output to stdout (for containerized deployments).
    - Export logger instance with methods: `info()`, `error()`, `warn()`, `debug()`.

- **4.3 Create request logger middleware**
  - **4.3.1** Create `src/lib/logger/request-logger.ts`:
    - Middleware to log all API requests:
      - Request method, path, query params.
      - User ID, organization ID (from session).
      - Response status, response time.
      - Error details (if error occurred).
    - Use structured logging format (JSON).

- **4.4 Update API routes with structured logging**
  - **4.4.1** Replace `console.log()` and `console.error()` with logger:
    - In all API routes, use logger instead of console.
    - Log at appropriate levels:
      - `logger.info()`: Normal operations.
      - `logger.warn()`: Warnings (e.g., missing data, validation issues).
      - `logger.error()`: Errors (with stack traces).
      - `logger.debug()`: Debug information (only in development).
  - **4.4.2** Add request ID for tracing:
    - Generate unique request ID per request.
    - Include in all log entries for that request.
    - Return request ID in error responses (for support).

- **4.5 Log sensitive data handling**
  - **4.5.1** Create logging guidelines:
    - Never log passwords, tokens, or payment card numbers.
    - Redact sensitive fields in logs (e.g., `passwordHash`, `apiKey`).
    - Log user actions for audit trail (who did what, when).

---

### Step 5 – Metrics and Monitoring

- **5.1 Create metrics collection**
  - **5.1.1** Create `src/lib/metrics/metrics.ts`:
    - Track metrics:
      - Request count by endpoint.
      - Request duration by endpoint.
      - Error count by endpoint and error type.
      - Database query count and duration.
      - Payment processing success/failure rates.
    - Use simple in-memory counters or integrate with metrics service (Prometheus, DataDog, etc.).

- **5.2 Create metrics API endpoint**
  - **5.2.1** Create `app/api/metrics/route.ts`:
    - `GET`: Return current metrics (protected, SUPER_ADMIN only or internal use).
    - Return metrics in Prometheus format (if using Prometheus) or JSON.
    - Include: request rates, error rates, response times, database health.

- **5.3 Enhanced health check**
  - **5.3.1** Update `app/api/health/route.ts`:
    - Check database connectivity.
    - Check database response time.
    - Check disk space (if applicable).
    - Return detailed health status:
      ```typescript
      {
        status: "healthy" | "degraded" | "unhealthy",
        checks: {
          database: { status: "ok" | "error", responseTime: number },
          disk: { status: "ok" | "error", freeSpace: number },
        },
        timestamp: Date,
        version: string,
      }
      ```

- **5.4 Error tracking (optional)**
  - **5.4.1** Integrate error tracking service (optional for MVP):
    - Options: Sentry, Rollbar, or similar.
    - Capture unhandled errors and exceptions.
    - Send error reports with context (user, organization, request details).
    - For MVP, can be added later if needed.

---

### Step 6 – Security Hardening

- **6.1 Input validation review**
  - **6.1.1** Review all API routes for input validation:
    - Use validation library: `npm install zod` (recommended) or `joi`.
    - Create validation schemas for all API inputs.
    - Validate:
      - Request body (JSON).
      - Query parameters.
      - URL parameters.
      - File uploads (type, size).
  - **6.1.2** Create validation utilities:
    - `src/lib/validation/schemas.ts`: Define Zod schemas for common entities.
    - `src/lib/validation/validate.ts`: Validation middleware/helpers.

- **6.2 SQL/NoSQL injection prevention**
  - **6.2.1** Review all database queries:
    - Ensure all queries use parameterized queries (MongoDB driver handles this).
    - Never concatenate user input into query strings.
    - Use MongoDB operators safely (`$eq`, `$gt`, etc., not string interpolation).

- **6.3 XSS prevention**
  - **6.2.1** Review frontend code:
    - Ensure React automatically escapes content (it does by default).
    - Sanitize user-generated content before rendering.
    - Use `dangerouslySetInnerHTML` only when necessary and with sanitization.

- **6.4 CSRF protection**
  - **6.4.1** Review CSRF protection:
    - Next.js provides CSRF protection for API routes by default.
    - Ensure all state-changing operations (POST, PATCH, DELETE) are protected.
    - Verify SameSite cookie settings for session cookies.

- **6.5 Organization scoping audit**
  - **6.5.1** Audit all API routes:
    - Ensure every multi-tenant query uses `withOrganizationScope()`.
    - Test that users cannot access other organizations' data.
    - Document any exceptions (SUPER_ADMIN cross-org access).
  - **6.5.2** Create security test suite:
    - Automated tests to verify org scoping.
    - Test cross-org access attempts fail.

- **6.6 Authentication and session security**
  - **6.6.1** Review authentication implementation:
    - Verify JWT signing key is strong and stored securely.
    - Verify HttpOnly cookies are used for session storage.
    - Verify session expiration is reasonable (e.g., 7 days, configurable).
    - Verify password hashing uses secure algorithm (bcrypt with sufficient rounds).
  - **6.6.2** Review OTP implementation:
    - Verify OTP codes are sufficiently random.
    - Verify OTP expiration is short (e.g., 5-10 minutes).
    - Verify OTP codes are single-use (consumed after verification).

- **6.7 Rate limiting**
  - **6.7.1** Implement rate limiting:
    - Install: `npm install express-rate-limit` or use Next.js middleware.
    - Apply to:
      - Login endpoints (prevent brute force).
      - OTP request endpoints (prevent abuse).
      - Payment endpoints (prevent duplicate payments).
      - API endpoints in general (prevent abuse).
    - Configure limits per endpoint (e.g., 5 login attempts per 15 minutes).

- **6.8 Security headers**
  - **6.8.1** Configure security headers:
    - Update `next.config.mjs` or middleware:
      - `X-Content-Type-Options: nosniff`
      - `X-Frame-Options: DENY`
      - `X-XSS-Protection: 1; mode=block`
      - `Strict-Transport-Security` (HSTS, for HTTPS).
      - `Content-Security-Policy` (CSP, if needed).

---

### Step 7 – Production Docker Configuration

- **7.1 Update Dockerfile for production**
  - **7.1.1** Update `bms-frontend/Dockerfile`:
    - Add production build stage:

      ```dockerfile
      FROM base AS builder
      COPY --from=deps /app/node_modules ./node_modules
      COPY . .
      RUN npm run build

      FROM base AS runner
      ENV NODE_ENV=production
      WORKDIR /app
      COPY --from=builder /app/.next/standalone ./
      COPY --from=builder /app/.next/static ./.next/static
      COPY --from=builder /app/public ./public
      EXPOSE 3000
      CMD ["node", "server.js"]
      ```

    - Optimize for production:
      - Use `next build --standalone` for smaller image.
      - Remove dev dependencies.
      - Use Alpine base image for smaller size.

- **7.2 Update docker-compose for production**
  - **7.2.1** Create `docker-compose.prod.yml`:
    - Production configuration:
      - Use production Dockerfile.
      - Set `NODE_ENV=production`.
      - Configure MongoDB with proper authentication.
      - Add health checks for services.
      - Configure restart policies.
      - Set resource limits (CPU, memory).

- **7.3 Environment variables management**
  - **7.3.1** Create `.env.production.example`:
    - Template with all required environment variables.
    - Document each variable's purpose.
    - Mark sensitive variables (secrets, API keys).
  - **7.3.2** Document environment setup:
    - Create `DEPLOYMENT.md` with:
      - Required environment variables.
      - How to set up MongoDB (managed vs self-hosted).
      - How to configure payment providers.
      - How to configure email/SMS providers.

---

### Step 8 – Deployment Strategy

- **8.1 Choose hosting platform**
  - **8.1.1** Evaluate hosting options:
    - **Option 1: Vercel + MongoDB Atlas**
      - Pros: Easy Next.js deployment, managed MongoDB, automatic scaling.
      - Cons: Vendor lock-in, cost at scale.
    - **Option 2: Container platform (DigitalOcean App Platform, Railway, Render)**
      - Pros: More control, can use any database, flexible.
      - Cons: More setup required.
    - **Option 3: Self-hosted (VPS with Docker)**
      - Pros: Full control, cost-effective.
      - Cons: Requires DevOps expertise, maintenance overhead.
  - **8.1.2** Document chosen approach and rationale.

- **8.2 Database hosting**
  - **8.2.1** Choose MongoDB hosting:
    - **Option 1: MongoDB Atlas** (managed)
      - Pros: Automatic backups, scaling, monitoring.
      - Cons: Cost, data residency considerations.
    - **Option 2: Self-hosted MongoDB**
      - Pros: Full control, cost-effective.
      - Cons: Requires maintenance, backups, monitoring.
  - **8.2.2** Document database setup:
    - Connection string format.
    - Backup strategy.
    - Disaster recovery plan.

- **8.3 CI/CD pipeline (optional for MVP)**
  - **8.3.1** Set up basic CI/CD:
    - Use GitHub Actions, GitLab CI, or similar.
    - Pipeline steps:
      - Run tests (`npm test`).
      - Run linter (`npm run lint`).
      - Build Docker image.
      - Deploy to staging/production.
    - For MVP, manual deployment is acceptable.

- **8.4 Deployment documentation**
  - **8.4.1** Create `DEPLOYMENT.md`:
    - Prerequisites (Node.js version, Docker, etc.).
    - Local development setup.
    - Production deployment steps.
    - Environment variables configuration.
    - Database migration strategy (if needed).
    - Rollback procedure.
    - Monitoring and alerting setup.

---

### Step 9 – Performance Optimization

- **9.1 Database query optimization**
  - **9.1.1** Review and optimize slow queries:
    - Ensure all frequently queried fields are indexed.
    - Use MongoDB `explain()` to analyze query performance.
    - Add compound indexes for common query patterns.
    - Limit result sets with pagination.

- **9.2 API response optimization**
  - **9.2.1** Implement response caching where appropriate:
    - Cache dashboard stats (with TTL).
    - Cache organization data (with invalidation on update).
    - Use Next.js caching for static/semi-static data.

- **9.3 Frontend optimization**
  - **9.3.1** Review and optimize:
    - Code splitting (Next.js does this automatically).
    - Image optimization (use Next.js Image component).
    - Bundle size analysis (use `@next/bundle-analyzer`).
    - Lazy loading for heavy components.

---

### Step 10 – Documentation

- **10.1 API documentation**
  - **10.1.1** Create API documentation:
    - Document all API endpoints:
      - Method, path, description.
      - Request parameters (query, body, path).
      - Response format.
      - Authentication requirements.
      - Example requests/responses.
    - Use OpenAPI/Swagger (optional) or markdown documentation.

- **10.2 Architecture documentation**
  - **10.2.1** Create `ARCHITECTURE.md`:
    - System architecture overview.
    - Database schema and relationships.
    - Authentication and authorization flow.
    - Multi-tenancy implementation.
    - Key design decisions and rationale.

- **10.3 Runbook**
  - **10.3.1** Create `RUNBOOK.md`:
    - Common operational tasks:
      - How to restart services.
      - How to view logs.
      - How to check system health.
      - How to handle common errors.
      - How to perform backups.
      - How to restore from backup.

---

### Step 11 – Phase 7 Exit Criteria

- **11.1 Testing**
  - ✅ Unit tests cover critical domain logic (invoice generation, RBAC, consumption calculations).
  - ✅ API tests cover critical flows (auth, payments, complaints, work orders).
  - ✅ Test coverage is > 70% for critical modules.
  - ✅ All tests pass in CI/CD pipeline.

- **11.2 Observability**
  - ✅ Structured logging is implemented in all API routes.
  - ✅ Health check endpoint returns detailed status.
  - ✅ Metrics are collected (request rates, error rates, response times).
  - ✅ Logs are searchable and include request IDs for tracing.

- **11.3 Security**
  - ✅ Input validation is implemented for all API endpoints.
  - ✅ Organization scoping is enforced and tested.
  - ✅ Authentication and session security is reviewed and hardened.
  - ✅ Rate limiting is implemented for sensitive endpoints.
  - ✅ Security headers are configured.

- **11.4 Deployment**
  - ✅ Production Docker configuration is ready.
  - ✅ Deployment documentation is complete.
  - ✅ Environment variables are documented.
  - ✅ Database hosting strategy is defined.
  - ✅ Deployment process is tested (at least in staging).

---

## Implementation Notes

- **Testing Strategy:**
  - Start with critical paths (auth, payments, org scoping).
  - Add tests incrementally as code is written.
  - Aim for >70% coverage on critical modules, >50% overall.
  - Use test-driven development (TDD) for new features when possible.

- **Logging:**
  - Use structured logging (JSON) for easy parsing and analysis.
  - Include context in logs (user ID, organization ID, request ID).
  - Set appropriate log levels (don't log debug in production).
  - Consider log aggregation service (e.g., Logtail, Datadog) for production.

- **Security:**
  - Regular security audits (at least before production launch).
  - Keep dependencies updated (use `npm audit`).
  - Follow OWASP Top 10 guidelines.
  - Consider security scanning tools (Snyk, Dependabot).

- **Performance:**
  - Monitor database query performance.
  - Use database connection pooling.
  - Implement caching where appropriate.
  - Monitor API response times.

- **Deployment:**
  - Start with staging environment before production.
  - Use blue-green deployment or canary releases if possible.
  - Have rollback plan ready.
  - Monitor deployment for errors.

---

## Dependencies to Install

- Testing:
  - `npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest`
  - `npm install -D supertest @types/supertest` (for API testing).
- Logging:
  - `npm install pino` or `npm install winston`.
- Validation:
  - `npm install zod` (recommended) or `npm install joi`.
- Rate limiting:
  - `npm install express-rate-limit` or use Next.js middleware.
- Bundle analysis:
  - `npm install -D @next/bundle-analyzer`.

---

## Environment Variables for Production

```env
# Application
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-domain.com
PORT=3000

# Database
MONGODB_URI=mongodb://user:password@host:port/database?authSource=admin

# Security
JWT_SECRET=strong-random-secret-key
SESSION_SECRET=strong-random-secret-key

# Logging
LOG_LEVEL=info

# Payment Providers (from Phase 6)
TELEBIRR_API_KEY=
TELEBIRR_API_SECRET=
# ... (other payment provider configs)

# Email/SMS (from Phase 6)
EMAIL_API_KEY=
SMS_API_KEY=
# ... (other notification configs)
```

---

## Production Checklist

- [ ] All tests pass.
- [ ] Code is linted and formatted.
- [ ] Environment variables are configured.
- [ ] Database is set up and accessible.
- [ ] Health check endpoint returns healthy.
- [ ] Logging is working and logs are accessible.
- [ ] Security headers are configured.
- [ ] Rate limiting is enabled.
- [ ] Backup strategy is in place.
- [ ] Monitoring and alerting are configured.
- [ ] Deployment documentation is complete.
- [ ] Rollback procedure is documented and tested.
