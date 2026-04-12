---
name: WashFlow MVP
description: Multi-tenant SaaS for car wash businesses - Laravel 13 + Next.js 15 + Flutter monorepo
type: project
---

WashFlow is a multi-tenant SaaS for car wash management. Tenants manage reservations, wash logs, employees, and reports.

**Stack:** Laravel 13 (PHP 8.3, MySQL 8, Redis), Next.js 15 (App Router, shadcn/ui), Flutter 3.x (Riverpod, go_router, Dio)
**Auth:** Laravel Sanctum with tenant-scoped tokens, Spatie Permission
**Multi-tenancy:** Subdomain-based with TenantScope global scope and ResolveTenantMiddleware
**Architecture:** Domain-driven (Domain/Application/Infrastructure layers in Laravel), feature-based in Flutter

**Why:** MVP for freelance client. Prioritize functionality over visual perfection. Clean code, no tech debt, ready to scale.

**How to apply:** Follow the 15-phase implementation order strictly. Never put business logic in controllers. Always use TenantScope. No `any` in TS, no `dynamic` in Dart.
