# Android App Bundle Build Status

## ✅ Completed

1. **Android Platform Added** ✓
   - The `android/` directory has been created
   - Capacitor Android integration is complete
   - Web assets have been copied to Android project

2. **Web App Built** ✓
   - Production build exists in `dist/` folder
   - All assets are ready

## ⚠️ Action Required

### 1. Install Java 11+ (Required)

**Current Status**: Java 8 is installed, but Gradle 8.2.1 requires Java 11+

**Fix**:
```bash
# macOS (using Homebrew)
brew install openjdk@11

# Then set JAVA_HOME
export JAVA_HOME=$(/usr/libexec/java_home -v 11)

# Verify
java -version  # Should show version 11 or higher
```

**Alternative**: Download Java 11+ from:
- Oracle: https://www.oracle.com/java/technologies/downloads/
- Adoptium: https://adoptium.net/

### 2. Create Signing Keystore (Required for Release)

You need to create a keystore file. This requires interactive input:

```bash
cd android
mkdir -p keystore

keytool -genkeypair -v -storetype PKCS12 \
  -keystore keystore/citysnowglobe-release.keystore \
  -alias citysnowglobe -keyalg RSA -keysize 2048 -validity 10000
```

**You'll be prompted for:**
- Keystore password (save this!)
- Key password (save this!)
- Your name
- Organization
- City, State, Country

**Save the passwords securely** - you'll need them for all future releases!

### 3. Configure Signing in build.gradle

After creating the keystore, add signing config to `android/app/build.gradle`:

```gradle
android {
    // ... existing code ...
    
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
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

## 🚀 Once Above Steps Are Complete

Build the AAB:

```bash
# Set passwords (use the ones you set when creating keystore)
export KEYSTORE_PASSWORD="your_keystore_password"
export KEY_PASSWORD="your_key_password"

# Build
npm run android:bundle
```

The AAB will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## 📋 Quick Checklist

- [ ] Install Java 11+
- [ ] Create signing keystore
- [ ] Add signing config to `android/app/build.gradle`
- [ ] Set environment variables (KEYSTORE_PASSWORD, KEY_PASSWORD)
- [ ] Run `npm run android:bundle`
- [ ] Upload AAB to Play Console Internal Testing

## 📚 Detailed Guides

- **Full Build Guide**: `BUILD_AAB_STEPS.md`
- **Signing Setup**: `docs/android/configuration/SIGNING_SETUP.md`
- **Play Store Upload**: `docs/android/play-store/PLAY_STORE_CHECKLIST.md`

## ⚡ Quick Start (After Java 11+ Installed)

```bash
# 1. Create keystore (interactive)
cd android && mkdir -p keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore keystore/citysnowglobe-release.keystore \
  -alias citysnowglobe -keyalg RSA -keysize 2048 -validity 10000

# 2. Add signing config to android/app/build.gradle (see above)

# 3. Build AAB
export KEYSTORE_PASSWORD="your_password"
export KEY_PASSWORD="your_password"
npm run android:bundle
```

---

**Current Blocker**: Java 11+ installation required before building.

