# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Monorepo with three apps:

- `apps/backend/` — Laravel 13 REST API (multi-tenant, clean architecture)
- `apps/admin-v2/` — Next.js 16 admin panel (tenant + super-admin)
- `apps/customer_v2/` — Flutter mobile app (customer-facing)

## Commands

### Backend (`apps/backend/`)

```bash
# Start all dev processes (server + queue + logs + vite)
composer dev

# Run tests (clears config first)
composer test

# Run single test file
php artisan test --filter=ReservationTest

# Run Pest directly
./vendor/bin/pest tests/Feature/Auth/
```

### Admin (`apps/admin-v2/`)

```bash
npm run dev    # Next.js dev server
npm run build  # Production build
npm run lint   # ESLint
```

### Flutter (`apps/customer_v2/`)

```bash
fvm flutter run                    # Run on connected device
fvm flutter build apk              # Android build
dart run build_runner build        # Regenerate DI (injectable)
```

## Backend Architecture

Clean Architecture layers: `Domain` → `Application` → `Infrastructure`.

- **Domain** (`app/Domain/`): Entities, value objects, repository interfaces, no framework deps
- **Application** (`app/Application/UseCases/`): Use cases orchestrating domain logic
- **Infrastructure** (`app/Infrastructure/`): Eloquent models/repositories, HTTP controllers, mail, console commands

**Multi-tenancy**: `ResolveTenantMiddleware` resolves tenant from subdomain/header. `TenantScope` auto-applies to queries. All tenant routes are wrapped in `auth:sanctum` + tenant middleware.

**Models live in** `app/Infrastructure/Persistence/Models/`, not `app/Models/` (empty).

**Testing**: Pest with SQLite in-memory. Queue set to `sync`. Tests live in `tests/Feature/` and `tests/Unit/`.

## Admin Architecture

Same Clean Architecture layers as backend: `application/` → `domain/` → `infrastructure/` → `presentation/` → `shared/`.

- **`src/app/`**: Next.js App Router. Route groups: `(auth)`, `(public)`, `(tenant)`, `(onboarding)`, `super-admin`
- **`src/infrastructure/api/`**: Axios instances and endpoint definitions
- **`src/presentation/components/`**: Reusable UI (shadcn/ui + Radix)
- **`src/shared/`**: Constants, types, utils

**Stack**: Tailwind v4, shadcn/ui, React Query (server state), Zod + React Hook Form, nuqs (URL state), Firebase (realtime/notifications).

> **IMPORTANT**: This project uses Next.js 16 which has breaking changes from Next.js 13/14. Before writing any Next.js code, read the relevant guide in `apps/admin-v2/node_modules/next/dist/docs/`. The `AGENTS.md` in `apps/admin-v2/` has more detail.

## Flutter Architecture

BLoC pattern with injectable DI (get_it). Feature-first structure under `lib/features/`. Each feature has: `data/`, `domain/`, `presentation/`.

- Run `dart run build_runner build` after modifying injectable DI registrations
- Uses `fpdart` Either/Option for error handling (no exceptions in domain layer)
- Environment config from `.env.dev` / `.env.prod`

## Deployment

- **Backend** → Vultr (45.32.169.172) via SSH, triggered by push to `develop` at `apps/backend/**`
- **Admin** → Vercel (`dev.goturnly.com`) via GitHub Actions, triggered by push to `develop` at `apps/admin-v2/**`
- **Backend queue worker**: `turnly-queue` systemd service; mailable classes that use `ShouldQueue` require the worker running
- **Config cache**: Production uses `config:cache`; always use `config()` not `env()` in app code

## Local Dev Notes

- MySQL runs locally (no Docker required for backend dev); Docker Compose provides MySQL + Redis + Mailpit for full stack
- Mailpit web UI: `http://localhost:8025`
- Backend `.env` must have `MAIL_MAILER=resend` with Resend API key
