# Publishing PrivFirst on Google Play

The Android app is the same web app at `https://claudecodeorg.github.io/privfirst/`,
wrapped in a **Trusted Web Activity (TWA)** — a thin native shell with no browser
address bar. You don't rewrite anything; you package the existing site.

The paywall (`src/lib/billing.ts`, `src/components/Paywall.tsx`) only activates
inside that packaged app. It detects this via `document.referrer` starting with
`android-app://`, which a normal browser tab never sets, so the free web version
is never affected — confirmed in `src/lib/billing.test.ts` and by hand in a
browser.

**Do the signing/build step on your own machine, not in a shared session.**
`bubblewrap build` generates an Android keystore — the private key that signs
every future update of this app. Losing it means you can never update the app
again and would have to publish under a new package name. It should exist only
on a machine you control, ideally backed up somewhere durable (a password
manager's file storage, encrypted disk backup, etc).

## 1. Prerequisites

- **Google Play Developer account** — $25 one-time, at
  [play.google.com/console](https://play.google.com/console/). Needs your
  identity. **New personal accounts must complete a closed test with 12+
  testers for 14 continuous days before Google allows a production release** —
  start this account and that test track early; it's the slowest part of the
  timeline, not the app build itself.
- **Node.js** (already on your machine if you can run this project).
- **JDK 17** and the **Android SDK** — Bubblewrap can install both for you the
  first time you run it (below), or point it at existing installs.

## 2. Generate the Android project

```sh
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://claudecodeorg.github.io/privfirst/manifest.webmanifest
```

It will ask a series of questions; these are the ones worth choosing deliberately:

- **Application ID**: a reverse-DNS package name, e.g. `dev.<you>.privfirst`.
  This is permanent — Play Store treats it as the app's identity forever.
- **App name**: `PrivFirst`.
- **Signing key**: let it generate a new keystore. **Set a strong password and
  back up the resulting `.keystore` file and password immediately** — see the
  warning above.

This creates a local Android project (not part of this repo — it's a separate
build artifact tied to your signing key).

## 3. Build and sign

```sh
bubblewrap build
```

This produces `app-release-signed.aab` — the file you upload to Play Console —
and prints the **SHA-256 fingerprint** of your signing key. Copy that
fingerprint; the next step needs it.

## 4. Verify domain ownership (Digital Asset Links)

Play won't trust the app to open without a URL bar until your site vouches for
it. Send me the SHA-256 fingerprint from step 3 and your chosen application ID,
and I'll add `public/.well-known/assetlinks.json` to this repo with:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "<your application ID>",
    "sha256_cert_fingerprints": ["<your SHA-256 fingerprint>"]
  }
}]
```

...then push, which deploys it to
`https://claudecodeorg.github.io/privfirst/.well-known/assetlinks.json`.

## 5. Play Console: create the app

- **Store listing**: name, short/full description, icon (512×512), at least 2
  screenshots (phone size), a feature graphic.
- **Privacy policy URL**:
  `https://claudecodeorg.github.io/privfirst/privacy.html` (already live).
- **Content rating questionnaire**, **Data safety form** (answer "no data
  collected" — this app genuinely doesn't collect anything; see the privacy
  policy for the exact wording to reuse).
- **App content**: target audience, ads (none), etc.

## 6. Set up the one-time $1 product

In Play Console → **Monetize → Products → In-app products**:

- **Product ID**: `lifetime_access` — this **must exactly match**
  `LIFETIME_SKU` in `src/lib/billing.ts`. If you ever change one, change both
  and redeploy.
- **Type**: one-time product (not a subscription).
- **Price**: $1.00 (or your local equivalent; Play handles currency
  conversion).

Google's cut is roughly 15% for the first $1M/year of a developer's revenue
(the standard small-developer rate), so you keep about $0.85 per sale.

## 7. Test the purchase before going live

Play Console → **Setup → License testing**: add your own Google account as a
license tester. Test purchases from that account complete instantly without a
real charge, so you can verify the whole flow — trial expiry, the "Buy" button,
Play's payment sheet, and that the app unlocks afterward — before any real
money is involved. A reinstall or a new device with the same Google account
should unlock immediately too, since Play Billing entitlements are tied to the
account, not the device.

## 8. Release

Upload the `.aab` to a **closed testing** track first (required for new
accounts — see step 1). After 14 days with your testers, promote the same
build to **production**.

## Ongoing: updating the app

Every future update **must be signed with the same keystore from step 2**.
When you change the web app, run `bubblewrap update` then `bubblewrap build`
again from the same local project, and upload the new `.aab`.
