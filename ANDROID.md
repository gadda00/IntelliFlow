# Akili — Android App (Play Store) Deployment Guide

This guide walks you through building the Akili Android APK and AAB (Android App Bundle) for the Google Play Store.

Akili is a **Progressive Web App (PWA)** that's wrapped as a **Trusted Web Activity (TWA)** using Google's [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap). This means:

- ✅ One codebase (your Next.js PWA)
- ✅ Full Play Store presence (installable, discoverable)
- ✅ Native app shell (no browser chrome)
- ✅ Push notifications support
- ✅ Splash screen with your branding
- ✅ App shortcuts (long-press menu)

---

## Prerequisites

### 1. Java Development Kit (JDK) 17+
```bash
# Check if you have Java
java -version

# Install if needed (Ubuntu/Debian)
sudo apt install openjdk-17-jdk

# macOS
brew install openjdk@17
```

### 2. Android SDK
The easiest way is to install via Android Studio, but you can also use cmdline-tools:

```bash
# Option A: Android Studio (recommended)
# Download from https://developer.android.com/studio
# It will install the SDK automatically.

# Option B: Command-line tools only
mkdir -p ~/Android/Sdk/cmdline-tools
cd ~/Android/Sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip
mv cmdline-tools latest

# Set environment variables (add to ~/.bashrc or ~/.zshrc)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Accept licenses and install platform tools
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### 3. Bubblewrap CLI
```bash
npm install -g @bubblewrap/cli
```

### 4. Deploy the PWA First
The TWA wraps your deployed PWA, so you need your Akili site live on a public URL (e.g., Vercel).

```bash
# After deploying to Vercel, note your URL, e.g.:
# https://akili.vercel.app
```

---

## Build Steps

### Quick Build (Recommended)

```bash
# From the repo root:
PWA_URL=https://your-deployed-url.vercel.app ./scripts/build-android.sh
```

This will:
1. Initialize the TWA project from your PWA manifest
2. Download Android SDK components (if needed)
3. Build both APK and AAB
4. Sign them with a debug key

### Manual Step-by-Step

#### Step 1: Initialize the TWA Project

```bash
mkdir -p ~/akili-android
cd ~/akili-android

bubblewrap init \
  --manifest https://your-deployed-url.vercel.app/manifest.json \
  --name "Akili" \
  --packageId "ai.akili.app"
```

Bubblewrap will ask a few questions:
- **Application name**: Akili
- **Short name**: Akili
- **Launcher name**: Akili
- **Package ID**: ai.akili.app
- **Display mode**: standalone
- **Orientation**: default
- **Theme color**: #0a0f0d
- **Signing key**: (use default for first build)

#### Step 2: Build the APK and AAB

```bash
bubblewrap build
```

This produces:
- `app-release-signed.apk` — for testing on devices
- `app-release-bundle.aab` — for Play Store upload

#### Step 3: Test the APK

```bash
# Install on a connected device (enable USB debugging first)
adb install app-release-signed.apk

# Or share the APK file directly
```

---

## Play Store Upload

### 1. Create a Play Console Account
- Go to https://play.google.com/console
- Pay the one-time $25 registration fee
- Complete identity verification

### 2. Create a New App
- Click **Create app**
- App name: **Akili — Data Intelligence**
- Default language: English
- App type: **App**
- Pricing: Free (with in-app products for subscriptions)

### 3. Upload the AAB
- Go to **Production → Create release**
- Upload `app-release-bundle.aab`
- Add release notes

### 4. Complete the Store Listing

**App details:**
- **App name**: Akili — 20-Agent Data Intelligence
- **Short description** (80 chars): Twenty agents. One mind. AI data analysis in seconds.
- **Full description** (4000 chars):

```
Akili (Swahili for "intelligence") is a 20-agent AI data analysis platform that turns raw data into actionable insights in seconds.

Upload a CSV, JSON, or Excel file, and watch as 20 specialized AI agents run in parallel — profilers, forecasters, causal architects, privacy guardians, code generators — extracting every insight your data has to offer.

FEATURES:
• 20 AI agents in a parallel pipeline
• Anomaly detection (Z-score, IQR, EWMA ensemble)
• Holt-Winters time series forecasting with confidence intervals
• Causal inference (correlation + regression + Granger-style lag)
• PII detection with GDPR/HIPAA/PCI-DSS compliance scoring
• Synthetic data generation (privacy-preserving)
• Code generation in Python, SQL, and JavaScript
• Industry benchmark comparisons
• AI-powered narrative reports (GLM-4.6)
• Beautiful interactive charts
• PDF export
• Offline-capable PWA

