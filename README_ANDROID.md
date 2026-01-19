# Android Release Documentation

Complete guide for releasing "City In A Snowglobe" to Google Play Store.

## 📋 Quick Navigation

### 🚀 Getting Started
1. **[docs/android/getting-started/QUICK_START.md](docs/android/getting-started/QUICK_START.md)** - Start here! Step-by-step setup from zero to AAB
2. **[docs/android/getting-started/ANDROID_RELEASE_SUMMARY.md](docs/android/getting-started/ANDROID_RELEASE_SUMMARY.md)** - Overview of approach and files
3. **[docs/android/getting-started/ANDROID_RELEASE_GUIDE.md](docs/android/getting-started/ANDROID_RELEASE_GUIDE.md)** - Approach analysis (TWA vs Capacitor)

### ⚙️ Configuration
4. **[docs/android/configuration/BUILD_COMMANDS.md](docs/android/configuration/BUILD_COMMANDS.md)** - All build commands and workflows
5. **[docs/android/configuration/SIGNING_SETUP.md](docs/android/configuration/SIGNING_SETUP.md)** - Keystore creation and signing configuration
6. **[docs/android/configuration/ICON_SPLASH_SETUP.md](docs/android/configuration/ICON_SPLASH_SETUP.md)** - App icon and splash screen generation
7. **[docs/android/configuration/POST_SETUP_CHANGES.md](docs/android/configuration/POST_SETUP_CHANGES.md)** - Exact file changes after `npx cap add android`

### 🏪 Play Store Submission
8. **[docs/android/play-store/PLAY_STORE_CHECKLIST.md](docs/android/play-store/PLAY_STORE_CHECKLIST.md)** - Complete Play Store release checklist

### 📄 Templates & References
- **[docs/android/templates/android-manifest-template.xml](docs/android/templates/android-manifest-template.xml)** - AndroidManifest.xml reference
- **[docs/android/templates/build.gradle.template](docs/android/templates/build.gradle.template)** - Gradle build configuration reference
- **[docs/android/configuration/assets.config.json](docs/android/configuration/assets.config.json)** - Asset generation configuration

---

## 🎯 Recommended Reading Order

### For First-Time Setup:
1. Read `docs/android/getting-started/ANDROID_RELEASE_SUMMARY.md` (5 min) - Understand the approach
2. Follow `docs/android/getting-started/QUICK_START.md` (30 min) - Initial setup
3. Read `docs/android/configuration/POST_SETUP_CHANGES.md` (10 min) - Make required file changes
4. Follow `docs/android/configuration/SIGNING_SETUP.md` (15 min) - Set up signing
5. Follow `docs/android/configuration/ICON_SPLASH_SETUP.md` (10 min) - Generate assets
6. Follow `docs/android/configuration/BUILD_COMMANDS.md` (10 min) - Build your first AAB
7. Follow `docs/android/play-store/PLAY_STORE_CHECKLIST.md` (60 min) - Submit to Play Store

### For Quick Reference:
- **Building**: `docs/android/configuration/BUILD_COMMANDS.md`
- **Signing**: `docs/android/configuration/SIGNING_SETUP.md`
- **Play Store**: `docs/android/play-store/PLAY_STORE_CHECKLIST.md`

---

## ✅ What's Included

### ✅ Approach Analysis
- Detailed comparison: TWA vs Capacitor
- Recommendation: **Capacitor** (with justification)
- Why Capacitor is better for this app

### ✅ Complete Configuration
- Capacitor setup (`capacitor.config.js`)
- Package.json updates (dependencies + scripts)
- Android manifest permissions
- Gradle build configuration
- Signing setup

### ✅ Asset Generation
- Icon generation (1024x1024 → all densities)
- Splash screen setup
- Adaptive icon configuration

### ✅ Build System
- Debug build commands
- Release APK build
- Release AAB build (for Play Store)
- Version management

### ✅ Play Store Submission
- Developer account setup
- Play App Signing configuration
- Data Safety form completion
- Store listing requirements
- Content rating
- Release tracks (Internal → Production)
- Common rejection fixes

---

## 🔑 Key Information

### App Configuration
- **App ID**: `com.estherjoseph.citysnowglobe`
- **App Name**: City In A Snowglobe
- **Min SDK**: 23 (Android 6.0) - Required for WebXR
- **Target SDK**: 33+ (Latest)

### Required Permissions
- `INTERNET` - Weather API calls
- `ACCESS_NETWORK_STATE` - Connectivity check
- `CAMERA` (optional) - AR mode
- Device motion sensors (for shake detection)

### Build Output
- **AAB**: `android/app/build/outputs/bundle/release/app-release.aab`
- **APK**: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🛠️ Prerequisites

Before starting:
- ✅ Node.js 18+ installed
- ✅ Android Studio installed
- ✅ Android SDK (API 33+)
- ✅ Google Play Developer account ($25)
- ✅ OpenWeatherMap API key configured

---

## 📝 Quick Command Reference

```bash
# Initial setup
npm install
npx cap init
npx cap add android

# Development
npm run build
npx cap sync android
npx cap open android

# Release build
export KEYSTORE_PASSWORD="your_password"
export KEY_PASSWORD="your_password"
npm run android:bundle
```

---

## 🆘 Troubleshooting

### Common Issues

**"SDK location not found"**
- Set `ANDROID_HOME` environment variable
- See `docs/android/configuration/BUILD_COMMANDS.md`

**"Gradle build failed"**
- Open in Android Studio: `npx cap open android`
- Let Gradle sync complete
- See `docs/android/configuration/BUILD_COMMANDS.md`

**"Keystore not found"**
- Verify path in `build.gradle`
- Check environment variables
- See `docs/android/configuration/SIGNING_SETUP.md`

**"Permission not declared"**
- Check `AndroidManifest.xml`
- See `docs/android/configuration/POST_SETUP_CHANGES.md`

---

## 📞 Support Resources

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Android Developer**: https://developer.android.com
- **Play Console Help**: https://support.google.com/googleplay/android-developer
- **Play Policy**: https://play.google.com/about/developer-content-policy/

---

## 🎉 Next Steps

1. **Start with `docs/android/getting-started/QUICK_START.md`** - Get set up in 30 minutes
2. **Follow `docs/android/play-store/PLAY_STORE_CHECKLIST.md`** - Submit to Play Store
3. **Monitor and iterate** - Use Play Console analytics

Good luck with your Android release! 🚀

---

## 📄 File Structure

```
.
├── README_ANDROID.md                                    # This file (master index)
├── capacitor.config.js                                  # Capacitor configuration
├── docs/
│   └── android/
│       ├── getting-started/
│       │   ├── QUICK_START.md                          # Quick setup guide
│       │   ├── ANDROID_RELEASE_SUMMARY.md              # Overview
│       │   └── ANDROID_RELEASE_GUIDE.md                # Approach analysis
│       ├── configuration/
│       │   ├── BUILD_COMMANDS.md                       # Build instructions
│       │   ├── SIGNING_SETUP.md                        # Signing configuration
│       │   ├── ICON_SPLASH_SETUP.md                    # Asset generation
│       │   ├── POST_SETUP_CHANGES.md                   # File changes needed
│       │   └── assets.config.json                      # Asset config
│       ├── play-store/
│       │   └── PLAY_STORE_CHECKLIST.md                 # Play Store submission
│       └── templates/
│           ├── android-manifest-template.xml           # Manifest reference
│           └── build.gradle.template                   # Gradle reference
```

---

**Last Updated**: 2024
**Capacitor Version**: 6.x
**Target Android**: API 33+

