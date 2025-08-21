#!/bin/bash

echo "🚀 CarBot Quick Setup for Linus Demo"
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check environment file
if [ ! -f ".env" ]; then
    echo "⚙️ Creating environment file..."
    cp .env.example .env 2>/dev/null || echo "# Create your .env file with API keys" > .env
fi

echo ""
echo "🔑 CRITICAL: Set your API keys in .env file:"
echo "   1. GROQ_API_KEY (free from https://console.groq.com/)"
echo "   2. PICOVOICE_ACCESS_KEY (free from https://console.picovoice.ai/)"
echo ""

# Check if API keys are set
if grep -q "your-groq-api-key" .env 2>/dev/null; then
    echo "⚠️  WARNING: GROQ_API_KEY still has placeholder value!"
    echo "   Get free key: https://console.groq.com/"
fi

if grep -q "your-picovoice-access-key" .env 2>/dev/null; then
    echo "⚠️  WARNING: PICOVOICE_ACCESS_KEY still has placeholder value!"
    echo "   Get free key: https://console.picovoice.ai/"
fi

echo ""
echo "🎯 Quick Demo Options:"
echo ""
echo "1. Start Backend (Terminal 1):"
echo "   npm start"
echo ""
echo "2. Test Wake Word (Terminal 2):"
echo "   curl -X POST http://localhost:3000/api/wake-word"
echo ""
echo "3. Test Voice Command (Terminal 2):"
echo "   curl -X POST http://localhost:3000/api/voice-command -H \"Content-Type: application/json\" -d '{\"command\":\"Hello, what time is it?\"}'"
echo ""
echo "4. Build Android App:"
echo "   cd android && ./gradlew assembleDebug"
echo ""
echo "🏆 Ready for Linus Torvalds demo!"