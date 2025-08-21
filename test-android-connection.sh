#!/bin/bash

echo "🔧 CarBot Android Connection Test"
echo "=================================="

# Check if server is running
echo ""
echo "1. Checking CarBot backend server..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ CarBot backend server is running"
    server_response=$(curl -s http://localhost:3000/health)
    echo "   Response: $server_response"
else
    echo "❌ CarBot backend server is NOT running"
    echo "   Please run: npm start"
    echo ""
    exit 1
fi

# Get device IP information
echo ""
echo "2. Network configuration..."
echo "🌐 Available IP addresses:"

# For macOS
if command -v ifconfig &> /dev/null; then
    ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print "   " $2}' | head -5
fi

# Test endpoints that Android will use
echo ""
echo "3. Testing Android endpoints..."

# Test emulator endpoint
echo "🔄 Testing emulator endpoint (10.0.2.2:3000)..."
if curl -s -m 5 http://10.0.2.2:3000/health > /dev/null 2>&1; then
    echo "✅ Emulator can access backend"
else
    echo "⚠️  Emulator endpoint test failed (normal if no emulator running)"
fi

# Get main IP and test device endpoint
MAIN_IP=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | head -1 | awk '{print $2}' | sed 's/addr://')
if [ ! -z "$MAIN_IP" ]; then
    echo "🔄 Testing device endpoint ($MAIN_IP:3000)..."
    if curl -s -m 5 "http://$MAIN_IP:3000/health" > /dev/null 2>&1; then
        echo "✅ Device can access backend at $MAIN_IP:3000"
    else
        echo "❌ Device endpoint test failed at $MAIN_IP:3000"
        echo "   Check firewall settings"
    fi
fi

# Test API functions
echo ""
echo "4. Testing API functions..."

echo "🔄 Testing wake-word trigger..."
wake_result=$(curl -s -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/wake-word)
if [ $? -eq 0 ]; then
    echo "✅ Wake word endpoint working"
    echo "   $wake_result"
else
    echo "❌ Wake word endpoint failed"
fi

echo ""
echo "🔄 Testing voice command..."
voice_result=$(curl -s -X POST -H "Content-Type: application/json" -d '{"command":"test connection"}' http://localhost:3000/api/voice-command)
if [ $? -eq 0 ]; then
    echo "✅ Voice command endpoint working"
    echo "   Response: $(echo $voice_result | head -c 100)..."
else
    echo "❌ Voice command endpoint failed"
fi

# Build Android app if needed
echo ""
echo "5. Android app status..."
if [ -d "android/app/build/outputs/apk" ]; then
    echo "✅ Android APK exists"
    apk_files=$(find android/app/build/outputs/apk -name "*.apk" | wc -l)
    echo "   Found $apk_files APK files"
else
    echo "⚠️  Android APK not found"
    echo "   Run: cd android && ./gradlew assembleDebug"
fi

# Check for connected devices
echo ""
echo "6. Connected Android devices..."
if command -v adb &> /dev/null; then
    devices=$(adb devices | grep -v "List of devices" | grep -v "^$" | wc -l)
    if [ $devices -gt 0 ]; then
        echo "✅ Found $devices connected device(s)"
        adb devices
    else
        echo "⚠️  No Android devices connected"
        echo "   Connect device or start emulator"
    fi
else
    echo "⚠️  ADB not found - install Android SDK tools"
fi

echo ""
echo "📱 Next Steps:"
echo "=============="
echo "1. If backend is running ✅, build the Android app:"
echo "   cd android && ./gradlew assembleDebug"
echo ""
echo "2. Install on device/emulator:"
echo "   adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "3. Check Android logs:"
echo "   adb logcat | grep -E '(CarBot|VoiceScreen|CarBotApiClient)'"
echo ""
echo "4. For connection issues, update IP in CarBotApiClient.java:"
echo "   DEVICE_URL = \"http://$MAIN_IP:3000\""
echo ""

# Real-time log monitoring option
read -p "🔍 Monitor Android logs in real-time? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📊 Starting log monitoring... (Press Ctrl+C to stop)"
    adb logcat | grep --color=always -E "(CarBot|VoiceScreen|CarBotApiClient|AndroidRuntime)"
fi