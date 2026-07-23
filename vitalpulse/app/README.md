# VitalPulse (mobile app)

Cross-platform (iOS + Android) pulse/HRV wellness tracker and honest blood-pressure
logbook, built with Expo + React Native + TypeScript. See `../PRODUCT_DESIGN.md`
for the product rationale and market research this app is built on.

## What it does

- **Pulse Check** — camera + flash photoplethysmography (PPG) estimates heart
  rate and HRV from your fingertip (`src/sensors/ppgSampler.ts`,
  `src/sensors/pulseAnalysis.ts`, `src/sensors/pngPixel.ts`). Every result is
  labeled with a signal-quality grade instead of a single always-confident
  number.
- **Blood Pressure Log** — manual entry from the user's own cuff. The app never
  claims to measure blood pressure from a sensor.
- **Trends** — 7/30/90-day charts plus CSV export for a doctor.
- **Settings** — text-size steps, high-contrast theme, daily reminder,
  left-hand camera mode, export/delete all data.
- All data lives in a local SQLite database (`src/storage/db.ts`) — no
  account, no server, no network calls anywhere in this app.

## Running it

```bash
npm install
npm run ios      # or: npm run android / npm run web
```

You'll need Xcode (for iOS) or Android Studio (for Android) installed
locally, or the Expo Go app on a physical device for quick iteration
(camera features require a real device — simulators/emulators have no
camera feed to test PPG against).

## Verifying it

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest — unit tests for the signal-processing pipeline
npx expo-doctor      # validates the Expo/dependency configuration
```

`npx expo export --platform ios` / `--platform android` produces a Metro/Hermes
bundle without needing a simulator, which is a fast way to confirm the app
still compiles end-to-end after a change.

## Publishing to the App Store / Google Play

This repo has the app; publishing needs your own developer accounts:

1. Apple Developer Program account ($99/yr) and a Google Play Console account
   ($25 one-time).
2. Install [EAS CLI](https://docs.expo.dev/eas/) (`npm i -g eas-cli`), run
   `eas login`, then `eas build --platform all` to produce signed binaries.
3. `eas submit` to upload to App Store Connect / Google Play Console, or
   upload the binaries manually.
4. Fill in each store's health-app / camera-permission disclosure sections
   using the language in `NSCameraUsageDescription` (`app.json`) and the
   "How this works" screen in-app — both already state plainly that this is
   a wellness estimate, not a medical device.

Update `ios.bundleIdentifier` / `android.package` in `app.json` from the
placeholder `com.vitalpulse.app` to your own identifier before building.
