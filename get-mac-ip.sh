#!/bin/bash

echo "🖥️  MacBook M2 Max IP Address for Android Development"
echo "=================================================="

# Get the main network interface IP (usually en0 for WiFi)
MAC_IP=$(ifconfig en0 | grep 'inet ' | awk '{print $2}')

if [ -z "$MAC_IP" ]; then
    # Try wired connection if WiFi not available
    MAC_IP=$(ifconfig en1 | grep 'inet ' | awk '{print $2}')
fi

if [ -n "$MAC_IP" ]; then
    echo "✅ Your Mac IP Address: $MAC_IP"
    echo ""
    echo "🔧 For Android Development:"
    echo "   • Emulator: Use http://10.0.2.2:3000 (already configured)"
    echo "   • Physical Device: Use http://$MAC_IP:3000"
    echo ""
    echo "📝 To use physical device, update CarBotApiClient.java:"
    echo "   Change: http://10.0.2.2:3000"
    echo "   To:     http://$MAC_IP:3000"
    echo ""
    echo "🎤 Picovoice Models Needed:"
    echo "   ✅ Mac Backend: Hello-My-Car_en_mac_v3_0_0.ppn (already have)"
    echo "   📱 Android App: Hello-My-car_en_android_v3_0_0.ppn (in temp folder)"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Start backend: npm start"
    echo "   2. Test API: curl -X POST http://$MAC_IP:3000/api/wake-word"
    echo "   3. Build Android: cd android && ./gradlew assembleDebug"
else
    echo "❌ Could not detect Mac IP address"
    echo "💡 Manually check with: ifconfig | grep 'inet '"
fi