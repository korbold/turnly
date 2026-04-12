# Plan 3: Business Profiles + Media Uploads

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement file upload infrastructure, logo/cover uploads for tenants, gallery images, and service images.

**Architecture:** Single upload endpoint that stores files to the `public` disk and returns the URL. Frontend uses FormData for multipart uploads. Settings page gets logo/cover upload sections. Services get image upload in create/edit modal. Gallery management in settings.

**Tech Stack:** Laravel Storage (local public disk), Next.js (FormData + fetch), sharp/image validation

**Spec:** `docs/superpowers/specs/2026-04-12-turnly-rebrand-design.md` — Section 8

**Depends on:** Plan 1 (DB columns exist), Plan 2 (settings page rebuilt)

---

## Task 1: Backend — storage link and upload endpoint

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/Upload/UploadController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Create storage symlink**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/backend && php artisan storage:link
```

- [ ] **Step 2: Create UploadController**

Create `apps/backend/app/Infrastructure/Http/Controllers/Upload/UploadController.php`:

A single `store` method that:
1. Validates: `file` required, image, max 5MB, mimes jpg/png/webp
2. Validates: `folder` optional string (e.g. "logos", "gallery", "services")
3. Stores the file to `public` disk under `uploads/{folder}/` with a unique name
4. Returns the public URL

```php
<?php

namespace App\Infrastructure\Http\Controllers\Upload;