USE CASES:
• Sales & revenue analysis
• Marketing attribution
• Operational metrics monitoring
• Quality assurance
• Forecasting & demand planning
• Privacy compliance auditing

PRICING:
• Free: 5 analyses/month, all 20 agents
• Professional: ₦15,000/mo ($29) — 50 analyses, API access
• Team: ₦50,000/mo ($99) — 200 analyses, 5 seats
• Enterprise: Custom — SSO, dedicated support

Built in Nairobi. Powered by 20 specialized AI agents.
```

- **App category**: Business
- **Tags**: analytics, ai, data, productivity, business intelligence

### 5. Upload App Assets

| Asset | Size | File |
|---|---|---|
| App icon | 512 × 512 PNG | `/public/icon-512.png` |
| Feature graphic | 1024 × 500 PNG | Generate from `/public/og-image.png` |
| Phone screenshots | 1080 × 1920 PNG | Take from analyzer results |
| Tablet screenshots | 1200 × 2000 PNG | Optional |

### 6. Privacy Policy
Required for Play Store. Create a page at `/privacy` and link it. Must cover:
- Data collection (file uploads are processed in-session)
- Payment processing (Flutterwave)
- Analytics (none by default; add PostHog if desired)
- User rights (GDPR/CCPA)

### 7. Data Safety Form
Fill out Google's data safety form:
- **Does your app collect user data?** Yes (email, name, analysis history)
- **Is data encrypted in transit?** Yes (HTTPS)
- **Can users request data deletion?** Yes

### 8. Target Audience
- Target audience: 18+ (business tool)
- Does not contain ads

### 9. Submit for Review
- Click **Send for review**
- Typical review time: 1-3 days for new apps
- Watch for email from Google Play

---

## Updating the App

When you release a new version:

```bash
# 1. Update version in twa-manifest.json
#    "appVersionCode": 32,  (increment)
#    "appVersionName": "3.2.0",

# 2. Rebuild
bubblewrap build

# 3. Upload new AAB to Play Console
#    Production → Create new release → Upload AAB
```

---

## Troubleshooting

### "Digital Asset Links verification failed"
The TWA needs to verify ownership of your domain. Bubblewrap generates `assetlinks.json` automatically. Make sure it's served at:
```
https://your-domain.com/.well-known/assetlinks.json
```

If verification fails, check:
1. The file is publicly accessible (no auth required)
2. The `packageId` in `twa-manifest.json` matches the `package_name` in `assetlinks.json`
3. The SHA-256 fingerprint matches your signing key

### "Android SDK not found"
```bash
# Set ANDROID_HOME
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Or install SDK
bubblewrap androidsdk install
```

### "Gradle build failed"
```bash
# Clean and rebuild
cd android-twa
./gradlew clean
./gradlew bundleRelease
```

### "Signing key issues"
For production, generate a proper release keystore:
```bash
keytool -genkeypair \
  -keystore akili-release.keystore \
  -alias akili \
  -keyalg RSA -keysize 2048 \
  -validity 10000

# Then reference it in twa-manifest.json
```

**⚠️ Keep this keystore safe.** If you lose it, you can never update the app on the Play Store.

---

## Production Checklist

Before submitting to Play Store:

- [ ] PWA deployed to production HTTPS URL
- [ ] `manifest.json` accessible at `/manifest.json`
- [ ] Service worker registered at `/sw.js`
- [ ] Icons: 192px, 512px, maskable 512px all served
- [ ] `assetlinks.json` served at `/.well-known/assetlinks.json`
- [ ] APK tested on a real device
- [ ] All permissions reviewed (TWA inherits PWA permissions)
- [ ] Privacy policy published
- [ ] Screenshots captured (1080×1920)
- [ ] Feature graphic created (1024×500)
- [ ] App description written
- [ ] Signing keystore backed up securely

---

## Resources

- [Bubblewrap documentation](https://github.com/GoogleChromeLabs/bubblewrap)
- [TWA requirements](https://developers.google.com/web/updates/2019/02/using-twa)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [Digital Asset Links tool](https://developers.google.com/digital-asset-links/tools/generator)

---

**Built in Nairobi. Wrapped for the world.**
