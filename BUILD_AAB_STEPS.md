# Build Android App Bundle (AAB) - Step by Step

## ✅ Step 1: Android Platform Added
The Android platform has been successfully added! The `android/` directory now exists.

## ⚠️ Step 2: Fix Java Version (If Needed)

Gradle 8.2.1 requires Java 11+. Check your Java version:

```bash
java -version
```

If you see Java 8, you need to install Java 11+:
- **macOS**: `brew install openjdk@11` or download from Oracle
- **Linux**: `sudo apt install openjdk-11-jdk`
- **Windows**: Download from Oracle or use Chocolatey

Set JAVA_HOME if needed:
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 11)  # macOS
```

## 🔐 Step 3: Create Signing Keystore

**IMPORTANT**: You'll be prompted for certificate information. Have this ready:
- Your name or company name
- Organization name
- City, State, Country code (e.g., "US")

Run this command (you'll be prompted for passwords and certificate info):

```bash
cd android
mkdir -p keystore

keytool -genkeypair -v -storetype PKCS12 \
  -keystore keystore/citysnowglobe-release.keystore \
  -alias citysnowglobe -keyalg RSA -keysize 2048 -validity 10000
```

**Note**: When prompted:
- Enter a **keystore password** (save this securely!)
- Re-enter the password
- Enter a **key password** (can be same as keystore password, save this too!)
- Answer the certificate questions

**For testing, you can use these values:**
- Password: `android` (change for production!)
- Name: `City In A Snowglobe`
- Organization: `Your Name`
- City: `Your City`
- State: `Your State`
- Country: `US` (or your country code)

## ⚙️ Step 4: Configure Signing in build.gradle

Edit `android/app/build.gradle` and add the signing configuration. See `docs/android/configuration/POST_SETUP_CHANGES.md` for exact location.

Add this inside the `android { }` block:

```gradle
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
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

## 🏗️ Step 5: Build the AAB

Once signing is configured:

```bash
# Set environment variables (use the passwords you set when creating keystore)
export KEYSTORE_PASSWORD="your_keystore_password"
export KEY_PASSWORD="your_key_password"

# Build web app and sync
npm run build
npx cap sync android

# Build the AAB
cd android
./gradlew bundleRelease
```

Or use the npm script:
```bash
export KEYSTORE_PASSWORD="your_keystore_password"
export KEY_PASSWORD="your_key_password"
npm run android:bundle
```

## 📦 Step 6: Find Your AAB

The AAB will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## 📤 Step 7: Upload to Play Console

1. Go to https://play.google.com/console
2. Create new app (or select existing)
3. Go to **Testing > Internal testing**
4. Click **Create new release**
5. Upload `app-release.aab`
6. Add release notes (e.g., "Initial release for internal testing")
7. Save and review
8. Add testers (email addresses)

## 🧪 Step 8: Test

Testers will receive an email with opt-in link. They can install and test the app.

## 📚 Full Documentation

- **Signing Setup**: `docs/android/configuration/SIGNING_SETUP.md`
- **Build Commands**: `docs/android/configuration/BUILD_COMMANDS.md`
- **Play Store Checklist**: `docs/android/play-store/PLAY_STORE_CHECKLIST.md`

## ⚠️ Troubleshooting

**"Java version error":**
- Ensure Java 11+ is installed and JAVA_HOME is set

**"Keystore not found":**
- Verify keystore exists at `android/keystore/citysnowglobe-release.keystore`
- Check environment variables are set

**"Gradle sync failed":**
- Open in Android Studio: `npx cap open android`
- Let Gradle sync complete
- Check for dependency conflicts

**"Signing config not found":**
- Verify signing config is in `android/app/build.gradle`
- Check environment variables are exported

