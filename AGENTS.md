# AGENTS.md: BayFlow

Instructions for AI coding agents (Claude Code, Cursor, Copilot, Antigravity, etc.) working in this repo. Read this file and `project-doc.md` **before every task**.

## 0. Prime directives

1. **`project-doc.md` is the source of truth.** Do not invent features, statuses, roles or endpoints. If the spec is wrong or missing something, stop and propose a change to `project-doc.md` (and add a row to its Decision Log) instead of silently diverging.
2. **Spec first, then plan, then code.** For every task: read the relevant spec section, write a short plan (files to touch, tests to add), wait for human approval when the plan touches a shared area (section 5), then implement.
3. **Core before bonus.** Do not start calling or the AI Front Desk until a human confirms the full core flow works on the live URL.
4. **A smaller, correct, deployed product beats a large broken one.** Prefer the simplest thing that satisfies the spec.
5. **The human must be able to explain every line.** Keep code small and readable; leave brief comments only where logic is non-obvious (state machine guards, tenancy, transactions).

## 1. Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript (`strict`) |
| DB | PostgreSQL (Supabase), accessed server-side through Prisma only |
| ORM | Prisma |
| Validation | Zod (shared schemas in `src/lib/contracts/`) |
| Auth | bcryptjs + JWT (`jose`) in httpOnly cookie |
| UI | Tailwind + shadcn/ui |
| Client data | TanStack Query (or SWR), polling about 10 s |
| Tests | Vitest |
| Deploy | Vercel (production deploys from `main` only) |

Do not add new dependencies without saying why in the PR description. Do not introduce a second state library, ORM, or UI kit.

## 2. Commands

```bash
npm install                   # install
cp .env.example .env          # then fill in values
npm run db:migrate            # prisma migrate dev + generate (uses DIRECT_URL)
npm run db:seed               # seed demo data (3+ shops, all roles)
npm run dev                   # run locally at http://localhost:3000
npm test                      # Vitest (state machine, tenancy, slots)
npm run lint && npm run typecheck   # must pass before every commit
npm run build                 # must pass before merging to main
```

If a command above does not exist yet, create it in `package.json` as part of the first task that needs it.

## 3. Project structure

```
src/
  app/
    (public)/                 # landing, shop pages, booking wizard
    (customer)/               # customer dashboard
    (pos)/                    # shop POS: owner, sa, technician, parts, qc
    api/                      # thin route handlers only
  lib/
    auth/                     # hashing, JWT, session, requireRole()
    tenancy/                  # withShopScope(), requireMembership()
    state/                    # transitions table + transitionBooking()
    services/                 # business logic: bookings, estimates, inventory, po, qc, notifications
    contracts/                # Zod schemas and inferred types (API contract)
    db.ts                     # Prisma client
  components/
    ui/                       # shared primitives (shadcn)
    ...                       # feature components per role
prisma/
  schema.prisma
  seed.ts
tests/                        # unit and integration tests
docs/                         # optional diagrams, API docs
project-doc.md  AGENTS.md  README.md  .env.example
```

## 4. Architecture rules (non-negotiable)

### 4.1 Layering
- Route handlers do only: authenticate, validate input with Zod, call a service, map errors to HTTP. **No business logic or direct Prisma calls in route handlers or React components.**
- All business logic lives in `src/lib/services/*`. Services take an explicit `actor` (user + role + shopId) and are the only place that talks to Prisma for domain data.

### 4.2 Multi-tenancy
- Every shop-owned query goes through `withShopScope(shopId)` or an equivalent helper that also verifies the caller's Membership.
- Never trust a `shopId` from the request body for authorization. Use the authenticated Membership or the booking's own `shopId`.
- Never write a query on shop-owned tables (`Booking`, `Slot`, `Part`, `PurchaseOrder`, `Service`, `Membership`, `Allocation`, ...) without a `shopId` filter.
- Cross-shop access returns **403 or 404**. Every new shop-scoped endpoint needs a tenancy test.