use App\Infrastructure\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
            'folder' => ['nullable', 'string', 'in:logos,covers,gallery,services'],
        ]);

        $folder = 'uploads/' . ($request->input('folder', 'general'));
        $path = $request->file('file')->store($folder, 'public');
        $url = Storage::disk('public')->url($path);

        return response()->json([
            'data' => [
                'url' => $url,
                'path' => $path,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
```

- [ ] **Step 3: Add route**

In `routes/api.php`, inside the authenticated routes group:
```php
Route::post('uploads', [UploadController::class, 'store']);
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Upload/ apps/backend/routes/api.php
git commit -m "feat: add file upload endpoint with image validation"
```

---

## Task 2: Backend — tenant gallery CRUD endpoints

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantImageController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Create TenantImageController**

```php
<?php

namespace App\Infrastructure\Http\Controllers\Tenant;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantImageController extends Controller
{
    public function index(): JsonResponse
    {
        $images = TenantImageModel::where('tenant_id', app('current_tenant_id'))
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'data' => $images,
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'url' => ['required', 'string', 'max:500'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $count = TenantImageModel::where('tenant_id', app('current_tenant_id'))->count();
        if ($count >= 10) {
            return response()->json([
                'error' => ['code' => 'LIMIT_REACHED', 'message' => 'Máximo 10 imágenes por negocio'],
            ], 422);
        }

        $image = TenantImageModel::create([
            'tenant_id' => app('current_tenant_id'),
            'url' => $request->url,
            'caption' => $request->caption,
            'sort_order' => $count,
        ]);

        return response()->json([
            'data' => $image,
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        TenantImageModel::where('tenant_id', app('current_tenant_id'))
            ->where('id', $id)
            ->delete();

        return response()->json([
            'data' => ['message' => 'Image deleted'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['uuid'],
        ]);

        foreach ($request->ids as $index => $id) {
            TenantImageModel::where('tenant_id', app('current_tenant_id'))
                ->where('id', $id)
                ->update(['sort_order' => $index]);
        }

        return response()->json([
            'data' => ['message' => 'Order updated'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
```

- [ ] **Step 2: Add routes**

```php
Route::get('tenant/images', [TenantImageController::class, 'index']);
Route::post('tenant/images', [TenantImageController::class, 'store']);
Route::delete('tenant/images/{id}', [TenantImageController::class, 'destroy']);
Route::post('tenant/images/reorder', [TenantImageController::class, 'reorder']);
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantImageController.php apps/backend/routes/api.php
git commit -m "feat: add tenant gallery image CRUD endpoints"
```

---

## Task 3: Backend — update service requests to accept image_url

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Requests/Service/CreateServiceRequest.php`
- Modify: `apps/backend/app/Infrastructure/Http/Requests/Service/UpdateServiceRequest.php`

- [ ] **Step 1: Add image_url validation**

In `CreateServiceRequest`:
```php
'image_url' => ['nullable', 'string', 'max:500'],
```

In `UpdateServiceRequest`:
```php
'image_url' => ['nullable', 'string', 'max:500'],
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Requests/Service/
git commit -m "feat: accept image_url in service create/update requests"
```

---

## Task 4: Frontend — upload utility function

**Files:**
- Create: `apps/admin/src/lib/api/uploads.ts`

- [ ] **Step 1: Create upload API**

```typescript
import api from './client';

export async function uploadImage(file: File, folder: 'logos' | 'covers' | 'gallery' | 'services'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await api.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.data.url;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/lib/api/uploads.ts
git commit -m "feat: add image upload utility function"
```

---

## Task 5: Frontend — image upload component

**Files:**
- Create: `apps/admin/src/components/ui/image-upload.tsx`

- [ ] **Step 1: Create reusable ImageUpload component**

A component that:
- Shows current image preview if URL exists
- Has a file input (hidden) triggered by a button or drop zone
- Shows upload progress/loading state
- Calls `uploadImage()` and returns the URL via `onUpload` callback
- Has a remove button that calls `onRemove` callback
- Accepts `folder` prop for upload categorization

Props:
```typescript
interface ImageUploadProps {
  currentUrl?: string | null;
  folder: 'logos' | 'covers' | 'gallery' | 'services';
  onUpload: (url: string) => void;
  onRemove?: () => void;
  className?: string;
  label?: string;
}
```

Simple implementation:
- A bordered dashed box with "Click para subir imagen" text
- If currentUrl exists, show the image preview with a remove X button
- On file select, upload via `uploadImage()`, then call `onUpload(url)`
- Show "Subiendo..." while uploading

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/components/ui/image-upload.tsx
git commit -m "feat: add reusable ImageUpload component"
```

---

## Task 6: Frontend — add logo/cover upload to settings

**Files:**
- Modify: `apps/admin/src/app/(tenant)/settings/page.tsx`

- [ ] **Step 1: Add logo and cover upload to settings**

At the top of the "Información del negocio" section, add:
1. Logo upload — circular preview (128x128), uses ImageUpload with folder="logos"
2. Cover image upload — wide rectangular preview, uses ImageUpload with folder="covers"

When an image is uploaded, store the URL in form state (`logoUrl`, `coverUrl`). Include these in the save payload as `logo_url` and `cover_url`.

Also update `updateTenantSettings` type to include `logo_url` and `cover_url`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(tenant)/settings/page.tsx apps/admin/src/lib/api/tenant.ts
git commit -m "feat: add logo and cover upload to settings page"
```

---

## Task 7: Frontend — gallery management in settings

**Files:**
- Create: `apps/admin/src/lib/api/tenant-images.ts`
- Modify: `apps/admin/src/app/(tenant)/settings/page.tsx`

- [ ] **Step 1: Create tenant images API**

```typescript
import api from './client';

export async function getTenantImages() {
  const response = await api.get('/tenant/images');
  return response.data.data;
}

export async function addTenantImage(data: { url: string; caption?: string }) {
  const response = await api.post('/tenant/images', data);
  return response.data.data;
}

export async function deleteTenantImage(id: string) {
  await api.delete(`/tenant/images/${id}`);
}

export async function reorderTenantImages(ids: string[]) {
  await api.post('/tenant/images/reorder', { ids });
}
```

- [ ] **Step 2: Add gallery section to settings**

Add a new Card section "Galería de fotos" after the logo/cover section:
- Shows existing images in a grid (3 columns)
- Each image shows preview with caption and delete button
- "Agregar foto" button that triggers ImageUpload with folder="gallery"
- After upload, calls `addTenantImage({ url })` to save
- Max 10 images (show count "3/10 fotos")
- Delete calls `deleteTenantImage(id)` and refreshes

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/api/tenant-images.ts apps/admin/src/app/(tenant)/settings/page.tsx
git commit -m "feat: add gallery management to settings page"
```

---

## Task 8: Frontend — service image upload

**Files:**
- Modify: `apps/admin/src/app/(tenant)/services/page.tsx`
- Modify: `apps/admin/src/lib/api/services.ts`
- Modify: `apps/admin/src/types/service.ts`

- [ ] **Step 1: Update types and API**

Add `image_url` to Service type. Add `image_url` to create/update service params.

- [ ] **Step 2: Add image upload to service form**

In the service create/edit dialog, add an ImageUpload component above the name field. When an image is uploaded, store the URL in form state and include it in the create/update payload.

Show a small image preview in the services table (first column, before name).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/(tenant)/services/page.tsx apps/admin/src/lib/api/services.ts apps/admin/src/types/service.ts
git commit -m "feat: add image upload to services"
```

---

## Task 9: Verification

- [ ] **Step 1: Run backend tests**

```bash
cd apps/backend && php artisan test
```

- [ ] **Step 2: Build admin**

```bash
cd apps/admin && npm run build
```

- [ ] **Step 3: Test uploads manually**

- Upload a logo in settings
- Upload gallery images
- Upload a service image
- Verify images display correctly

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: verification fixes for Plan 3"
```
