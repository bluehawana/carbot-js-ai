#!/bin/bash

# Build Standalone CarBot APK
# This script builds the CarBot Android app with all on-device features

set -e

echo "🚗 Building Standalone CarBot AI Assistant"
echo "=========================================="

# Check if we're in the android directory
if [ ! -f "app/build.gradle" ]; then
    echo "❌ Error: Please run this script from the android directory"
    exit 1
fi

# Check if gradlew exists
if [ ! -f "gradlew" ]; then
    echo "❌ Error: gradlew not found. Make sure you're in the Android project root."
    exit 1
fi

echo "🧹 Cleaning previous builds..."
./gradlew clean

echo "📦 Building debug APK with standalone features..."
./gradlew assembleDebug

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Standalone CarBot APK built successfully!"
    echo ""
    echo "📱 APK Location:"
    echo "   Debug: app/build/outputs/apk/debug/app-debug.apk"
    echo ""
    echo "🚀 To install on device/emulator:"
    echo "   adb install app/build/outputs/apk/debug/app-debug.apk"
    echo ""
    echo "🎯 Standalone Features:"
    echo "   ✓ On-device AI engine (no backend required)"
    echo "   ✓ Android SpeechRecognizer for voice input"
    echo "   ✓ Built-in Text-to-Speech for responses"
    echo "   ✓ Picovoice wake word detection ('Hello My Car')"
    echo "   ✓ Real car controls (navigation, music, phone)"
    echo "   ✓ Climate control integration"
    echo "   ✓ Zero backend dependency"
    echo ""
    echo "🎤 Usage:"
    echo "   1. Say 'Hello My Car' to activate wake word"
    echo "   2. Or tap 'Start Voice Command' button"
    echo "   3. Give commands like:"
    echo "      - 'Navigate to downtown'"
    echo "      - 'Play some music'"
    echo "      - 'Set temperature to 72 degrees'"
    echo "      - 'What's the weather?'"
    echo "      - 'Call John'"
    echo ""
    echo "🔧 For production build:"
    echo "   ./gradlew assembleRelease"
    echo ""
else
    echo "❌ Build failed! Check the errors above."
    exit 1
fi