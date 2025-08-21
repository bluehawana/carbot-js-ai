#!/bin/bash

# Test Picovoice Wake Word Integration
# This script tests the real Picovoice wake word detection in the CarBot Android app

set -e

echo "🔊 Testing Picovoice Wake Word Integration for CarBot"
echo "=================================================="

# Check if Android device is connected
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device found. Please connect an Android device or start an emulator."
    echo "   Make sure USB debugging is enabled."
    exit 1
fi

echo "✅ Android device detected"

# Build the project
echo "🏗️  Building CarBot Android app with Picovoice integration..."
cd android

# Clean and build the project
./gradlew clean
./gradlew assembleDebug

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi

echo "✅ Build completed successfully"

# Install the APK
echo "📱 Installing CarBot APK..."
adb install -r app/build/outputs/apk/debug/app-debug.apk

if [ $? -ne 0 ]; then
    echo "❌ Installation failed. Please check the error messages above."
    exit 1
fi

echo "✅ APK installed successfully"

# Check if wake word model exists in assets
echo "🔍 Checking wake word model availability..."
if [ -f "app/src/main/assets/Hello-My-car_en_android_v3_0_0.ppn" ]; then
    echo "✅ Picovoice wake word model found in assets"
    ls -la app/src/main/assets/Hello-My-car_en_android_v3_0_0.ppn
else
    echo "⚠️  Wake word model not found in assets!"
    echo "   Please ensure Hello-My-car_en_android_v3_0_0.ppn is in app/src/main/assets/"
fi

# Grant necessary permissions
echo "🔐 Granting required permissions..."
adb shell pm grant com.aicarbot.app.debug android.permission.RECORD_AUDIO
adb shell pm grant com.aicarbot.app.debug android.permission.WRITE_EXTERNAL_STORAGE
adb shell pm grant com.aicarbot.app.debug android.permission.READ_EXTERNAL_STORAGE

echo "✅ Permissions granted"

# Start the app
echo "🚀 Starting CarBot app..."
adb shell am start -n com.aicarbot.app.debug/.MainActivity

# Wait a moment for the app to initialize
sleep 3

# Monitor logs for wake word service initialization
echo "📝 Monitoring CarBot logs for wake word service initialization..."
echo "   Looking for Picovoice initialization messages..."
echo "   Press Ctrl+C to stop monitoring"
echo ""

# Filter logs for CarBot wake word related messages
adb logcat -s "CarWakeWordService:*" "PicovoiceConfig:*" "StandaloneVoiceService:*" | while read line; do
    echo "$(date '+%H:%M:%S') $line"
done &

LOGCAT_PID=$!

# Instructions for testing
echo ""
echo "🎯 TESTING INSTRUCTIONS:"
echo "========================"
echo ""
echo "1. 🔑 IMPORTANT: Configure your Picovoice access key first!"
echo "   - Get a free key from: https://console.picovoice.ai/"
echo "   - Set the environment variable: export PICOVOICE_ACCESS_KEY='your_key_here'"
echo "   - Or update the key in PicovoiceConfig.java"
echo ""
echo "2. 📱 The CarBot app should now be running on your device"
echo "3. 🎤 Try saying 'Hello My Car' to test the wake word detection"
echo "4. 🔊 The app should respond with voice recognition after detecting the wake word"
echo "5. 📊 Monitor the logs above for debugging information"
echo ""
echo "Expected log messages:"
echo "- 'Picovoice wake word detection initialized successfully'"
echo "- 'Picovoice detected 'Hello My Car'!' (when you speak the wake word)"
echo "- 'Voice recognition started after wake word detection'"
echo ""
echo "🐛 TROUBLESHOOTING:"
echo "==================="
echo "- If you see 'Invalid Picovoice access key': Configure a valid access key"
echo "- If you see 'Failed to copy wake word model': Check if the .ppn file exists in assets"
echo "- If you see 'Audio permission denied': Check if microphone permission is granted"
echo "- If no wake word detection: Speak clearly and try 'Hello My Car' again"
echo ""
echo "Press Ctrl+C to stop monitoring and exit"

# Wait for user to interrupt
trap "kill $LOGCAT_PID 2>/dev/null; echo ''; echo '✅ Test session completed'; exit 0" INT

# Keep the script running
wait $LOGCAT_PID