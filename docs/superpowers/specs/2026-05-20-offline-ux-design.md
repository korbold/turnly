# Offline UX — Design Spec
**Date:** 2026-05-20
**App:** Turnly Customer (Flutter)
**Status:** Approved

---

## Problem

App silently fails when offline. API errors surface as generic messages with no system-level connectivity indicator. Users don't know whether the problem is their network or the service.

---

## Solution Overview

Option B: persistent top overlay banner (always visible while offline) + blocking modal for critical actions. Cached content (Hive) remains accessible offline without restriction.

---

## Architecture

### New package
- `connectivity_plus` — real-time network stream (Android + iOS)

### New files

```
lib/core/
  connectivity/
    connectivity_service.dart     — singleton, exposes Stream<bool> isOnline
    connectivity_cubit.dart       — BLoC wrapper
    connectivity_state.dart       — Online / Offline / Restored states
  widgets/
    offline_banner.dart           — global top overlay
    offline_action_gate.dart      — wrapper for critical actions
```

### Integration point

`TurnlyApp.build()` wraps `MaterialApp.router` in:
```
BlocProvider<ConnectivityCubit>
  └── Stack
        ├── MaterialApp.router   (existing)
        └── OfflineBanner        (overlay, positioned top)
```

Zero changes to routes, screens, or existing BLoC providers.

---

## ConnectivityService

- Wraps `connectivity_plus` `Connectivity().onConnectivityChanged` stream
- Validates with actual internet check (`InternetAddress.lookup`) — avoids false positives on captive portals
- Exposes `Stream<bool> isOnline` and `bool get currentStatus`

---

## ConnectivityCubit

### States

| State | Description |
|---|---|
| `ConnectivityOnline` | Network confirmed available |
| `ConnectivityOffline` | Network confirmed unavailable |
| `ConnectivityRestored` | Transient — emitted on reconnect, auto-transitions to Online after 1.5s |

### Behavior

- Initialized in `TurnlyApp` before `MaterialApp.router`
- Listens to `ConnectivityService.isOnline` stream
- On `false` → emits `ConnectivityOffline`
- On `true` (after offline) → emits `ConnectivityRestored`, then `ConnectivityOnline` after 1.5s

---

## OfflineBanner

### Visual spec

| Property | Value |
|---|---|
| Height | 48px |
| Background (offline) | `#1A1F2B` (zinc-noche) |
| Background (restored) | `#0F9D58` (verde-cita) |
| Text | white, 13px, w600 |
| Icon (offline) | `Icons.wifi_off`, 16px, white |
| Icon (restored) | `Icons.check_circle_outline`, 16px, white |
| X button touch target | 44×44px minimum |
| Border-radius | none (flush to top edge) |
| Position | Below status bar SafeArea, above all content |

### Animation (Emil spec)

| Event | Animation | Duration | Curve |
|---|---|---|---|
| Appear (offline) | `translateY(-100%)` → `translateY(0)` + opacity 0→1 | 220ms | ease-out `Curves.easeOut` |
| Disappear | `translateY(0)` → `translateY(-100%)` + opacity 1→0 | 160ms | ease-out (asymmetric: system responds fast) |
| Online→Offline color swap | background color transition | 150ms | linear |
| Reduced motion | opacity only, 150ms | 150ms | linear |

Reduced motion check: `MediaQuery.of(context).disableAnimations`

### State machine

```
[offline detected]
  → slide-down 220ms → show "Sin conexión a internet"
  → X button available

[user taps X]
  → slide-up 160ms
  → bannerDismissedByUser = true
  → on next offline event: reset flag, banner reappears

[network restored]
  → color swap to verde-cita
  → text changes to "Conectado"
  → auto-dismiss after 1.5s → slide-up 160ms
```

---

## OfflineActionGate

### Usage

```dart
OfflineActionGate(
  reason: 'para crear esta reserva',
  child: ElevatedButton(onPressed: _crearReserva, ...),
)
```

### Behavior

- Reads `ConnectivityCubit` state
- If `ConnectivityOffline`: intercepts tap, shows modal, does NOT execute child action
- If online: transparent pass-through, zero overhead

### Modal spec

| Property | Value |
|---|---|
| Card radius | 24px |
| Card background | `AppColors.surface` (white) |
| Scrim | `#1A1F2B` at 60% opacity |
| Icon container | 56×56px circle, `AppColors.warning` (#E89320) tinted bg, wifi_off white |
| Title | "Sin conexión", titleLarge, textPrimary |
| Body | "Necesitas internet [reason].", bodyMedium, textSecondary |
| CTA | "Entendido" pill button, coral, full-width |
| Entry animation | scale(0.95)+opacity(0) → scale(1)+opacity(1), 200ms ease-out |
| Reduced motion | opacity only, 150ms |

---

## Actions to protect with OfflineActionGate

| Screen | Action | Reason string |
|---|---|---|
| Reservations | Create reservation | "para crear esta reserva" |
| Reservations | Cancel reservation | "para cancelar esta reserva" |
| Explore | Initial load CTA | "para explorar negocios" |
| Auth | Login | "para iniciar sesión" |
| Auth | Register | "para crear tu cuenta" |
| Profile | Save changes | "para guardar tus cambios" |

Cached content (Hive favorites, loaded reservations list) accessible offline without restriction.

---

## Accessibility

- `Semantics(liveRegion: true)` on banner text — screen readers announce connectivity changes
- `Semantics(label: 'Cerrar aviso de sin conexión')` on X button
- Modal trap focus within dialog (`showDialog` handles this natively in Flutter)
- Color is never the only indicator — icon + text always present

---

## Constraints

- `connectivity_plus` requires `ACCESS_NETWORK_STATE` permission on Android (already granted by default for most apps; verify in AndroidManifest)
- iOS: no permission required for network monitoring
- captive portal false positives handled by DNS lookup validation in `ConnectivityService`
