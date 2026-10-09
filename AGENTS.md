# Bayflow

Bayflow is a multi-tenant vehicle-service platform. Customers book services, and each shop manages its own team, estimates, parts, repairs, and quality checks.

The booking state machine defines what can happen next. The server enforces who can do it. The database records what happened.

`project-doc.md` explains the product and the decisions behind it. This file contains the rules agents must follow.

## Stack

Next.js App Router, TypeScript strict, PostgreSQL on Supabase, Prisma 7, Zod, bcryptjs, `jose`, Tailwind, shadcn/ui, TanStack Query or SWR, and Vitest. Vercel hosts the application.

Prisma is the only database access layer. Authentication uses our own JWT-based session system, not Supabase Auth.

Use the APIs supported by the versions installed in this repository. When uncertain, consult the installed package's documentation rather than guessing.

## How we work

Spec driven. Nothing gets built without a specification.

- `project-doc.md` — the product, its behavior, and the decisions behind it.
- `docs/specs/phase-NN.md` — the scope and acceptance checks for the phase being built.
- `AGENTS.md` — rules that apply to every task.

**Starting a task.** Read this file and the relevant sections of `project-doc.md` and the phase spec, if one exists. Write a plan of at most 15 lines describing the approach, files likely to change, tests, and any ambiguity. Wait for human approval before changing critical shared files or making a change that contradicts the specification.

**Building a phase.** Work in small, ordered parts. For each part, implement it, run `npm run lint && npm run typecheck && npm test`, and commit before proceeding. A failing check stops progression; don't build on top of a red result.

**Dropped into an unfamiliar repository?** Inspect the available phase specs and recent Git history. Establish what exists and what was last verified before continuing. Don't assume a feature works just because its files exist.

**The human owns browser acceptance.** Build the specified behavior and verify what can be checked from the terminal. Don't install browser automation or test infrastructure just to perform manual acceptance checks. Tell the human exactly what to verify in the browser.

**When the spec is ambiguous, stop before building.** State what is known, what is unclear, and which option you recommend. Explain why. Product decisions belong in `project-doc.md`, with a Decision Log entry in section 12.1 when required.

**When something fails, say so.** Never weaken a check, hide a failure, or claim a deployment or browser flow works without verifying it.

## How to talk to me

Keep it short. If a sentence isn't telling me something I need, cut it.

Ask with a recommendation: “A or B; I'd choose B because it preserves the transaction boundary.”

When only the human can provide something—a secret, external configuration, or approval—say exactly what is needed and where it belongs, then stop that part of the work.

At completion, report what changed, what was actually verified, what remains blocked, and what the human should check. Don't repeat the entire plan or list every file touched.

Use plain English. Explain important decisions, not routine syntax.

## How the code is laid out

Choose the file structure when the specification leaves room for it. These boundaries are about behavior, not personal ownership.

```text
src/
  app/
    (public)/                 # Landing, shop pages, booking wizard
    (customer)/               # Customer dashboard
    (pos)/                    # Owner, SA, technician, parts, QC
    api/                      # Thin route handlers
  lib/
    auth/                     # Passwords, JWT, sessions, role guards
    tenancy/                  # Shop membership and scoping
    state/                    # Transition table and transition engine
    services/                 # Domain logic and database operations
    contracts/                # Shared Zod schemas and inferred types
    db.ts                     # Prisma client
  components/
    ui/                       # Shared UI primitives
    ...                       # Feature components
prisma/
  schema.prisma
  seed.ts
  seed/                       # Modular seed data
tests/
docs/
project-doc.md
AGENTS.md
README.md
.env.example
```

Route handlers translate HTTP requests into service calls. Components render interfaces. Services enforce business rules and perform domain database operations.

## Architecture rules

### 1. The specification owns product behavior

`project-doc.md` is the source of truth for features, roles, statuses, transitions, and API behavior.

Never invent a status, role, endpoint, permission, or workflow to fill a gap. If implementation and specification disagree, stop and propose a documented decision. If a change is approved, update the specification and its Decision Log in the same change.

Build only what the current phase requires. No speculative scaffolding for later phases.

### 2. Business logic lives in services

Route handlers authenticate, validate inputs with Zod, call a service, and map the result or error to HTTP.

React components do not contain business logic or access Prisma. Route handlers do not contain domain logic or issue direct Prisma queries.

Domain services live in `src/lib/services/`. They receive an explicit, server-derived actor containing the authenticated user and the applicable role and shop context.

A request body is input, not proof of identity or authority.

### 3. Shop boundaries are enforced on the server

Every shop-owned operation must verify the caller's membership and scope its database access to the correct shop.

Never trust a client-supplied `shopId` for authorization. Resolve the shop from the authenticated membership or persisted booking, as appropriate to the operation.

Never query shop-owned data without a shop scope. This includes bookings, slots, parts, purchase orders, services, memberships, and allocations.

