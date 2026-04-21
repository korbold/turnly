# Push Notifications System — Design Spec

**Date:** 2026-04-20
**Status:** Approved
**Scope:** Phase 1 — Infrastructure + Reservation Lifecycle

## Overview

Push notification system for Turnly using Firebase Cloud Messaging (FCM) HTTP v1 API with Laravel's built-in notification system. Covers two clients: `customer_v2` (Flutter Android) and `admin-v2` (Next.js web). Includes in-app notification inbox on both platforms.

**Firebase Project:** Turnly-services (`turnly-services`, #624883049252)

## Multi-Tenant Model

- **Tenant admin** sends push only to their own clients (scoped by `tenant_id`)
- **Super admin** can broadcast to all users globally (batch FCM, chunks of 500)

## Data Model

### Table: `device_tokens`

| Column     | Type              | Notes                                      |
|------------|-------------------|--------------------------------------------|
| id         | ULID PK           |                                            |
| user_id    | FK → users        | nullable                                   |
| tenant_id  | FK → tenants      |                                            |
| platform   | enum              | `android`, `ios`, `web`                    |
| token      | string            | FCM registration token, unique             |
| is_active  | boolean           | default true, false on invalid token       |
| created_at | timestamp         |                                            |
| updated_at | timestamp         |                                            |

**Indexes:**
- Composite: `(user_id, platform)`
- Unique: `(token)`

### Table: `notifications` (Laravel built-in)

| Column          | Type      | Notes                          |
|-----------------|-----------|--------------------------------|
| id              | UUID PK   |                                |
| type            | string    | Notification class name        |
| notifiable_type | string    | `UserModel`                    |
| notifiable_id   | ULID      |                                |
| data            | JSON      | title, body, action metadata   |
| read_at         | timestamp | nullable                       |
| created_at      | timestamp |                                |

**Index:** `(notifiable_type, notifiable_id, read_at)` for inbox with read/unread filter.

### Notification `data` JSON Structure

```json
{
  "title": "Reserva confirmada",
  "body": "Tu reserva para Corte de pelo es el 21 Abr a las 10:00",
  "action_type": "reservation_detail",
  "action_id": "01JRX...",
  "tenant_id": "01JRX...",
  "tenant_name": "Barbería X",
  "icon": "calendar_check"
}
```

## Backend Architecture (Laravel)

### File Structure

```
app/Infrastructure/Notifications/
├── Channels/
│   └── FcmChannel.php              — sends push via FCM HTTP v1 API
├── Services/
│   └── FcmService.php              — HTTP client for FCM, token mgmt, batch send
├── Notifications/
│   ├── ReservationConfirmed.php
│   ├── ReservationCancelled.php
│   ├── ReservationModified.php
│   └── NewReservationForAdmin.php
└── DeviceToken/
    ├── RegisterDeviceTokenAction.php
    └── DeactivateDeviceTokenAction.php
```

### Send Flow

```
Event (e.g. ReservationCreated)
  → Listener dispatches Notification
    → via(database, fcm)
      → database: saves to notifications table (inbox)
      → FcmChannel: queries device_tokens for user → FcmService::send()
        → FCM HTTP v1 API (POST https://fcm.googleapis.com/v1/projects/turnly-services/messages:send)
        → Invalid token (410/404) → DeactivateDeviceTokenAction
```

### Firebase Auth

- Service account JSON at `storage/app/firebase/service-account.json`
- Env var `FIREBASE_CREDENTIALS` points to path
- Env var `FIREBASE_PROJECT_ID=turnly-services`
- OAuth2 token via service account for FCM HTTP v1 API auth

### Queue

- Change `QUEUE_CONNECTION=database`
- All notifications implement `ShouldQueue`
- Migrations for `jobs` and `failed_jobs` tables

### API Endpoints

| Method | Path                            | Description                    | Auth     |
|--------|---------------------------------|--------------------------------|----------|
| POST   | `/api/device-tokens`            | Register device token          | Required |
| DELETE | `/api/device-tokens/{token}`    | Unregister device token        | Required |
| GET    | `/api/notifications`            | List inbox (paginated, filter) | Required |
| POST   | `/api/notifications/{id}/read`  | Mark as read                   | Required |
| POST   | `/api/notifications/read-all`   | Mark all as read               | Required |

### Events → Notifications

| Event                  | Notify Target      | Notification Class           |
|------------------------|--------------------|-----------------------------|
| ReservationConfirmed   | Client             | ReservationConfirmed        |
| ReservationCancelled   | Client + Admin     | ReservationCancelled        |
| ReservationModified    | Client + Admin     | ReservationModified         |
| ReservationCreated     | Tenant Admin       | NewReservationForAdmin      |

### Multi-Tenant Scoping

- Device tokens always scoped by `tenant_id`
- Admin notifications: query tokens where `user.role = admin/owner` AND `tenant_id = X`
- Super admin broadcast: query all active tokens, batch FCM in chunks of 500

## Customer_v2 (Flutter)

### New Dependencies

```yaml
firebase_core: ^3.8.1
firebase_messaging: ^15.1.6
flutter_local_notifications: ^18.0.0
```

### File Structure

```
lib/features/notifications/
├── data/
│   ├── datasources/
│   │   ├── notification_remote_datasource.dart   — API calls
│   │   └── notification_push_datasource.dart     — Firebase messaging setup
│   ├── models/
│   │   └── notification_model.dart
│   └── repositories/
│       └── notification_repository_impl.dart
├── domain/
│   ├── entities/
│   │   └── notification_entity.dart
│   ├── repositories/
│   │   └── notification_repository.dart
│   └── usecases/
│       ├── get_notifications.dart
│       ├── mark_as_read.dart
│       └── mark_all_as_read.dart
└── presentation/
    ├── screens/
    │   └── notifications_screen.dart             — replace mock data with real API
    ├── widgets/
    │   └── notification_tile.dart
    └── providers/
        └── notifications_provider.dart
```

### Push Flow

```
App start
  → FirebaseMessaging.instance.requestPermission()
  → FirebaseMessaging.instance.getToken()
  → POST /api/device-tokens {token, platform: 'android'}
  → Token refresh listener → update backend

Foreground message
  → flutter_local_notifications shows banner
  → Tap → navigate based on action_type

Background/Terminated message
  → onBackgroundMessage handler
  → Tap on notification tray → app opens to correct route
```

### In-App Inbox

- Replace mock data in existing `notifications_screen.dart`
- Pull-to-refresh + pagination
- Badge counter (unread count) in bottom nav or app bar
- Tap notification → mark as read + navigate to detail

### Firebase Config Files

- `android/app/google-services.json` — download from Firebase console after registering Android app
- `ios/Runner/GoogleService-Info.plist` — future iOS support

## Admin-v2 (Next.js Web Push)

### New Dependencies

```json
"firebase": "^11.0.0"
```

### File Structure

```
src/
├── lib/
│   └── firebase/
│       └── config.ts                    — Firebase app init (client-side)
├── services/
│   └── notifications/
│       ├── notification-service.ts      — API calls
│       └── push-service.ts             — FCM web token registration
├── components/
│   └── notifications/
│       ├── notification-bell.tsx        — bell icon + badge unread count
│       ├── notification-dropdown.tsx    — dropdown with recent list
│       ├── notification-item.tsx        — individual item
│       └── notification-page.tsx        — full inbox page
├── hooks/
│   └── use-notifications.ts            — polling/fetch, unread count
└── public/
    └── firebase-messaging-sw.js        — Service Worker for background push
```

### Web Push Flow

```
User login admin-v2
  → firebase/messaging getToken(vapidKey)
  → POST /api/device-tokens {token, platform: 'web'}
  → onMessage listener → show toast + update badge

Background (tab closed/minimized)
  → Service Worker firebase-messaging-sw.js receives push
  → Shows native browser notification
  → Click → opens admin-v2 to correct route
```

### VAPID Key

- Generate in Firebase Console → Cloud Messaging → Web Push certificates
- Env var `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- Firebase config env vars: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, etc.

### In-App Inbox

- Bell icon in header/navbar with unread badge count
- Dropdown shows last 5-10 notifications
- "View all" link → full paginated page
- Click notification → mark as read + navigate

### Browser Permissions

- Request push permission after first login (not on landing)
- If user denies → in-app inbox still works, just no push
- Store permission state to avoid re-asking

## Future Phases (Roadmap Only)

### Phase 2 — Reminders

- Scheduled command `notifications:send-reminders`
- Per-tenant configuration (how far ahead, on/off)
- Notification: `ReservationReminder`
- Laravel scheduler entry

### Phase 3 — Real-Time Queue/Turn

- Events: TurnApproaching, TurnReady
- Queue/turn logic triggers notification
- Possible broadcasting integration (WebSockets) for real-time admin view