### 4.3 State machine
- Statuses and transitions are defined **only** in `src/lib/state/transitions.ts` as data (`from`, `to`, `roles`, `guard`, `notify`).
- **All status changes go through `transitionBooking(...)`.** Never write `booking.status` anywhere else.
- `transitionBooking` runs in a single DB transaction: validate transition, validate role and assignee guard, apply side effects, write `BookingHistory`, create notifications.
- Errors: `409 INVALID_TRANSITION`, `403 FORBIDDEN_ACTION`. Do not add shortcut transitions.
- The table in `project-doc.md` section 4.1 and `transitions.ts` must match exactly. Changing one means changing the other in the same PR.

### 4.4 Transactions and concurrency
Use `prisma.$transaction` for: booking creation with slot capacity, any transition, PO receive, allocation, cancellation release, QC pick. Required patterns:
- Slot capacity: lock or conditional update (`booked < capacity`) inside the transaction.
- QC pick: conditional update `WHERE status = 'QC_PENDING'`; if zero rows updated, return `409`.
- Stock never goes negative; reject with `409 CONFLICT`.

### 4.5 Validation and errors
- Zod on every endpoint input. Types come from `z.infer`, not hand-written duplicates.
- Error shape is always `{ error: { code, message, details? } }`. Use the correct HTTP status.
- Money is integer PKR. Never use floats for money.

### 4.6 Security
- bcryptjs (bcrypt algorithm) for passwords; never log passwords, tokens or full request bodies.
- Cookies: httpOnly, SameSite=Lax, Secure in production.
- No secrets in code or commits. All config comes from env vars listed in `.env.example`.
- Demo credentials appear in `README.md` and seed data only, never in application logic.

### 4.7 Supabase usage
- Supabase is used **only as managed PostgreSQL**. All data access goes through Prisma on the server. Do not add `@supabase/supabase-js`, the anon key, Supabase Auth, or client-side DB access.
- Prisma 7 setup: `DATABASE_URL` (Supabase transaction pooler, port 6543, `?pgbouncer=true`) is used **at runtime** through the `@prisma/adapter-pg` driver adapter in `src/lib/db.ts`; `DIRECT_URL` (direct or session-pooler connection) is used by the **Prisma CLI** only, configured in `prisma.config.ts`. `schema.prisma` has no `url` or `directUrl`; the generator is `prisma-client` with output `src/generated/prisma` (gitignored, created by `npm run db:generate` and `postinstall`). Always import the client via `@/lib/db`. See `docs/SETUP.md`.
- Tenant isolation stays in the application layer (`withShopScope`). Because the API is never exposed via Supabase's auto-generated REST API, enable RLS on all tables with no policies (deny by default) so nothing is reachable through PostgREST by accident.
- The service-role key and DB password are secrets: never commit them or expose them to the browser.

### 4.8 Frontend
- One centralized API client (`src/lib/api-client.ts`) that unwraps `{ data }` and throws typed errors. No raw `fetch` scattered in components.
- Reusable components in `src/components/`; role dashboards only show that role's work.
- Every data view has loading, empty and error states. Customer portal is mobile first.
- Notifications: poll `GET /api/notifications` about every 10 s; bell shows unread count.

## 5. Ownership and shared files

Three humans work in parallel, each with their own agent. Respect ownership to avoid conflicts.

