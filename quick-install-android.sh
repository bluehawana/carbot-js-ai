#!/bin/bash

echo "🚀 Quick CarBot Android Installation"
echo "═══════════════════════════════════════"

# Check if phone is connected
if ! command -v adb &> /dev/null; then
    echo "❌ ADB not found. Please install Android Studio first."
    exit 1
fi

DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l)
if [ $DEVICES -eq 0 ]; then
    echo "❌ No Android devices connected"
    echo "📱 Please connect your phone via USB and enable USB Debugging"
    exit 1
fi

echo "✅ Android device connected"

# Check for local.properties file
if [ ! -f "CarBotAndroid/local.properties" ]; then
    echo "⚠️  Missing local.properties file!"
    echo "Please create CarBotAndroid/local.properties with the following content:"
    echo ""
    echo "carbot.api.base=http://<YOUR_COMPUTER_IP_ADDRESS>:3000"
    echo "picovoice.access.key=<YOUR_PICOVOICE_ACCESS_KEY>"
    echo ""
    echo "Replace <YOUR_COMPUTER_IP_ADDRESS> with your computer's IP address."
    echo "Replace <YOUR_PICOVOICE_ACCESS_KEY> with your Picovoice Access Key."
    exit 1
fi

# Use Android Studio to build and install
echo "🔧 Opening Android Studio with CarBot project..."
echo ""
echo "📋 Manual steps in Android Studio:"
echo "   1. File → Open → Select: $(pwd)/CarBotAndroid"
    echo "   2. Wait for Gradle sync to complete"
    echo "   3. Click the green 'Run' button (▶️)"
    echo "   4. Select your connected phone"
    echo "   5. Grant microphone permissions"
    echo ""
    echo "🎤 After installation, say 'Hello My Car' to test!"

# Open Android Studio with the project
if [ -d "/Applications/Android Studio.app" ]; then
    open -a "Android Studio" "$(pwd)/CarBotAndroid"
else
    echo "⚠️  Please open Android Studio manually and import the CarBotAndroid folder"
fi

echo ""
echo "🔗 Backend connection is configured in CarBotAndroid/local.properties"
echo "   (CarBot backend should be running on your Mac)"