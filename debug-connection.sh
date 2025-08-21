#!/bin/bash

echo "🔍 CarBot Connection Debug Tool"
echo "================================"

# Check if server is running locally
echo ""
echo "1. Testing local server connection..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Local server (localhost:3000) is running"
    curl -s http://localhost:3000/health | jq .
else
    echo "❌ Local server (localhost:3000) is not responding"
fi

# Get current IP address
echo ""
echo "2. Getting current IP addresses..."
echo "📡 Network interfaces:"
if command -v ifconfig &> /dev/null; then
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | sed 's/addr://' | while read ip; do
        echo "   - $ip"
    done
elif command -v ip &> /dev/null; then
    ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d'/' -f1 | while read ip; do
        echo "   - $ip"
    done
fi

# Test emulator endpoint
echo ""
echo "3. Testing Android emulator endpoint..."
if curl -s http://10.0.2.2:3000/health > /dev/null; then
    echo "✅ Emulator endpoint (10.0.2.2:3000) is accessible"
else
    echo "❌ Emulator endpoint (10.0.2.2:3000) is not accessible"
fi

# Test device endpoint
echo ""
echo "4. Testing device endpoint..."
if curl -s http://172.20.10.3:3000/health > /dev/null; then
    echo "✅ Device endpoint (172.20.10.3:3000) is accessible"
else
    echo "❌ Device endpoint (172.20.10.3:3000) is not accessible"
fi

# Test API endpoints
echo ""
echo "5. Testing API endpoints..."
echo "🔄 Testing wake-word endpoint..."
wake_response=$(curl -s -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/wake-word)
if [ $? -eq 0 ]; then
    echo "✅ Wake word endpoint working"
    echo "   Response: $wake_response"
else
    echo "❌ Wake word endpoint failed"
fi

echo ""
echo "🔄 Testing voice-command endpoint..."
voice_response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"command":"Hello CarBot"}' http://localhost:3000/api/voice-command)
if [ $? -eq 0 ]; then
    echo "✅ Voice command endpoint working"
    echo "   Response: $voice_response"
else
    echo "❌ Voice command endpoint failed"
fi

echo ""
echo "📱 Android Setup Instructions:"
echo "================================"
echo "For Android Emulator:"
echo "  - Use URL: http://10.0.2.2:3000"
echo "  - Make sure AVD is running"
echo ""
echo "For Physical Device:"
echo "  - Use URL: http://[YOUR_COMPUTER_IP]:3000"
echo "  - Make sure device and computer are on same network"
echo "  - Update CarBotApiClient.java DEVICE_URL if needed"
echo ""
echo "🔧 Troubleshooting:"
echo "==================="
echo "1. Start CarBot server: npm start"
echo "2. Check firewall settings"
echo "3. Verify network connectivity"
echo "4. Check Android logs: adb logcat | grep CarBot"