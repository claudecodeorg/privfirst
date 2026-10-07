# Publishing PrivFirst on Google Play

The Android app is a **native app built with Capacitor** (`capacitor.config.ts`, `android/`) that
wraps the same web code as the live site — not a Trusted Web Activity, so it has no address bar,
no dependency on the live site being reachable, and critically: **no internet permission at all**.
It is fully offline by design; see "App permissions" below and `docs/android-permissions.txt` for
the exact, enforced list.

The paywall (`src/lib/billing.ts` + `src/lib/billing.native.ts`, UI in
`src/components/Paywall.tsx`) only activates when `Capacitor.isNativePlatform()` is true, which is
never the case on the live web site — confirmed in `src/lib/billing.test.ts` /
`billing.native.test.ts` and by hand in a real browser. The free web app is unaffected by any of
this.

**There is no server-side purchase verification, by design** — this project has no backend at
all. Entitlement is whatever the Google Play Billing Library reports on-device, cached locally
(`privfirst.entitledCache` in localStorage) so the app keeps working **offline** after a purchase.
This is a deliberate trade-off: a $1 one-time product doesn't justify running a server, and the
client-side check is what Play's own Billing Library is designed to support for exactly this case.
The practical implication is that a sufficiently motivated user could tamper with a rooted device
to fake entitlement — accepted as out of scope for this app's value.

## 1. Prerequisites