| Member | Owns |
|---|---|
| **A** (core/backend lead) | `prisma/schema.prisma` and migrations, `lib/auth`, `lib/tenancy`, `lib/state`, notifications service/API, Owner module, CI, deployment, tests for state machine and tenancy |
| **B** (customer + advisor) | `(public)`, `(customer)`, SA pages under `(pos)/sa`, slot logic, booking creation, notification bell, `README.md`, `.env.example` |
| **C** (shop floor) | Technician, Parts, QC pages under `(pos)`, inventory/PO/QC services, `prisma/seed.ts` (index of modular seeds in `prisma/seed/`), and the transition effect files `src/lib/state/effects/parts.ts` and `qc.ts` (registered via A's effects registry; C never edits the engine or `transitions.ts`) |

**Frozen files (only Member A edits):** `prisma/schema.prisma`, `prisma/migrations/*`, `src/lib/state/transitions.ts`. If your task needs a change, **stop and ask the human to request it from Member A**. Do not edit them yourself.

**Shared files** (`src/components/ui/*`, `package.json`, `src/lib/contracts/*`): keep edits minimal and additive; pull before editing; one person at a time.

Before editing a file outside your ownership, ask the human.

## 6. Workflow per task

1. **Read:** `project-doc.md` section(s) relevant to the task, plus this file.
2. **Plan:** list files to create/change, tests to add, and any spec ambiguity. Keep it under 15 lines. Wait for approval if the plan touches frozen/shared files or changes behavior vs the spec.
3. **Implement** in small steps on your own branch.
4. **Test:** add or update tests (section 7), then run `npm run lint && npm run typecheck && npm test`.
5. **Verify** the behavior against the Definition of Done items it touches (`project-doc.md` section 10).
6. **Commit** (section 8) and open a small PR to `main`.
7. **Report:** summarize what changed, what was verified, and any spec gaps or follow-ups. Do not claim something works unless you ran it.

## 7. Testing requirements

Write tests for the things judges and the spec care about most:

- **State machine:** every valid transition succeeds for the right role; every invalid transition returns `409`; wrong role or wrong assignee returns `403`; history and notifications are written.
- **Tenancy:** a Shop A staff token gets 403/404 on Shop B bookings, parts, POs and team.
- **Slots:** two concurrent bookings cannot exceed capacity.
- **Inventory:** receive increases stock; allocate decreases; cancel releases; stock never negative; partial receive keeps `PARTS_ORDERED`.
- **QC:** only the first picker wins; fail requires an issue and returns to the same technician; loop repeats.
- **Estimate:** revision increments on SA edit and on reject-revise; total recomputed server-side.

Do not write tests that only assert mocks. Prefer integration tests against a test database for services.

## 8. Git conventions

- Branch per member per slice: `a/auth-tenancy`, `b/booking-wizard`, `c/qc-loop`.
- Commit messages: `feat:`, `fix:`, `chore:`, `test:`, `docs:` prefix; imperative, under 72 chars. Small, frequent commits so history is meaningful.
- Merge to `main` at least hourly; `main` must always build. Production deploys from `main` only.
- Never commit `.env`, secrets, `node_modules`, or build output.
- Never force-push `main`.

## 9. Things agents must NOT do

- Do not write `booking.status` outside `transitionBooking`.
- Do not query shop-owned data without a shop scope.
- Do not trust client-supplied role, `shopId`, or price totals for authorization or calculation.
- Do not put business logic in route handlers or components.
- Do not hard-code demo credentials or secrets.
- Do not add features, statuses or roles that are not in `project-doc.md`.
- Do not edit frozen files (section 5) or another member's folders without human approval.
- Do not start bonus features before core passes the Definition of Done.
- Do not leave `TODO` stubs that silently pass; either implement or raise it in the report.
- Do not disable lint, type checks or tests to make something pass.
- Do not invent test results or claim deployment success without checking the live URL.

## 10. Definition of done for any PR

- [ ] Matches `project-doc.md` (or the doc is updated in the same PR with a Decision Log entry).
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pass; `npm run build` passes for PRs to `main`.
- [ ] Inputs validated with Zod; errors use the standard shape and correct status.
- [ ] Shop-scoped code has a tenancy test; transitions have role and invalid-transition tests.
- [ ] No secrets, no stray debug logging, no unused code.
- [ ] Works on the deployed preview or production URL when it touches user-facing flows.
- [ ] PR description lists what changed, how it was verified, and open questions.

## 11. Quick reference: roles and status ownership

| Status | Responsible role |
|---|---|
| `PENDING`, `CONFIRMED`, `ESTIMATE_REVIEW`, `ESTIMATE_APPROVED`, `READY_FOR_PICKUP` | Service Advisor |
| `ASSIGNED`, `INSPECTING`, `IN_REPAIR` | Technician |
| `AWAITING_CUSTOMER` | Customer |
| `PARTS_PENDING`, `PARTS_ORDERED`, `PARTS_READY` | Parts Person |
| `QC_PENDING`, `QC_IN_PROGRESS` | QC Inspector (any in shop; first picker locks) |
| `ESTIMATE_REJECTED` | Service Advisor (revise or cancel) |
| `COMPLETED`, `CANCELLED` | Terminal |

## 12. When in doubt

Ask the human. State what you know, what is ambiguous, and your recommended default. Spec ambiguities are logged in `project-doc.md` section 12.1.
