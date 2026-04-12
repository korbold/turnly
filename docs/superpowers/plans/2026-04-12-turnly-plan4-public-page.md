# Plan 4: Public Business Page + Booking Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public-facing page per business at `/[slug]` where clients can view the business profile, services, and book appointments without login.

**Architecture:** New public API routes (no auth) that resolve tenants by slug. New `(public)` route group in Next.js for unauthenticated pages. Landing page at `/` with registration CTA.

**Tech Stack:** Laravel (public API routes), Next.js (SSR/static pages)

**Spec:** `docs/superpowers/specs/2026-04-12-turnly-rebrand-design.md` — Section 9

**Depends on:** Plan 1 (DB), Plan 2 (business types), Plan 3 (media/images)

---

## Task 1: Backend — public API endpoints

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/PublicController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Create PublicController**

Create `apps/backend/app/Infrastructure/Http/Controllers/PublicController.php`:

A controller with these methods:

**getTenant(slug)** — Fetch active tenant by slug with services and availability slots. Returns: tenant profile (name, description, logo_url, cover_url, business_type, brand_theme, social_links, address, phone), active services (name, price, description, image_url), and availability_slots (day, start_time, end_time).

**getAvailableSlots(slug)** — Accepts `service_id` and `date` query params. Resolves tenant by slug, then reuses the existing `GetAvailableSlotsUseCase` logic to return available time slots.

**book(slug)** — Creates a reservation without auth. Accepts: `service_id`, `scheduled_at`, `client_name`, `client_email`, `client_phone`, `notes` (optional), `client_resource_data` (optional JSON for custom fields). This endpoint:
1. Resolves tenant by slug
2. Creates or finds the client user by email (simple upsert — no password needed for public bookings)
3. Optionally creates a client_resource if `client_resource_data` is provided
4. Creates the reservation with status `pending`
5. Returns confirmation with reservation ID

```php
<?php

namespace App\Infrastructure\Http\Controllers;

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PublicController extends Controller
{
    public function getTenant(string $slug): JsonResponse
    {
        $tenant = TenantModel::where('slug', $slug)
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->first();

        if (!$tenant) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Negocio no encontrado'],
            ], 404);
        }

        $services = ServiceModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'description', 'price', 'image_url']);

        $availability = AvailabilitySlotModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('day_of_week')
            ->get(['day_of_week', 'start_time', 'end_time']);

        $images = $tenant->images()->get(['id', 'url', 'caption']);

        return response()->json([
            'data' => [
                'tenant' => [
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'description' => $tenant->description,
                    'business_type' => $tenant->business_type,
                    'logo_url' => $tenant->logo_url,
                    'cover_url' => $tenant->cover_url,
                    'brand_theme' => $tenant->brand_theme,
                    'social_links' => $tenant->social_links,
                    'address' => $tenant->address,
                    'phone' => $tenant->phone,
                    'custom_fields' => $tenant->custom_fields,
                ],
                'services' => $services,
                'availability' => $availability,
                'images' => $images,
            ],
        ]);
    }

    public function getAvailableSlots(string $slug, Request $request): JsonResponse
    {
        $request->validate([
            'service_id' => 'required|uuid',
            'date' => 'required|date|after_or_equal:today',
        ]);

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();

        $date = new \DateTimeImmutable($request->date);
        $dayOfWeek = (int) $date->format('N') - 1;
        $durationMinutes = 30;

        $availabilitySlots = AvailabilitySlotModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        if ($availabilitySlots->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $existingReservations = ReservationModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereDate('scheduled_at', $request->date)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->get();

        $slots = [];

        foreach ($availabilitySlots as $availability) {
            $startTime = new \DateTimeImmutable($request->date . ' ' . $availability->start_time);
            $endTime = new \DateTimeImmutable($request->date . ' ' . $availability->end_time);
            $maxConcurrent = $availability->max_concurrent;
            $current = $startTime;

            while ($current->modify("+{$durationMinutes} minutes") <= $endTime) {
                $slotEnd = $current->modify("+{$durationMinutes} minutes");
                $overlapping = 0;

                foreach ($existingReservations as $reservation) {
                    $resStart = new \DateTimeImmutable($reservation->scheduled_at);
                    $resEnd = new \DateTimeImmutable($reservation->estimated_end);
                    if ($current < $resEnd && $slotEnd > $resStart) {
                        $overlapping++;
                    }
                }

                if ($overlapping < $maxConcurrent) {
                    $slots[] = [
                        'start' => $current->format('Y-m-d H:i:s'),
                        'end' => $slotEnd->format('Y-m-d H:i:s'),
                        'available' => $maxConcurrent - $overlapping,
                    ];
                }

                $current = $current->modify('+30 minutes');
            }
        }

        return response()->json(['data' => $slots]);
    }

    public function book(string $slug, Request $request): JsonResponse
    {
        $request->validate([
            'service_id' => 'required|uuid',
            'scheduled_at' => 'required|date|after:now',
            'client_name' => 'required|string|max:255',
            'client_email' => 'required|email|max:255',
            'client_phone' => 'nullable|string|max:20',
            'notes' => 'nullable|string|max:500',
            'client_resource_data' => 'nullable|array',
        ]);

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();

        // Find or create client user
        $client = UserModel::firstOrCreate(
            ['email' => $request->client_email],
            [
                'name' => $request->client_name,
                'phone' => $request->client_phone,
                'password' => bcrypt(Str::random(16)),
                'is_super_admin' => false,
            ]
        );

        // Create client resource if data provided
        $clientResourceId = null;
        if ($request->client_resource_data) {
            $resource = ClientResourceModel::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'client_id' => $client->id,
                'label' => $request->client_name,
                'data' => $request->client_resource_data,
            ]);
            $clientResourceId = $resource->id;
        }

        $scheduledAt = new \DateTimeImmutable($request->scheduled_at);
        $estimatedEnd = $scheduledAt->modify('+30 minutes');

        $reservation = ReservationModel::withoutGlobalScopes()->create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'client_id' => $client->id,
            'client_resource_id' => $clientResourceId,
            'service_id' => $request->service_id,
            'scheduled_at' => $scheduledAt->format('Y-m-d H:i:s'),
            'estimated_end' => $estimatedEnd->format('Y-m-d H:i:s'),
            'status' => 'pending',
            'notes' => $request->notes,
            'created_by' => $client->id,
        ]);

        return response()->json([
            'data' => [
                'reservation_id' => $reservation->id,
                'status' => 'pending',
                'scheduled_at' => $reservation->scheduled_at,
                'message' => 'Reserva creada exitosamente',
            ],
        ], 201);
    }
}
```

