# Java 11+ Installation Guide

## Current Issue
Homebrew installation is failing due to permission restrictions. Here are alternative ways to install Java 11+:

## Option 1: Download from Adoptium (Recommended)

1. Visit: https://adoptium.net/temurin/releases/?version=11
2. Download the **macOS x64** installer (.pkg file)
3. Run the installer
4. Verify installation:
   ```bash
   java -version
   ```

## Option 2: Download from Oracle

1. Visit: https://www.oracle.com/java/technologies/javase/jdk11-archive-downloads.html
2. Accept the license agreement
3. Download the **macOS x64** DMG file
4. Run the installer
5. Verify installation

## Option 3: Manual Homebrew Installation

If you have admin access, run these commands in your terminal (outside this environment):

```bash
# Fix Homebrew permissions
sudo chown -R $(whoami) /opt/homebrew/Cellar

# Install Java 11
brew install openjdk@11

# Set JAVA_HOME
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 11)' >> ~/.zshrc
source ~/.zshrc

# Verify
java -version
```

## Option 4: Use SDKMAN (Alternative Package Manager)

```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Install Java 11
sdk install java 11.0.23-tem

# Verify
java -version
```

## After Installation

Once Java 11+ is installed and `java -version` shows version 11 or higher:

1. **Set JAVA_HOME** (if not automatically set):
   ```bash
   export JAVA_HOME=$(/usr/libexec/java_home -v 11)
   ```

2. **Verify Gradle can run**:
   ```bash
   cd android
   ./gradlew --version
   ```

3. **Proceed with AAB build** (see AAB_BUILD_STATUS.md)

## Testing the Installation

Run these commands to verify everything works:

```bash
# Check Java version
java -version

# Check Gradle can run (should not show Java version errors)
cd android && ./gradlew --version

# If successful, build the AAB
export KEYSTORE_PASSWORD="your_password"
export KEY_PASSWORD="your_password"
npm run android:bundle
```

## Common Issues

**"JAVA_HOME not set"**
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 11)
echo $JAVA_HOME
```

**"Gradle still fails"**
- Ensure you restarted your terminal after installation
- Check that the Java 11 installation is the default: `which java`

**"Permission denied"**
- Run the installation commands outside this environment
- Or use `sudo` for system installations

---

**Note**: Since this environment has sandbox restrictions, you may need to install Java manually using one of the download options above.

