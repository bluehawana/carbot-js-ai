#!/bin/bash

# ECARX Bot Android Auto Deployment Script

set -e

echo "📱 ECARX Bot Android Auto Deployment"
echo "===================================="

# Check if Android SDK is installed
if ! command -v android &> /dev/null; then
    echo "❌ Android SDK is not installed."
    echo "Please install Android SDK and set ANDROID_HOME environment variable."
    exit 1
fi

# Check if gradle is available
if ! command -v gradle &> /dev/null; then
    echo "❌ Gradle is not installed."
    echo "Please install Gradle build tool."
    exit 1
fi

echo "✅ Android SDK found"
echo "✅ Gradle found"

# Navigate to android directory
cd android

# Check if Android project exists
if [ ! -f "build.gradle" ]; then
    echo "❌ Android project not found. Please ensure android/build.gradle exists."
    exit 1
fi

echo "📦 Building Android project..."

# Clean previous builds
./gradlew clean

# Build the APK
./gradlew assembleDebug

# Check if APK was built successfully
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    echo "✅ APK built successfully: $APK_PATH"
else
    echo "❌ APK build failed"
    exit 1
fi

# Check if device is connected
if ! adb devices | grep -q "device"; then
    echo "⚠️  No Android device connected."
    echo "Please connect your Android device or start an emulator."
    echo "APK location: $APK_PATH"
    exit 0
fi

echo "📱 Android device detected"

# Install APK on device
echo "🚀 Installing APK on device..."
adb install -r "$APK_PATH"

if [ $? -eq 0 ]; then
    echo "✅ APK installed successfully"
    echo ""
    echo "📋 Next steps:"
    echo "1. Enable Android Auto on your device"
    echo "2. Connect to Android Auto compatible car"
    echo "3. Say 'Hi ECARX' to activate the assistant"
    echo ""
    echo "🔧 For debugging, use:"
    echo "   adb logcat | grep ECARX"
else
    echo "❌ APK installation failed"
    exit 1
fi

echo ""
echo "🎉 Deployment completed!"