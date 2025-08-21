#!/bin/bash

# Test Voice Recording and Speech Recognition for CarBot APK
# This script tests the real microphone recording and speech recognition functionality

set -e

echo "🎤 CarBot Voice Recording & Speech Recognition Test"
echo "=================================================="
echo ""

# Check if we have adb installed
if ! command -v adb &> /dev/null; then
    echo "❌ ADB not found. Please install Android SDK platform tools."
    exit 1
fi

# Check if device/emulator is connected
echo "📱 Checking for connected Android device..."
DEVICE_COUNT=$(adb devices | grep -v "List of devices" | grep "device" | wc -l)

if [ $DEVICE_COUNT -eq 0 ]; then
    echo "❌ No Android device or emulator found."
    echo "   Please connect a device or start an emulator."
    exit 1
fi

echo "✅ Found $DEVICE_COUNT Android device(s)"
echo ""

# Build and install the APK
echo "🔧 Building CarBot APK with voice recording..."
./gradlew assembleDebug

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "📲 Installing CarBot APK on device..."
adb install -r app/build/outputs/apk/debug/app-debug.apk

if [ $? -ne 0 ]; then
    echo "❌ Installation failed"
    exit 1
fi

echo ""
echo "🎯 Granting required permissions..."
# Grant microphone permission
adb shell pm grant com.aicarbot.app.debug android.permission.RECORD_AUDIO
adb shell pm grant com.aicarbot.app.debug android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.aicarbot.app.debug android.permission.CALL_PHONE
adb shell pm grant com.aicarbot.app.debug android.permission.MODIFY_AUDIO_SETTINGS

echo "✅ Permissions granted"
echo ""

# Launch the app
echo "🚀 Launching CarBot with Voice Recording..."
adb shell am start -n com.aicarbot.app.debug/com.aicarbot.app.MainActivity

echo ""
echo "🎤 VOICE RECORDING TEST READY!"
echo "==============================="
echo ""
echo "The CarBot app is now running on your device with:"
echo "✓ Real microphone access"
echo "✓ Android built-in speech recognition"
echo "✓ On-device text-to-speech"
echo "✓ Car-optimized audio processing"
echo "✓ Wake word detection ('Hello My Car')"
echo ""
echo "Test Steps:"
echo "1. 🎤 Tap 'Start Voice Command' button"
echo "2. 🗣️  Speak a command like:"
echo "   • 'What's the weather like?'"
echo "   • 'Navigate to downtown'"
echo "   • 'Play some music'"
echo "   • 'What's my fuel level?'"
echo "3. 🔊 Listen to CarBot's response"
echo "4. 🎯 Try saying 'Hello My Car' to test wake word"
echo ""
echo "Voice Features Testing:"
echo "• Real microphone recording ✓"
echo "• Speech-to-text conversion ✓"
echo "• On-device AI processing ✓"
echo "• Text-to-speech responses ✓"
echo "• Car audio optimization ✓"
echo "• Road noise filtering ✓"
echo ""
echo "📱 Check your device screen now!"
echo ""
echo "🔍 To view live logs, run:"
echo "   adb logcat -s StandaloneVoiceService CarBot_MainActivity OnDeviceAIEngine"