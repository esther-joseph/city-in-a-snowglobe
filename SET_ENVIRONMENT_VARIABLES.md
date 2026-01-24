# Setting Environment Variables for Android Build

## Where to Set Them

Set the environment variables in your **terminal/shell** (command line), in the **same session** where you'll run the build command.

## How to Set Them

### Option 1: Set in Terminal (Recommended for Security)

Open your terminal and run these commands **before** running `npm run android:bundle`:

```bash
# Navigate to project root (if not already there)
cd /Users/estherjoseph/dev/weather-city-3d-ar

# Set the environment variables
export KEYSTORE_PASSWORD="your_actual_keystore_password"
export KEY_PASSWORD="your_actual_key_password"

# Verify they're set (optional)
echo $KEYSTORE_PASSWORD
echo $KEY_PASSWORD

# Now build
npm run android:bundle
```

**Important**: 
- Replace `"your_actual_keystore_password"` with the actual password you used when creating the keystore
- Replace `"your_actual_key_password"` with the actual key password
- These variables only last for the current terminal session
- They won't persist after you close the terminal

### Option 2: Set in Same Command Line

You can set them and build in one go:

```bash
export KEYSTORE_PASSWORD="your_password" && \
export KEY_PASSWORD="your_password" && \
npm run android:bundle
```

### Option 3: Create a Build Script (Optional)

You could create a script file, but **don't commit passwords to git**:

```bash
# Create build script (don't commit this!)
cat > build-release.sh << 'EOF'
#!/bin/bash
export KEYSTORE_PASSWORD="your_password"
export KEY_PASSWORD="your_password"
npm run android:bundle
EOF

chmod +x build-release.sh
./build-release.sh
```

**Security Warning**: Never commit this script with real passwords to git!

## Where NOT to Set Them

- ❌ Don't put them in `package.json`
- ❌ Don't put them in `build.gradle` (hardcoded)
- ❌ Don't commit them to git
- ❌ Don't put them in a file that gets committed

## Why Terminal/Shell?

Environment variables set with `export` are:
- Available to all processes started from that terminal session
- Temporary (only last for that session)
- Secure (not stored in files that could be committed)
- Easy to use (Gradle can read them via `System.getenv()`)

## Verification

After setting them, you can verify:

```bash
# Check if variables are set
echo "Keystore password: ${KEYSTORE_PASSWORD:+SET}"
echo "Key password: ${KEY_PASSWORD:+SET}"

# Or see the actual values (be careful in shared screens!)
echo $KEYSTORE_PASSWORD
echo $KEY_PASSWORD
```

## Complete Example Session

```bash
# 1. Navigate to project root
cd /Users/estherjoseph/dev/weather-city-3d-ar

# 2. Set environment variables
export KEYSTORE_PASSWORD="MySecurePassword123"
export KEY_PASSWORD="MySecurePassword123"

# 3. Build the AAB
npm run android:bundle

# The AAB will be at:
# android/app/build/outputs/bundle/release/app-release.aab
```

## Troubleshooting

**"Variables not set"**
- Make sure you're in the same terminal session
- Check with `echo $KEYSTORE_PASSWORD`
- Re-export if needed

**"Keystore not found"**
- Make sure keystore exists: `ls android/keystore/citysnowglobe-release.keystore`
- Create it first if missing

**"Signing failed"**
- Verify passwords are correct
- Check keystore file exists
- Ensure environment variables are set before running npm command

---

**TL;DR**: Set them in your terminal with `export` commands, in the same session where you'll run `npm run android:bundle`.

