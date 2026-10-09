# Phase 00 — Kickoff and Scaffold

## Goal

Establish a shared, buildable repository with the agreed project structure, Prisma schema, shared contracts, transition data, and typed mocks. Ensure the project is ready for subsequent development, with local verification completed wherever possible and external setup tasks handed off to the user when required.

## Build

### 1. Scaffold

- Inspect `AGENTS.md`, the relevant sections of `project-doc.md`, and this phase specification before making changes.
- Configure Next.js App Router, TypeScript strict mode, Tailwind CSS, shadcn/ui, ESLint, Prettier, and Vitest according to the project specifications.
- Implement the folder structure defined in `AGENTS.md` section 3.
- Configure `package.json` scripts for `dev`, `build`, `lint`, `typecheck`, `test`, and `db:seed`.
- Ensure `AGENTS.md` and `project-doc.md` exist at the repository root. If required specification files are missing, ask the user to provide them rather than inventing requirements.

### 2. Database and Prisma

- Implement `prisma/schema.prisma` using all models and enums defined in `project-doc.md` section 6.
- Follow Prisma 7 conventions: use the `prisma-client` generator, configure the agreed output path, and omit the connection URL from the schema datasource.
- Configure `prisma.config.ts` to read `DIRECT_URL`.
- Implement the Prisma Client singleton in `src/lib/db.ts` using `@prisma/adapter-pg`.
- Add `.env.example` documenting `DATABASE_URL`, `DIRECT_URL`, and `TEST_DATABASE_URL`, using placeholders rather than real credentials.
- Add `docs/supabase-rls.sql` to enable Row Level Security on all specified tables without creating policies.
- Prepare the initial migration and validate the schema using available tooling.
- If applying the migration requires a configured Supabase project, credentials, or database access, hand off the required steps to the user. Do not perform manual dashboard setup or claim the migration has been applied without verification.

### 3. Contracts and transitions

- Create `src/lib/contracts/common.ts` with the shared error shape, ID schema, and enums mirrored from Prisma.
- Implement `src/lib/state/transitions.ts` with every transition defined in `project-doc.md` section 4.1, including `from`, `to`, `roles`, `guardKey`, and `notify`.
- Keep `transitions.ts` as data only; do not implement the transition engine.
- Create the following Zod contract files:
  - `src/lib/contracts/booking.ts`
  - `src/lib/contracts/public.ts`
  - `src/lib/contracts/estimate.ts`
  - `src/lib/contracts/inventory.ts`
  - `src/lib/contracts/qc.ts`
- Create typed mock data in `src/mocks/customer.ts` for public shops, slots, and booking-related UI.
- Create typed mock data in `src/mocks/shopfloor.ts` for technician jobs, estimates, parts, purchase orders, and the QC queue.
- Add `docs/screens.md` documenting the screen list and fields for the Technician, Parts, and QC dashboards.

### 4. Layout shells and shared components

- Define design tokens, including the Tailwind theme, fonts, and colors, according to the project specifications.
- Create layout shells for `(public)`, `(customer)`, `(pos)/sa`, `(pos)/technician`, `(pos)/parts`, and `(pos)/qc`.
- Implement the shared components:
  - `Button`
  - `Card`
  - `StatusBadge`
  - `StatusTimeline`
  - `DataTable`
  - `EmptyState`
  - `Spinner`
  - `FormField`
- Ensure the shells and components can render using typed mocks without requiring a live backend.

### 5. Health endpoint

- Implement `GET /api/health` to check application health and database connectivity.
- Return an appropriate unsuccessful response when the database is unavailable; do not report a successful database check without actually verifying connectivity.
- Add a smoke test for the health endpoint.
- If a real database connection is unavailable, implement and test what can be verified locally, document the limitation, and hand off the required database setup to the user.

### 6. Local verification

- Run `npm run lint && npm run typecheck && npm test` after each meaningful implementation sub-part.
- Run `npm run build` during final verification.
- Generate the Prisma Client and validate the schema using the available tooling.
- Add unit tests verifying that `transitions.ts` contains no duplicate `(from, to)` pairs and that every status is reachable.
- Record actual command results and distinguish passed, failed, and blocked checks.

## Constraints

- Follow the relevant specifications in `AGENTS.md`, `project-doc.md` sections 1, 4.1, 6, 7, and 9, and `docs/SETUP.md` sections 3 and 5.
- Post an implementation plan of no more than 15 lines before starting work.
- Follow the specified build sequence. Do not skip ahead to later-phase features.
- If a required specification file is missing, request it rather than guessing its contents.
- If a change touches frozen files identified in `AGENTS.md` section 5, stop and request human approval before proceeding.
- Keep the transitions module data-only; do not implement transition execution or business rules.
- Do not implement authentication, authorization, or real business workflows.
- Do not commit secrets or real credentials. Keep `.env` out of version control and use placeholders in `.env.example`.
- Do not manually create or configure Supabase projects, retrieve credentials through dashboard interactions, configure Vercel projects, set external environment variables, or perform other manual external setup.
- When an external action, missing credential, permission, or unavailable service blocks progress, provide the user with the exact action required and its purpose.
- Continue with independent implementation and local verification wherever possible instead of blocking the entire phase.
- Never claim that migrations, deployments, or live endpoint checks succeeded unless they were actually executed and verified.

## Acceptance checks

- [ ] The repository contains the folder structure and required documentation specified by the project.
- [ ] `package.json` includes `dev`, `build`, `lint`, `typecheck`, `test`, and `db:seed` scripts.
- [ ] The Prisma schema contains all models and enums defined in `project-doc.md` section 6.
- [ ] Prisma configuration follows Prisma 7 conventions and uses the configured `DIRECT_URL`.
- [ ] Prisma Client generation succeeds and all generated-client imports resolve.
- [ ] The database adapter singleton is implemented using `@prisma/adapter-pg`.
- [ ] `.env.example` documents all required database variables without real credentials.
- [ ] The initial migration is prepared, and `npx prisma migrate dev` is verified against a reachable configured database. If external setup is incomplete, this check is explicitly marked as blocked and handed off to the user.
- [ ] `docs/supabase-rls.sql` enables RLS on all specified tables without creating policies.
- [ ] `transitions.ts` matches the transitions in `project-doc.md` section 4.1 one to one.
- [ ] Unit tests verify there are no duplicate `(from, to)` pairs and every status is reachable.
- [ ] All specified Zod contract files exist and correctly define their intended data shapes.
- [ ] Customer and shop-floor mocks are typed and usable without a live backend.
- [ ] `docs/screens.md` documents the Technician, Parts, and QC screen and field lists.
- [ ] All specified layout shells and shared components are implemented and buildable.
- [ ] `GET /api/health` and its smoke test are implemented.
- [ ] Database connectivity is verified when a real database is available; otherwise, the limitation and required user action are documented.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` have been executed and their actual results recorded.
- [ ] Every blocked check has a clear handoff explaining the required user action and how to verify completion.

## Not in this phase

- Manual creation or configuration of Supabase projects, database credentials, or external database settings.
- Manual Vercel project setup, production environment configuration, deployment, or live deployment verification.
- Authentication, JWT issuance, authorization, sessions, or user-management flows.
- Implementation of the transition engine or real business logic.
- Full customer-facing or shop-floor workflows beyond the specified shells, shared components, contracts, and mocks.
- Creation of RLS policies or application-level access-control rules.
- Integration with email, calling, AI, or other third-party providers.
- Implementation of features assigned to subsequent phases.
