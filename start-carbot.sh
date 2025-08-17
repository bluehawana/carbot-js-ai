#!/bin/bash

# 🚗 CarBot Pure Android Auto Launcher
# No web interface - Direct terminal integration
# Designed for Linus Torvalds review

echo "🚗 CarBot Android Auto - Pure Terminal Mode"
echo "═══════════════════════════════════════════════"
echo "⚡ Starting backend services..."

# Set environment variables
export PICOVOICE_ACCESS_KEY="${PICOVOICE_ACCESS_KEY}"
export GROQ_API_KEY="${GROQ_API_KEY}"
export NODE_ENV="production"

# Start backend in background
echo "🎤 Starting voice processing backend..."
node src/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Test backend connectivity
echo "🔍 Testing backend connectivity..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Backend ready!"
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎯 CarBot is ready!"
echo "📱 For Android Auto: Use API endpoints directly"
echo "💻 For terminal: Run './carbot-cli.js'"
echo ""
echo "🚀 Performance optimized for automotive use"
echo "🔧 No web interface bloat - Pure efficiency"
echo ""

# Keep backend running
echo "Press Ctrl+C to stop CarBot..."
trap "echo ''; echo '🛑 Stopping CarBot...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT

# Performance monitoring
while true; do
    sleep 10
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died, restarting..."
        node src/index.js &
        BACKEND_PID=$!
        sleep 5
    fi
done