- [ ] **Step 2: Add public routes**

In `routes/api.php`, add a NEW group OUTSIDE the auth middleware (in the public section with onboarding):

```php
// Public business pages
Route::prefix('v1/public')->group(function () {
    Route::get('tenants/{slug}', [PublicController::class, 'getTenant']);
    Route::get('tenants/{slug}/available-slots', [PublicController::class, 'getAvailableSlots']);
    Route::post('tenants/{slug}/book', [PublicController::class, 'book']);
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/PublicController.php apps/backend/routes/api.php
git commit -m "feat: add public API endpoints for business page and booking"
```

---

## Task 2: Frontend — Next.js config for images

**Files:**
- Modify: `apps/admin/next.config.ts`

- [ ] **Step 1: Add image domains**

Read the file first. Add image config to allow localhost and future production domains:

```typescript
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/next.config.ts
git commit -m "feat: configure Next.js image domains for uploads"
```

---

## Task 3: Frontend — public API functions

**Files:**
- Create: `apps/admin/src/lib/api/public.ts`

- [ ] **Step 1: Create public API**

```typescript
import axios from 'axios';

const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1/public',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

export interface PublicTenant {
  name: string;
  slug: string;
  description: string | null;
  business_type: string;
  logo_url: string | null;
  cover_url: string | null;
  brand_theme: string;
  social_links: Record<string, string> | null;
  address: string | null;
  phone: string | null;
  custom_fields: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] | null }> | null;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
}

export interface PublicAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface PublicImage {
  id: string;
  url: string;
  caption: string | null;
}

export interface AvailableSlot {
  start: string;
  end: string;
  available: number;
}

export async function getPublicTenant(slug: string) {
  const response = await publicApi.get(`/tenants/${slug}`);
  return response.data.data as {
    tenant: PublicTenant;
    services: PublicService[];
    availability: PublicAvailability[];
    images: PublicImage[];
  };
}

export async function getAvailableSlots(slug: string, serviceId: string, date: string) {
  const response = await publicApi.get(`/tenants/${slug}/available-slots`, {
    params: { service_id: serviceId, date },
  });
  return response.data.data as AvailableSlot[];
}

export async function bookAppointment(slug: string, data: {
  service_id: string;
  scheduled_at: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  notes?: string;
  client_resource_data?: Record<string, string>;
}) {
  const response = await publicApi.post(`/tenants/${slug}/book`, data);
  return response.data.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/lib/api/public.ts
git commit -m "feat: add public API client for business pages"
```

