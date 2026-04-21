<?php

use App\Infrastructure\Http\Controllers\Auth\AuthController;
use App\Infrastructure\Http\Controllers\Auth\GoogleAuthController;
use App\Infrastructure\Http\Controllers\Auth\OnboardingController;
use App\Infrastructure\Http\Controllers\Tenant\TenantSettingsController;
use App\Infrastructure\Http\Controllers\Tenant\TenantImageController;
use App\Infrastructure\Http\Controllers\Reservation\ReservationController;
use App\Infrastructure\Http\Controllers\ServiceLog\ServiceLogController;
use App\Infrastructure\Http\Controllers\ClientResource\ClientResourceController;
use App\Infrastructure\Http\Controllers\Service\ServiceController;
use App\Infrastructure\Http\Controllers\User\UserController;
use App\Infrastructure\Http\Controllers\Report\ReportController;
use App\Infrastructure\Http\Controllers\SuperAdmin\SuperAdminController;
use App\Infrastructure\Http\Controllers\Upload\UploadController;
use App\Infrastructure\Http\Controllers\PublicController;
use Illuminate\Support\Facades\Route;

// Public business pages
Route::prefix('v1/public')->group(function () {
    Route::get('categories', [PublicController::class, 'listCategories']);
    Route::get('tenants', [PublicController::class, 'listTenants']);
    Route::get('tenants/{slug}', [PublicController::class, 'getTenant']);
    Route::get('tenants/{slug}/available-slots', [PublicController::class, 'getAvailableSlots']);
    Route::get('tenants/{slug}/my-resources', [PublicController::class, 'myResources'])->middleware('auth:sanctum');
    Route::post('tenants/{slug}/book', [PublicController::class, 'book']);
});

Route::prefix('v1')->group(function () {

    // Public auth
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/google', [GoogleAuthController::class, 'login']);

    // Public onboarding
    Route::prefix('onboarding')->group(function () {
        Route::post('register', [OnboardingController::class, 'register']);
        Route::post('verify', [OnboardingController::class, 'verify']);
        Route::get('check-slug', [OnboardingController::class, 'checkSlug']);
    });

    // Authenticated routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // Authenticated onboarding (no tenant middleware — tenant resolved from user)
        Route::post('onboarding/business-type', [OnboardingController::class, 'setBusinessType']);

        // Client-facing routes (no tenant middleware — returns data across all tenants for the authenticated user)
        Route::get('client/reservations', [ReservationController::class, 'myReservations']);
        Route::get('client/reservations/{id}', [ReservationController::class, 'myReservationShow']);
        Route::patch('client/reservations/{id}/cancel', [ReservationController::class, 'myReservationCancel']);

        // Device tokens (no tenant middleware — tokens can be registered from client app)
        Route::post('device-tokens', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'store']);
        Route::delete('device-tokens/{token}', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'destroy']);

        // Notifications inbox
        Route::get('notifications', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'index']);
        Route::post('notifications/read-all', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'markAllAsRead']);
        Route::post('notifications/{id}/read', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'markAsRead']);

        // Tenant-scoped routes
        Route::middleware('tenant')->group(function () {
            // Auth
            Route::get('auth/me', [AuthController::class, 'me']);

            // Tenant settings
            Route::get('tenant/settings', [TenantSettingsController::class, 'show']);
            Route::patch('tenant/settings', [TenantSettingsController::class, 'update']);

            // Reservations
            Route::get('reservations/available-slots', [ReservationController::class, 'availableSlots']);
            Route::get('reservations', [ReservationController::class, 'index']);
            Route::post('reservations', [ReservationController::class, 'store']);
            Route::get('reservations/{id}', [ReservationController::class, 'show']);
            Route::patch('reservations/{id}/confirm', [ReservationController::class, 'confirm']);
            Route::patch('reservations/{id}/start', [ReservationController::class, 'start']);
            Route::patch('reservations/{id}/complete', [ReservationController::class, 'complete']);
            Route::patch('reservations/{id}/cancel', [ReservationController::class, 'cancel']);
            Route::patch('reservations/{id}/no_show', [ReservationController::class, 'noShow']);

            // Service logs
            Route::get('service-logs/summary', [ServiceLogController::class, 'summary']);
            Route::get('service-logs', [ServiceLogController::class, 'index']);
            Route::post('service-logs', [ServiceLogController::class, 'store']);
            Route::get('service-logs/{id}', [ServiceLogController::class, 'show']);
            Route::patch('service-logs/{id}', [ServiceLogController::class, 'update']);
            Route::delete('service-logs/{id}', [ServiceLogController::class, 'destroy']);
            Route::patch('service-logs/{id}/complete', [ServiceLogController::class, 'complete']);

            // Client Resources
            Route::get('client-resources', [ClientResourceController::class, 'index']);
            Route::post('client-resources', [ClientResourceController::class, 'store']);
            Route::get('client-resources/{id}', [ClientResourceController::class, 'show']);
            Route::patch('client-resources/{id}', [ClientResourceController::class, 'update']);
            Route::delete('client-resources/{id}', [ClientResourceController::class, 'destroy']);
            Route::get('client-resources/{id}/history', [ClientResourceController::class, 'history']);

            // Services
            Route::get('services', [ServiceController::class, 'index']);
            Route::post('services', [ServiceController::class, 'store']);
            Route::put('services/{id}', [ServiceController::class, 'update']);
            Route::delete('services/{id}', [ServiceController::class, 'destroy']);

            // Users
            Route::get('users', [UserController::class, 'index']);
            Route::post('users/invite', [UserController::class, 'store']);
            Route::get('users/{id}', [UserController::class, 'show']);
            Route::patch('users/{id}/role', [UserController::class, 'updateRole']);

            // Reports
            Route::get('reports/daily', [ReportController::class, 'daily']);
            Route::get('reports/range', [ReportController::class, 'range']);
            Route::get('reports/weekly', [ReportController::class, 'weekly']);
            Route::get('reports/monthly', [ReportController::class, 'monthly']);

            // Uploads
            Route::post('uploads', [UploadController::class, 'store']);

            // Tenant gallery images
            Route::get('tenant/images', [TenantImageController::class, 'index']);
            Route::post('tenant/images', [TenantImageController::class, 'store']);
            Route::delete('tenant/images/{id}', [TenantImageController::class, 'destroy']);
            Route::post('tenant/images/reorder', [TenantImageController::class, 'reorder']);

            // Availability slots (weekly schedule)
            Route::get('availability-slots', [\App\Infrastructure\Http\Controllers\AvailabilitySlotController::class, 'index']);
            Route::put('availability-slots', [\App\Infrastructure\Http\Controllers\AvailabilitySlotController::class, 'bulkUpdate']);

            // Availability blocks
            Route::get('availability-blocks', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'index']);
            Route::post('availability-blocks', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'store']);
            Route::delete('availability-blocks/{id}', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'destroy']);
        });

        // Super admin routes
        Route::middleware('super_admin')->prefix('superadmin')->group(function () {
            Route::get('tenants', [SuperAdminController::class, 'index']);
            Route::patch('tenants/{id}/suspend', [SuperAdminController::class, 'suspend']);
            Route::patch('tenants/{id}/activate', [SuperAdminController::class, 'activate']);
            Route::get('users', [SuperAdminController::class, 'users']);
            Route::get('stats', [SuperAdminController::class, 'stats']);

            Route::get('categories', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'index']);
            Route::post('categories', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'store']);
            Route::patch('categories/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'update']);
            Route::delete('categories/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'destroy']);
        });
    });
});
