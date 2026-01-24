# Quick Setup: Android Platform for AAB Build

## Issue
Capacitor CLI is having trouble reading the `capacitor.config.js` file. Here are two solutions:

## Solution 1: Use JSON Config (Recommended)

1. **Temporarily rename the JS config:**
   ```bash
   mv capacitor.config.js capacitor.config.js.backup
   ```

2. **Use the existing JSON config** (already created):
   ```bash
   # capacitor.config.json should already exist
   npx cap add android
   ```

3. **If that works, you can keep using JSON or switch back to JS later**

## Solution 2: Manual Android Setup

If Solution 1 doesn't work, you can manually create the Android project:

1. **Install Android Studio** (if not already installed)
2. **Open Android Studio**
3. **Create New Project** → **Empty Activity**
4. **Configure:**
   - Name: City In A Snowglobe
   - Package: com.estherjoseph.citysnowglobe
   - Language: Java or Kotlin
   - Minimum SDK: 23 (Android 6.0)
5. **Then integrate Capacitor manually** or use the generated project structure

## Solution 3: Fix Config Reading Issue

The config file is correct. Try:

```bash
# Clear any caches
rm -rf node_modules/.cache
rm -rf .capacitor

# Try again
npx cap add android
```

## After Android Platform is Added

Once `android/` directory exists, proceed with:

1. **Set up signing** (see `docs/android/configuration/SIGNING_SETUP.md`)
2. **Build AAB** using the commands in `BUILD_AAB_GUIDE.md`

## Quick Test

To verify the config is readable:
```bash
node -e "import('./capacitor.config.js').then(m => console.log('AppId:', m.default.appId))"
```

This should output: `AppId: com.estherjoseph.citysnowglobe`

If this works, the config is fine and it's a Capacitor CLI issue.

