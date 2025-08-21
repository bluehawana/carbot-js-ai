#!/bin/bash

echo "🔍 Android CarBot Connection Debug"
echo "=================================="

MAC_IP=$(ifconfig en0 | grep 'inet ' | awk '{print $2}')

echo "🖥️  Mac IP: $MAC_IP"
echo "📱 Emulator should use: http://10.0.2.2:3000"
echo "📱 Physical device should use: http://$MAC_IP:3000"
echo ""

echo "1️⃣  Checking if backend is running..."
if curl -s "http://localhost:3000/health" > /dev/null; then
    echo "✅ Backend is running on localhost:3000"
else
    echo "❌ Backend NOT running - start with: npm start"
    exit 1
fi

echo ""
echo "2️⃣  Testing Android endpoints..."

echo "   Testing wake-word endpoint..."
WAKE_RESULT=$(curl -s -w "%{http_code}" -X POST "http://localhost:3000/api/wake-word" -o /dev/null)
if [ "$WAKE_RESULT" = "200" ]; then
    echo "   ✅ Wake word API: OK"
else
    echo "   ❌ Wake word API: Failed ($WAKE_RESULT)"
fi

echo "   Testing voice command endpoint..."
VOICE_RESULT=$(curl -s -w "%{http_code}" -X POST "http://localhost:3000/api/voice-command" \
  -H "Content-Type: application/json" \
  -d '{"command":"test"}' -o /dev/null)
if [ "$VOICE_RESULT" = "200" ]; then
    echo "   ✅ Voice command API: OK"
else
    echo "   ❌ Voice command API: Failed ($VOICE_RESULT)"
fi

echo ""
echo "3️⃣  Common Android issues to check in logcat:"
echo "   🔍 Look for these ERROR messages:"
echo "   - 'ConnectException' or 'Connection refused'"
echo "   - 'UnknownHostException'"
echo "   - 'CarBotApiClient' errors"
echo "   - 'Failed to connect' messages"
echo ""
echo "4️⃣  If you see connection errors:"
echo "   📱 Emulator: Make sure using http://10.0.2.2:3000"
echo "   📱 Physical device: Update IP to http://$MAC_IP:3000"
echo "   🔥 Firewall: Check if macOS firewall is blocking port 3000"
echo ""
echo "5️⃣  Test from Android device directly:"
echo "   📱 Open browser on Android device"
echo "   🌐 Go to: http://10.0.2.2:3000/health (emulator)"
echo "   🌐 Or go to: http://$MAC_IP:3000/health (physical device)"
echo ""

echo "💡 Next steps:"
echo "   1. Share logcat output containing 'CarBotApiClient' or connection errors"
echo "   2. Test the browser URLs above on your Android device"
echo "   3. Check if you're using emulator or physical device"