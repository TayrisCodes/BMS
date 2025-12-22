## Phase 1 – Project & Infrastructure Setup (Detailed Plan)

---

### 1. Repository & Next.js Project Scaffolding

- **1.1 Create Git repository**
  - **1.1.1** Create project directory and initialize git:
    - `mkdir -p /home/blih/BMS && cd /home/blih/BMS`
    - `git init`
  - **1.1.2** Create a basic `.gitignore`:
    - Ignore `node_modules`, `.next`, `dist`, `.env*`, `coverage`, `logs`, `*.log`, `Dockerfile*` build artifacts.

- **1.2 Scaffold Next.js (App Router + TypeScript)**
  - **1.2.1** Scaffold the app:
    - `npx create-next-app@latest bms-frontend --typescript --eslint --src-dir --app`
  - **1.2.2** Move into the app folder:
    - `cd /home/blih/BMS/bms-frontend`
  - **1.2.3** Verify the project runs:
    - `npm run dev` and open `http://localhost:3000` to confirm it loads.

- **1.3 Configure ESLint & Prettier**
  - **1.3.1** Add Prettier:
    - `npm install -D prettier eslint-config-prettier eslint-plugin-prettier`
  - **1.3.2** Add `.prettierrc` and update `.eslintrc` to extend `plugin:prettier/recommended`.
  - **1.3.3** Add scripts to `package.json`:
    - `"lint": "next lint"`
    - `"format": "prettier --write ."`

- **1.4 Basic app layout & theming**
  - **1.4.1** Set up Tailwind CSS:
    - `npm install -D tailwindcss postcss autoprefixer`
    - `npx tailwindcss init -p`
    - Configure `content` paths and add base styles to `globals.css`.
  - **1.4.2** Implement light/dark theme support:
    - Install and configure `next-themes` (or similar).
    - Use Tailwind `dark:` classes for dark mode styling.
  - **1.4.3** Define a global layout shell in `app/layout.tsx`:
    - Header with logo/app name.
    - Sidebar placeholder for navigation.
    - Main content area with responsive layout.
  - **1.4.4** Commit changes:
    - `git add . && git commit -m "chore: scaffold Next.js app with linting, prettier, theming"`

---

### 2. Docker & MongoDB Setup

- **2.1 Add Docker support for the web app**
  - **2.1.1** Create `Dockerfile` in `/home/blih/BMS/bms-frontend`:
    - Use a multi-stage build (builder + runner) based on Node LTS.
    - Expose port `3000` and set `NODE_ENV`.
  - **2.1.2** Test build:
    - `docker build -t bms-frontend:dev .`

- **2.2 Create `docker-compose.yml` in `/home/blih/BMS`**
  - **2.2.1** Define `mongo` service:
    - Image: `mongo:latest`.
    - Environment: `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`.
    - Volume: `mongo-data` for persistence.
  - **2.2.2** Optional `mongo-express` service:
    - Connect to `mongo` and expose port `8081`.
  - **2.2.3** Define `web` service:
    - Build from `./bms-frontend`.
    - Map port `3000:3000`.
    - Set env vars: `MONGODB_URI`, `NEXT_PUBLIC_API_URL`, etc.

- **2.3 Environment configuration**
  - **2.3.1** Create `.env.development.local` in `bms-frontend`:
    - `MONGODB_URI=mongodb://<user>:<password>@mongo:27017/bms?authSource=admin`
    - Any other local config (`NEXTAUTH_SECRET`, placeholder keys).
  - **2.3.2** Ensure `.env*` is in `.gitignore`.
  - **2.3.3** Optionally create `.env.production` template for future deployment.

- **2.4 Verify Docker setup**
  - **2.4.1** Start the stack from `/home/blih/BMS`:
    - `docker compose up -d`
  - **2.4.2** Confirm services with `docker ps` (`web`, `mongo`, optional `mongo-express`).
  - **2.4.3** Confirm app connects to MongoDB:
    - Implement a health-check API route that pings the DB and returns status.
    - Hit the route and confirm `{ status: "ok" }`.
  - **2.4.4** Commit Docker setup:
    - `git add . && git commit -m "chore: add Docker and MongoDB compose setup"`

---

### 3. Base Architecture & Folder Structure

- **3.1 Define folder structure in `bms-frontend`**
  - **3.1.1** Under `src/` (or root), ensure:
    - `app/` for routes.
    - `app/api/` for API handlers.
    - `lib/` for shared utilities and configuration.
    - `modules/` for domain modules (`tenants`, `billing`, `maintenance`, etc.).
  - **3.1.2** Create placeholder module files:
    - `modules/tenants/index.ts`
    - `modules/billing/index.ts`
    - `modules/maintenance/index.ts`

- **3.2 Shared MongoDB connection utility**
  - **3.2.1** Install MongoDB driver:
    - `npm install mongodb`
  - **3.2.2** Create `lib/db.ts`:
    - Implement a singleton `MongoClient` with connection reuse in dev and single instance in prod.
    - Export helper functions like `getDb()` and typed collection accessors.
  - **3.2.3** Add a simple test API route `app/api/health/route.ts`:
    - Use `getDb()` to ping the database.
    - Return `{ status: "ok" }` on success.
  - **3.2.4** Verify `/api/health` in browser or via `curl`.

- **3.3 Basic config and conventions**
  - **3.3.1** Add `tsconfig` path aliases:
    - Example: `@/lib/*`, `@/modules/*`, `@/app/*`.
  - **3.3.2** Update imports in test code to use aliases.
  - **3.3.3** Decide naming patterns:
    - Collections (e.g., `organizations`, `buildings`, `tenants`).
    - Service/repository naming scheme if desired.
  - **3.3.4** Commit architecture:
    - `git add . && git commit -m "chore: define base architecture and MongoDB connection utility"`

---

### 4. Phase 1 Exit Criteria

- **4.1** `docker compose up` starts `web` and `mongo` successfully.
- **4.2** Next.js app is reachable at `http://localhost:3000`.
- **4.3** `/api/health` confirms successful MongoDB connection.
- **4.4** ESLint + Prettier are configured and `npm run lint` passes.
- **4.5** Tailwind-based light/dark theme works at the layout level.
- **4.6** Folder structure (`app`, `app/api`, `lib`, `modules`) is in place and wired with TypeScript path aliases.















































