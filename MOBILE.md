# Pranjal's Universe — Mobile & PWA Architecture

## Responsive & Mobile-First Strategy
The application is engineered for touch interaction across standard mobile screen sizes (360x800, 390x844, 430x932, 768x1024 tablets, and desktop resolutions).

## Progressive Web App (PWA)
- **Manifest**: Located at `public/manifest.json` with standalone display mode and dark theme background (`#09090b`).
- **Icons**:
  - `public/icon-192.png` (192x192 high-DPI maskable app icon)
  - `public/icon-512.png` (512x512 high-resolution splash icon)

## Hardware Integration
- **WebRTC Camera API**: Direct hardware camera stream with front-facing (selfie) and rear-facing (environment) switching via `facingMode: { ideal: "user" }` and `facingMode: { ideal: "environment" }`.
- **MediaRecorder API**: 1080p video clip recording and voice memo audio capture with native microphone streams.
- **Geolocation API**: Device GPS coordinates captured at snap time with high accuracy mode enabled.
- **IndexedDB Offline Queue (`src/lib/offlineQueue.ts`)**: Captures taken while offline or in transit are buffered locally in browser IndexedDB and automatically synchronized to the backend when network connectivity is restored.
