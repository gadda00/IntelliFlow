#!/usr/bin/env bash
# Busara Android TWA Build Script
# Produces APK (for testing) and AAB (for Play Store upload)
#
# Prerequisites:
#   1. Java 17+ (already installed)
#   2. Android SDK (install via Android Studio or cmdline-tools)
#   3. Bubblewrap CLI: npm install -g @bubblewrap/cli
#
# Usage:
#   ./build-android.sh            # Full init + build
#   ./build-android.sh build      # Just build (after init)
#   ./build-android.sh apk        # Just build APK
#   ./build-android.sh aab        # Just build AAB

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/android-twa"
MANIFEST="${PROJECT_DIR}/twa-manifest.json"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERR]${NC} $1"; }

# Check prerequisites
check_prereqs() {
  log "Checking prerequisites..."

  if ! command -v java &> /dev/null; then
    err "Java not found. Install JDK 17+: sudo apt install openjdk-17-jdk"
    exit 1
  fi

  if ! command -v bubblewrap &> /dev/null; then
    warn "Bubblewrap not found. Installing..."
    npm install -g @bubblewrap/cli
  fi

  if [ -z "$ANDROID_HOME" ] && [ ! -d "/usr/lib/android-sdk" ]; then
    warn "ANDROID_HOME not set. Bubblewrap will prompt to download Android SDK."
    warn "Set ANDROID_HOME to your SDK path for non-interactive builds."
  fi

  log "✓ Prerequisites OK"
}

# Initialize the TWA project from manifest
init_project() {
  log "Initializing TWA project from manifest..."
  cd "$PROJECT_DIR"

  # Use the deployed URL (update this after deploying to Vercel)
  PWA_URL="${PWA_URL:-https://busara.vercel.app}"

  bubblewrap init \
    --manifest "$PWA_URL/manifest.json" \
    --name "Busara" \
    --packageId "ai.busara.app" \
    --skip-https-validation || {
      err "Bubblewrap init failed. Try running interactively: bubblewrap init --manifest $PWA_URL/manifest.json"
      exit 1
    }

  log "✓ TWA project initialized"
}

# Build the APK and AAB
build_project() {
  log "Building APK and AAB..."
  cd "$PROJECT_DIR"

  bubblewrap build || {
    err "Bubblewrap build failed."
    err "Common issues:"
    err "  1. Android SDK not configured — run: bubblewrap androidsdk install"
    err "  2. Java version mismatch — need JDK 17+"
    err "  3. Network issues — Gradle needs to download dependencies"
    exit 1
  }

  log "✓ Build complete!"
  log "Outputs in: ${PROJECT_DIR}/app/build/outputs/"
  log "  APK: app/build/outputs/apk/release/app-release.apk"
  log "  AAB: app/build/outputs/bundle/release/app-release.aab"
}

# Build only APK
build_apk() {
  log "Building APK only..."
  cd "$PROJECT_DIR"
  ./gradlew assembleRelease || {
    err "Gradle APK build failed"
    exit 1
  }
  log "✓ APK: app/build/outputs/apk/release/app-release.apk"
}

# Build only AAB
build_aab() {
  log "Building AAB only..."
  cd "$PROJECT_DIR"
  ./gradlew bundleRelease || {
    err "Gradle AAB build failed"
    exit 1
  }
  log "✓ AAB: app/build/outputs/bundle/release/app-release.aab"
}

# Main
case "${1:-all}" in
  init)
    check_prereqs
    init_project
    ;;
  build)
    check_prereqs
    build_project
    ;;
  apk)
    check_prereqs
    build_apk
    ;;
  aab)
    check_prereqs
    build_aab
    ;;
  all|"")
    check_prereqs
    init_project
    build_project
    ;;
  *)
    echo "Usage: $0 {init|build|apk|aab|all}"
    exit 1
    ;;
esac

echo ""
log "🎉 Busara Android build complete!"
echo ""
echo "Next steps:"
echo "  1. Test the APK on a device: adb install app/build/outputs/apk/release/app-release.apk"
echo "  2. Upload the AAB to Play Console: https://play.google.com/console"
echo "  3. Fill in store listing (use assets in /android-twa/store-listing/)"
echo ""
