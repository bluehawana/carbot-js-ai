#!/bin/bash

echo "📱 CarBot Android Installation Guide"
echo "═══════════════════════════════════════"

# Check if Android Studio is installed
if [ -d "/Applications/Android Studio.app" ]; then
    echo "✅ Android Studio found"
else
    echo "❌ Android Studio not found"
    echo "📥 Please download and install Android Studio first:"
    echo "   https://developer.android.com/studio"
    echo ""
    echo "🔧 After installation, run this script again"
    exit 1
fi

# Check if phone is connected
echo "🔍 Checking for connected Android devices..."
if command -v adb &> /dev/null; then
    DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l)
    if [ $DEVICES -gt 0 ]; then
        echo "✅ Android device connected"
        adb devices
    else
        echo "⚠️  No Android devices found"
        echo "📱 Please connect your phone via USB and enable USB Debugging"
        echo ""
        echo "🔧 How to enable USB Debugging:"
        echo "   1. Settings → About Phone"
        echo "   2. Tap 'Build Number' 7 times"
        echo "   3. Settings → Developer Options"
        echo "   4. Enable 'USB Debugging'"
    fi
else
    echo "⚠️  ADB not found - Android Studio may not be properly set up"
fi

echo ""
echo "📂 CarBot Android project ready at: CarBotAndroid/"
echo ""
echo "🎯 Next steps:"
echo "   1. Open Android Studio"
echo "   2. File → Open → Select 'CarBotAndroid' folder"
echo "   3. Wait for Gradle sync"
echo "   4. Click Run (green arrow) → Select your phone"
echo "   5. Grant microphone permissions when prompted"
echo ""
echo "🚗 After installation:"
echo "   - CarBot will start automatically"
echo "   - Say 'Hello My Car' to test"
echo "   - Connect to Android Auto in your car"
echo ""
echo "🔧 Backend server: http://192.168.2.4:3000"
echo "   (Make sure your Mac backend is running)"