- **Google Play Developer account** — $25 one-time, at
  [play.google.com/console](https://play.google.com/console/). Needs your identity. **New
  personal accounts must complete a closed test with 12+ testers for 14 continuous days before
  Google allows a production release** — start this account and that test track early; it's the
  slowest part of the timeline, not the app build itself.
- **JDK 21** and the **Android SDK** (cmdline-tools, platform 36, build-tools 36.0.0) — already
  set up in this environment under `~/android-sdk` for development. On your own machine, Android
  Studio installs all of this for you.
- Do the **signing** step (section 3) on your own machine, not in a shared session — it produces
  a private key that must never be exposed.

## 2. Build

From the project root:

```sh
npm run build:android   # tsc --noEmit && CAP_BUILD=1 vite build && cap sync android
cd android
./gradlew bundleRelease # produces an UNSIGNED app-release.aab
```

`npm run android:debug` builds a debug APK instead (`android/app/build/outputs/apk/debug/`), useful
for installing on a test device via `adb install` without any signing at all.

Before uploading anywhere, verify the permission allowlist still holds — this fails the build if
anything (a future dependency bump, a new plugin) quietly adds back a permission like `INTERNET`:

```sh
npm run android:check-permissions
```

It currently passes with exactly: `android.permission.CAMERA` (optional live QR scan, requested
only on tap), `com.android.vending.BILLING` (Play Billing), and
`in.runhatlabs.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (a harmless, signature-level,
self-declared permission AndroidX uses internally to secure its own dynamically-registered
broadcast receivers — not a capability grant of any kind).

## 3. Signing — do this on your own machine

Google Play requires every release to be signed. The modern approach is **Play App Signing**:
you generate a local **upload key** (not the final signing key — Play re-signs with its own key
after you upload), sign the AAB with it, and Play Console asks for it once on your very first
upload.

```sh
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

**Back up `upload-keystore.jks` and its password immediately** — a password manager's file
storage or an encrypted disk backup, not just this machine. Losing it means contacting Google
Play support to reset your upload key, which is possible but slow; it is not as catastrophic as
losing a classic (non-Play-App-Signing) release key, but still worth avoiding.

Sign the AAB built in section 2:

```sh
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore upload-keystore.jks \
  android/app/build/outputs/bundle/release/app-release.aab upload
```

(Or configure a `signingConfig` in `android/app/build.gradle` pointing at the keystore and re-run
`./gradlew bundleRelease` — equivalent, just automated. Either way, keep the keystore itself out of
this repository.)

## 4. Play Console: create the app

- **Store listing**: name, short/full description, icon (512×512), at least 2 screenshots (phone
  size), a feature graphic.
- **Privacy policy URL**:
  `https://claudecodeorg.github.io/privfirst/privacy.html` (already live, and already describes
  the Android app's permissions and purchase flow).
- **Content rating questionnaire**, **Data safety form** — answer "no data collected"; the app
  genuinely has no server to send anything to. The form will ask about camera use (declare it as
  used, not collected/shared — frames are processed on-device only) and about purchases (declare
  the one-time product, processed by Google Play).
- **App content**: target audience, ads (none), etc.

## 5. Set up the one-time $1 product

In Play Console → **Monetize → Products → In-app products**:

- **Product ID**: `lifetime_access` — this **must exactly match** `LIFETIME_SKU` in
  `src/lib/billing.ts`. If you ever change one, change both and rebuild.
- **Type**: one-time product (not a subscription).
- **Price**: $1.00 (or your local equivalent; Play handles currency conversion and localized
  pricing — the app displays whatever price Play returns, never a hardcoded "$1").

Google's cut is roughly 15% for the first $1M/year of a developer's revenue (the standard
small-developer rate), so you keep about $0.85 per sale.

## 6. Test the purchase before going live

Play Console → **Setup → License testing**: add your own Google account as a license tester. Test
purchases from that account complete instantly without a real charge, so you can verify the whole
flow — trial expiry, the "Buy" button, Play's payment sheet, and that the app unlocks afterward —
before any real money is involved. A reinstall or a new device with the same Google account should
unlock immediately too, since Play Billing entitlements are tied to the account, not the device.

You can also exercise every Paywall UI state **without Play at all**, in a normal desktop browser
during development, via `npm run dev` and a `?mockBilling=` URL parameter: `trial`, `expired`,
`purchased`, or `unavailable` (e.g. `http://localhost:5173/?mockBilling=expired`). This mock path
is dev-only; `npm run build` / `build:android` strip it from the output entirely (`vite.config.ts`'s
`strip-mock-billing-in-build` plugin, double-checked by
`node scripts/check-no-mock-in-release.mjs <dist-dir>`).

## 7. Release

Upload the signed `.aab` to a **closed testing** track first (required for new accounts — see
section 1). After 14 days with your testers, promote the same build to **production**.

## Manual QA checklist (a real phone, a license-tester account)

Nothing in this list was verified in this shared session — there is no `/dev/kvm` here, so no
Android emulator is possible, and there's no physical device attached. Everything below needs a
real phone:

1. Install the debug APK (`adb install android/app/build/outputs/apk/debug/app-debug.apk`) or a
   signed build from a closed-testing track.
2. Confirm the app opens with **no visible paywall** for the first 24 hours (the trial).
3. Use every tool once; confirm "Download" / "Save" prompts Android's normal file-picker ("Save
   As…") rather than silently failing — this is the SAF path in `SaveFilePlugin.kt`.
4. QR Tools → "Scan with camera": confirm a permission prompt appears, scanning works, and
   stopping the scan doesn't keep the camera indicator active afterward.
5. Force the trial to expire — on a test build, `adb shell` can backdate it:
   `adb shell run-as in.runhatlabs.app sh -c "echo -n '0' > ..."` is fragile; simpler is to install,
   wait, or temporarily shorten `TRIAL_MS` in a local build for this test only (don't ship that).
   Confirm the "Your free day has ended" screen appears and blocks the app underneath it.
6. Tap "Buy lifetime access" as a **license tester** — confirm Play's payment sheet appears with
   the real configured price, completes instantly (no real charge), and the app unlocks.
7. Force-close and reopen the app — confirm it's still unlocked without re-prompting (this
   exercises `queryPurchases` + the offline entitlement cache).
8. Turn on airplane mode, reopen the app — confirm it stays unlocked (the offline-cache path in
   `checkEntitlement`).
9. From Play Console, refund the test purchase, then reopen the app while online — confirm it
   reverts to showing the expired screen (the "refund clears the cache" path).
10. Check `adb shell dumpsys package in.runhatlabs.app | grep permission` — confirm only the three
    permissions in `docs/android-permissions.txt` are granted/requested, matching what
    `npm run android:check-permissions` already confirmed against the build artifact.

## Ongoing: updating the app

Bump `versionCode` and `versionName` in `android/app/build.gradle`, rebuild
(`npm run build:android && cd android && ./gradlew bundleRelease`), and sign the new AAB with the
**same upload keystore** from section 3 before uploading. Play App Signing handles re-signing with
the final key automatically; you only ever need to keep the upload key consistent.
