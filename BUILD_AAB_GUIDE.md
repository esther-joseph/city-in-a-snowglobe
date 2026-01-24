# Building Android App Bundle (AAB) for Internal Testing

## Current Status

The Android platform needs to be set up. Follow these steps:

## Step 1: Verify Capacitor Config

The `capacitor.config.js` file exists and has the correct configuration:
- appId: `com.estherjoseph.citysnowglobe`
- appName: `City In A Snowglobe`
- webDir: `dist`

## Step 2: Add Android Platform

Run this command:
```bash
npx cap add android
```

If you get an error about missing appId, try:
```bash
# Delete capacitor.config.json if it exists
rm -f capacitor.config.json

# Ensure capacitor.config.js uses ES module format
# Then try again
npx cap add android
```

## Step 3: Set Up Signing (Required for Release)

Before building the AAB, you need to create a keystore:

```bash
cd android
mkdir -p keystore

keytool -genkeypair -v -storetype PKCS12 \
  -keystore keystore/citysnowglobe-release.keystore \
  -alias citysnowglobe -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_KEYSTORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD
```

**IMPORTANT**: Save these passwords securely! You'll need them for all future releases.

## Step 4: Configure Signing in build.gradle

After running `npx cap add android`, edit `android/app/build.gradle` and add:

```gradle
android {
    // ... existing config ...
    
    signingConfigs {
        release {
            if (System.getenv("KEYSTORE_PASSWORD")) {
                storeFile file("../keystore/citysnowglobe-release.keystore")
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias "citysnowglobe"
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            // ... other release config ...
        }
    }
}
```

See `docs/android/configuration/POST_SETUP_CHANGES.md` for complete instructions.

## Step 5: Build the AAB

Once signing is configured:

```bash
# Set environment variables
export KEYSTORE_PASSWORD="your_keystore_password"
export KEY_PASSWORD="your_key_password"

# Build and sync
npm run build
npx cap sync android

# Build AAB
cd android
./gradlew bundleRelease
```

Or use the npm script:
```bash
export KEYSTORE_PASSWORD="your_keystore_password"
export KEY_PASSWORD="your_key_password"
npm run android:bundle
```

## Step 6: Find Your AAB

The AAB will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## Step 7: Upload to Play Console

1. Go to https://play.google.com/console
2. Select your app (or create new app)
3. Go to **Testing > Internal testing**
4. Click **Create new release**
5. Upload the AAB file
6. Add release notes
7. Save and review

## Troubleshooting

**"Missing appId" error:**
- Ensure `capacitor.config.js` uses ES module format (`export default config`)
- Check that `appId` is set correctly
- Try deleting `capacitor.config.json` if it exists

**"Keystore not found" error:**
- Ensure keystore exists at `android/keystore/citysnowglobe-release.keystore`
- Check environment variables are set
- Verify path in `build.gradle`

**"Gradle build failed":**
- Open project in Android Studio: `npx cap open android`
- Let Gradle sync complete
- Check for dependency conflicts

## Next Steps

After successful build:
1. Test the AAB on a device (extract APK using bundletool)
2. Upload to Play Console Internal Testing
3. Add testers
4. Test for 1-2 days before production release

See `docs/android/play-store/PLAY_STORE_CHECKLIST.md` for complete Play Store submission guide.

