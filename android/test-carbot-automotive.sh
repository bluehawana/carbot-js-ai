#!/bin/bash

# CarBot Android Automotive APK Testing Script
# This script builds, installs, and tests the CarBot APK in Android Automotive OS

echo "🚗 CarBot Android Automotive APK Testing"
echo "========================================"

# Check if emulator is running
echo "📱 Checking connected devices..."
adb devices -l

echo ""
echo "🔨 Building debug APK..."
./gradlew clean assembleDebug

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "📦 Installing APK to automotive emulator..."
adb install -r app/build/outputs/apk/debug/app-debug.apk

if [ $? -eq 0 ]; then
    echo "✅ Installation successful!"
else
    echo "❌ Installation failed!"
    exit 1
fi

echo ""
echo "🚀 Launching CarBot..."
adb shell am start -n com.aicarbot.app.debug/com.aicarbot.app.MainActivity

echo ""
echo "📊 Checking app status..."
sleep 3
adb shell dumpsys activity activities | grep -A 5 "aicarbot"

echo ""
echo "📋 Checking installed package..."
adb shell pm list packages | grep aicarbot

echo ""
echo "🎯 CarBot is now running in Android Automotive OS!"
echo ""
echo "To interact with CarBot:"
echo "1. Open the Car Launcher (should show CarBot in app grid)"
echo "2. Tap on CarBot icon to launch the voice interface"
echo "3. Use the voice button or say 'Hello My Car' to activate"
echo ""
echo "To view logs:"
echo "adb logcat | grep -E '(CarBot|aicarbot)'"