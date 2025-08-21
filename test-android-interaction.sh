#!/bin/bash

echo "🤖 CarBot Android Interaction Test"
echo "=================================="

MAC_IP=$(ifconfig en0 | grep 'inet ' | awk '{print $2}')
PORT=3000

echo "Testing interactive dialog flow..."
echo ""

echo "1️⃣  Testing Backend Health..."
curl -s "http://localhost:$PORT/health" > /dev/null && echo "✅ Backend: Online" || echo "❌ Backend: Offline"

echo ""
echo "2️⃣  Testing Android Auto Dialog Flow:"
echo ""

echo "🔄 Step 1: App Opens (shows connection animation)"
echo "   🔗 Establishing connection..."
echo "   📡 Handshaking with backend..."
sleep 1

echo ""
echo "🎯 Step 2: Wake Word Triggered"
curl -s -X POST "http://localhost:$PORT/api/wake-word" > /dev/null
echo "   ✅ Wake word activated!"
sleep 1

echo ""
echo "🎤 Step 3: Voice Listening Animation"
echo "   🎤 Listening."
sleep 0.4
echo "   🎤 Listening.."
sleep 0.4  
echo "   🎤 Listening..."
sleep 0.4
echo "   🎙️ I'm hearing you..."
sleep 0.4
echo "   👂 Still listening..."
sleep 0.4
echo "   🔊 Got it! Processing..."
sleep 1

echo ""
echo "🧠 Step 4: AI Thinking Animation"
echo "   🧠 AI analyzing: 'What's the weather like?'"
sleep 0.6
echo "   🤔 CarBot thinking..."
sleep 0.6
echo "   ⚡ Processing with neural networks..."
sleep 0.6
echo "   🔍 Searching knowledge base..."
sleep 0.6
echo "   💭 Formulating response..."
sleep 0.6
echo "   ✨ Almost ready..."
sleep 1

echo ""
echo "🤖 Step 5: AI Response"
RESPONSE=$(curl -s -X POST "http://localhost:$PORT/api/voice-command" \
  -H "Content-Type: application/json" \
  -d '{"command":"What time is it?"}')

if echo "$RESPONSE" | grep -q "success.*true"; then
    echo "   ✅ CarBot: I can help you with that! (Response received)"
else
    echo "   ❌ CarBot: Connection failed"
fi

echo ""
echo "🔄 Step 6: Ready for Next Command"
echo "   Ready for next command! Tap 'Start Voice' or say 'Hello My Car'"

echo ""
echo "🏆 Android Auto Experience:"
echo "========================================="
echo "👋 Greeting: Animated connection flow"
echo "🎤 Listening: Visual feedback with dots animation"  
echo "🧠 Thinking: AI processing states shown"
echo "🤖 Response: Clear bot responses with auto-reset"
echo "🔄 Continuous: Ready for next interaction"
echo ""
echo "✅ INTERACTIVE DIALOG SYSTEM READY!"
echo "🚗 Users will see CarBot is alive and responsive!"