Cross-shop access returns `403` or `404`, according to the endpoint contract. Every new shop-scoped operation needs a tenancy test.

A correctly filtered UI is not a security boundary. The API must reject unauthorized requests even when called directly.

### 4. One state machine owns booking transitions

`src/lib/state/transitions.ts` is the authoritative transition table. It defines `from`, `to`, permitted roles, guards, and notification requirements as data.

All booking status changes go through `transitionBooking(...)`. No other code writes `booking.status`.

The transition engine validates the transition, role, and applicable assignment guards; applies required effects; records `BookingHistory`; and creates required notification records in one database transaction.

Invalid transitions return `409 INVALID_TRANSITION`. Unauthorized actions return `403 FORBIDDEN_ACTION`. Do not introduce shortcut transitions.

The transition table in `project-doc.md` section 4.1 and `transitions.ts` must match exactly. A change to either requires a corresponding change to the other in the same approved change.

### 5. Transactions protect business invariants

Operations that must succeed or fail together belong in a database transaction.

This includes booking creation with slot capacity, booking transitions, purchase-order receiving, inventory allocation, cancellation-related stock release, and QC picking.

- **Slots:** claim capacity atomically, using a lock or conditional update that prevents `booked` from exceeding `capacity`.
- **Inventory:** stock never goes negative. Reject operations that would violate this invariant with `409 CONFLICT`.
- **QC:** claim a booking conditionally while its status is `QC_PENDING`. If no row is updated, return `409`.
- **History and notifications:** persist required records in the same transaction as the operation they describe.

External email, SMS, and push delivery do not belong inside a database transaction. If reliable delivery and retries become necessary, use a transactional outbox. Creating an in-app notification record is not proof that an external message was delivered.

### 6. Validation, errors, and money

Every endpoint validates its input with Zod. Infer types from schemas with `z.infer` instead of maintaining duplicate handwritten definitions.

Errors follow this shape:

```ts
{
  error: {
    code: string,
    message: string,
    details?: unknown
  }
}
```

Use the HTTP status required by the error contract. Don't leak internal exceptions or sensitive details.

Money is integer PKR. Never use floating-point arithmetic for monetary totals, and never trust a client-calculated estimate total. Recalculate totals on the server.

### 7. Authentication and secrets

Passwords use bcryptjs with the bcrypt algorithm. Sessions use JWTs through `jose`, stored in secure HttpOnly cookies.

Cookies use `SameSite=Lax` and `Secure` in production. Never log passwords, tokens, or full request bodies that may contain sensitive data.

Secrets come from environment variables documented in `.env.example`. Never commit credentials or expose server secrets to browser code.

Demo credentials belong in the README and seed data only, never in application logic.

### 8. Supabase and Prisma

Supabase provides managed PostgreSQL. It is not Bayflow's authentication provider or application data API.

All database access goes through Prisma on the server. Do not introduce `@supabase/supabase-js`, Supabase Auth, the anon key, or client-side database access.

Prisma 7 uses the `prisma-client` generator with output at `src/generated/prisma`. The generated directory is ignored by Git and must be produced by `npm run db:generate` and the configured `postinstall` workflow.

`schema.prisma` has no `url` or `directUrl`. `prisma.config.ts` configures the CLI's database connection using `DIRECT_URL`.

At runtime, `src/lib/db.ts` constructs the Prisma client using `@prisma/adapter-pg` and `DATABASE_URL`. Use the transaction pooler for runtime connections when configured for that purpose; use a direct or supported session-pooler connection for CLI operations. Follow the actual connection details in `docs/SETUP.md`.

Always import the client through `@/lib/db`, not from generated files directly in application code.

Enable RLS on database tables without adding permissive policies. Tenant authorization remains in the application layer through membership checks and scoped queries. RLS is a deny-by-default safeguard against accidental exposure through PostgREST; it does not replace application authorization.

Database passwords and service-role keys are secrets. Never commit them or expose them to the browser.

### 9. Frontend behavior

Use `src/lib/api-client.ts` as the centralized API client. It unwraps `{ data }` and throws typed errors. Don't scatter raw `fetch` calls across components.

Use shared UI components. Each data view has loading, empty, and error states. The customer portal is mobile-first, and each dashboard shows only the work relevant to its role.

Notifications use `GET /api/notifications`, polled approximately every 10 seconds. The bell displays the unread count. Avoid unnecessary polling and repeated database reads.

## Shared and critical files

The codebase has shared files and changes that can affect multiple features. Freedom to choose implementation details does not mean freedom to break established contracts.

**Database schema and migrations.** Changes to `prisma/schema.prisma` or `prisma/migrations/` can affect every module. Before changing them, explain why the change is needed, identify affected services and tests, and wait for human approval.

**State machine.** Changes to `src/lib/state/transitions.ts` affect every role and workflow. Propose the matching change to `project-doc.md` section 4.1 and wait for approval before implementing it.