---

## Task 4: Frontend — public business page

**Files:**
- Create: `apps/admin/src/app/(public)/layout.tsx`
- Create: `apps/admin/src/app/(public)/[slug]/page.tsx`

- [ ] **Step 1: Create public layout**

A minimal layout with NO sidebar, NO auth check. Just a clean wrapper:

```typescript
import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
      <footer className="py-8 text-center text-sm text-gray-400">
        Powered by <span className="font-medium text-gray-600">Turnly</span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Create business page**

A 'use client' page at `apps/admin/src/app/(public)/[slug]/page.tsx`.

This page:
1. Gets `slug` from URL params
2. Fetches business data via `getPublicTenant(slug)`
3. Shows loading spinner while fetching
4. Shows 404 message if not found

Layout sections (top to bottom):
- **Header**: Cover image as banner (fallback gradient using brand_theme color), logo overlay (bottom-left), business name, type badge, description, address, phone, social links
- **Gallery**: Horizontal scroll of images (if any)
- **Services**: Grid of service cards (image, name, price, description, "Reservar" button)
- **Schedule**: Weekly hours table from availability data (Lunes-Domingo with times)

Clicking "Reservar" on a service should set that service as selected and scroll to/show the booking section (Task 5).

Use the brand_theme to color the header and buttons. Map theme name to Tailwind colors:
```typescript
const themeColors: Record<string, { bg: string; text: string; button: string }> = {
  blue: { bg: 'bg-blue-600', text: 'text-blue-600', button: 'bg-blue-600 hover:bg-blue-700' },
  green: { bg: 'bg-green-600', text: 'text-green-600', button: 'bg-green-600 hover:bg-green-700' },
  // ... etc for all 8 themes
};
```

Day name mapping:
```typescript
const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/(public)/
git commit -m "feat: create public business page with profile, services, and schedule"
```

---

## Task 5: Frontend — booking flow on public page

**Files:**
- Modify: `apps/admin/src/app/(public)/[slug]/page.tsx`

- [ ] **Step 1: Add booking section**

When a service is selected (via "Reservar" button), show a booking section below services with these steps:

**Step 1 — Select date**: Calendar-style date picker (simple: show next 14 days as clickable buttons). Fetch available slots when date is selected.

**Step 2 — Select time**: Grid of available time slots (e.g. "9:00", "9:30", "10:00"). Unavailable slots greyed out.

**Step 3 — Client info**: Form with name, email, phone (optional). If tenant has custom_fields, render them dynamically.

**Step 4 — Confirmation**: Summary of selection (service, date, time, client info). "Confirmar reserva" button.

**After booking**: Show success message with reservation ID and a "Tu reserva está pendiente de confirmación" message.

Use `useState` for: selectedService, selectedDate, selectedSlot, clientForm, bookingStep, bookingResult.

Use `getAvailableSlots(slug, serviceId, date)` when date changes.
Use `bookAppointment(slug, data)` on confirm.

Keep everything in the same page file — the booking section appears/hides based on state.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(public)/[slug]/page.tsx
git commit -m "feat: add booking flow to public business page"
```

---

## Task 6: Frontend — landing page

**Files:**
- Modify: `apps/admin/src/app/page.tsx`

- [ ] **Step 1: Create landing page**

Replace the current redirect-to-login page with a simple landing page:

- Hero section: "Gestiona tu negocio, acepta reservas online" heading, "Turnly es la plataforma de citas y servicios para cualquier negocio" subtext
- Two CTA buttons: "Registra tu negocio gratis" (→ /register), "Iniciar sesión" (→ /login)
- Features section: 3 cards (Reservas online, Multi-negocio, Panel de administración)
- Footer: "Powered by Turnly"

Keep it simple and clean. No heavy design needed.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/page.tsx
git commit -m "feat: create Turnly landing page"
```

---

## Task 7: Verification

- [ ] **Step 1: Run backend tests**
```bash
cd apps/backend && php artisan test
```

- [ ] **Step 2: Build admin**
```bash
cd apps/admin && npm run build
```

- [ ] **Step 3: Test public page**
- Navigate to `http://localhost:3000/fdr` (or whatever tenant slug exists)
- Verify business info displays
- Verify services show
- Test booking flow

- [ ] **Step 4: Commit fixes**
```bash
git add -A && git commit -m "fix: verification fixes for Plan 4"
```