**Shared contracts and components.** Keep changes to `src/lib/contracts/`, `src/components/ui/`, and `package.json` focused. Check existing usage before changing shared interfaces or behavior. Explain breaking changes and wait for approval.

**Other files.** Choose the structure and implementation freely when they fit the spec and architecture rules. Coordinate if another active task is modifying the same code. Preserve existing work; never overwrite it without understanding the impact.

## Commands

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
npm test
npm run lint && npm run typecheck
npm run build
```

The development server runs at `http://localhost:3000`.

`db:migrate` uses `DIRECT_URL`; `db:seed` loads demo data, including at least three shops and the required roles. `lint`, `typecheck`, and `test` must pass before each commit. `build` must pass before merging to `main`.

If a required script does not exist, inspect the existing scripts and package configuration first. Add the missing command as part of the task that needs it, without introducing unrelated changes.

Never claim a command passed without running it. If a database or external credential prevents verification, report the exact blocker.

## Testing

Test the invariants that would break the product if they were wrong.

- **State machine:** permitted transitions succeed; invalid transitions return `409`; wrong roles or assignees return `403`; required history and notifications are recorded.
- **Tenancy:** Shop A staff cannot access Shop B's bookings, parts, purchase orders, or team.
- **Slots:** concurrent bookings never exceed capacity.
- **Inventory:** receiving increases stock, allocation decreases it, cancellation releases stock as specified, and stock never becomes negative. Partial receiving preserves the documented status.
- **QC:** only the first eligible picker wins; failure requires an issue and returns the booking to the specified technician; the QC loop repeats as defined.
- **Estimates:** totals are calculated on the server; revisions increment according to the documented rules; sent estimates are locked.

Prefer integration tests against a test database for service behavior. Mock-only tests do not prove database constraints, transaction behavior, or tenant isolation.

Do not install a new test runner or browser driver without approval. The human performs manual browser acceptance.

## Git conventions

Use short-lived branches when appropriate and keep changes focused. Commit with an imperative conventional prefix: `feat:`, `fix:`, `chore:`, `test:`, or `docs:`. Keep messages under 72 characters and commits small enough to explain.

Keep `main` buildable. Production deploys come from `main` only. Never force-push `main` or commit `.env`, secrets, `node_modules`, or build output.

## Things agents must not do

Breaking these rules is worse than leaving a task unfinished.

- Never write `booking.status` outside `transitionBooking(...)`.
- Never access shop-owned data without the required shop scope.
- Never trust client-supplied identity, role, shop authorization, or monetary totals.
- Never put domain logic in route handlers or React components.
- Never invent product behavior, statuses, roles, or transitions.
- Never change critical shared behavior without approval.
- Never start bonus features before the human confirms the complete core flow works on the live URL.
- Never leave TODO stubs that silently pass as implemented behavior.
- Never disable lint, type checks, or tests to make a task appear complete.
- Never invent test results or claim deployment success without verification.
- Never silently work around a failed check or ambiguous requirement.
- Never add dependencies without explaining their purpose and obtaining approval first.
- Never perform external account setup or deployment configuration on the human's behalf when it requires their credentials or approval. State exactly what they need to do.

## Definition of done

A task or PR is ready when:

- It matches `project-doc.md` and the current phase spec.
- `npm run lint`, `npm run typecheck`, and `npm test` pass; `npm run build` also passes before a merge to `main`.
- Inputs, errors, authorization, and tenant boundaries follow the rules above.
- New shop-scoped operations have tenancy tests; new transitions have permission and invalid-transition tests.
- No secrets, stray debug logging, unused code, or silently passing stubs remain.
- User-facing behavior has been checked on the deployed preview or production URL when applicable, or explicitly handed to the human for acceptance.
- The report states what changed, what was verified, what failed or remains unverified, and any open specification questions.

## Quick reference: booking status ownership

The role responsible for a status is not permission to transition into or out of it arbitrarily. The transition table remains authoritative.

| Status                                                                             | Responsible role                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------- |
| `PENDING`, `CONFIRMED`, `ESTIMATE_REVIEW`, `ESTIMATE_APPROVED`, `READY_FOR_PICKUP` | Service Advisor                              |
| `ASSIGNED`, `INSPECTING`, `IN_REPAIR`                                              | Technician                                   |
| `AWAITING_CUSTOMER`                                                                | Customer                                     |
| `PARTS_PENDING`, `PARTS_ORDERED`, `PARTS_READY`                                    | Parts Person                                 |
| `QC_PENDING`, `QC_IN_PROGRESS`                                                     | QC Inspector; first picker locks the booking |
| `ESTIMATE_REJECTED`                                                                | Service Advisor; revise or cancel            |
| `COMPLETED`, `CANCELLED`                                                           | Terminal                                     |

## When in doubt

Stop before guessing. Tell the human what the specification establishes, what remains ambiguous, and which option you recommend.

If the ambiguity changes product behavior, record the approved decision in `project-doc.md` section 12.1 before implementing it.
