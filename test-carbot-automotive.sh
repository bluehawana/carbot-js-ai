#!/bin/bash

echo "🧪 Testing CarBot on Android Automotive Emulator"
echo "=============================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test functions
test_backend() {
    echo -e "\n${YELLOW}🔍 Testing Backend Connection...${NC}"
    
    if curl -s http://localhost:3000/api/health | grep -q "OK"; then
        echo -e "${GREEN}✅ Backend health check passed${NC}"
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
        return 1
    fi
    
    # Test from emulator perspective
    if adb shell curl -s http://10.0.2.2:3000/api/health 2>/dev/null | grep -q "OK"; then
        echo -e "${GREEN}✅ Backend accessible from emulator${NC}"
    else
        echo -e "${RED}❌ Backend not accessible from emulator${NC}"
        return 1
    fi
}

test_wake_word() {
    echo -e "\n${YELLOW}🎤 Testing Wake Word Detection...${NC}"
    
    # Test wake word endpoint
    WAKE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/wake-word)
    if echo "$WAKE_RESPONSE" | grep -q "success\|detected\|activated"; then
        echo -e "${GREEN}✅ Wake word endpoint responding${NC}"
    else
        echo -e "${RED}❌ Wake word endpoint not responding${NC}"
        echo -e "${BLUE}Response: $WAKE_RESPONSE${NC}"
    fi
}

test_voice_command() {
    echo -e "\n${YELLOW}🗣️ Testing Voice Command Processing...${NC}"
    
    # Test voice command endpoint
    VOICE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/voice-command \
        -H "Content-Type: application/json" \
        -d '{"command":"Hello, what time is it?"}')
    
    if echo "$VOICE_RESPONSE" | grep -q -i "time\|clock\|hour\|minute"; then
        echo -e "${GREEN}✅ Voice command processed successfully${NC}"
        echo -e "${BLUE}Response: ${VOICE_RESPONSE:0:100}...${NC}"
    else
        echo -e "${RED}❌ Voice command processing failed${NC}"
        echo -e "${BLUE}Response: $VOICE_RESPONSE${NC}"
    fi
}

test_ai_features() {
    echo -e "\n${YELLOW}🤖 Testing Advanced AI Features...${NC}"
    
    # Test advanced AI command
    AI_RESPONSE=$(curl -s -X POST http://localhost:3000/api/voice-command \
        -H "Content-Type: application/json" \
        -d '{"command":"What is the latest news about electric vehicles?"}')
    
    if [ ${#AI_RESPONSE} -gt 50 ]; then
        echo -e "${GREEN}✅ AI processing working${NC}"
        echo -e "${BLUE}Sample response: ${AI_RESPONSE:0:150}...${NC}"
    else
        echo -e "${RED}❌ AI processing may have issues${NC}"
        echo -e "${BLUE}Response: $AI_RESPONSE${NC}"
    fi
}

test_automotive_app() {
    echo -e "\n${YELLOW}📱 Testing Automotive App...${NC}"
    
    # Check if app is installed
    if adb shell pm list packages | grep -q com.aicarbot.app; then
        echo -e "${GREEN}✅ CarBot app installed${NC}"
    else
        echo -e "${RED}❌ CarBot app not installed${NC}"
        return 1
    fi
    
    # Check if app is automotive-compatible
    APP_INFO=$(adb shell dumpsys package com.aicarbot.app | grep -i automotive)
    if [ -n "$APP_INFO" ]; then
        echo -e "${GREEN}✅ App configured for Automotive OS${NC}"
    else
        echo -e "${YELLOW}⚠️  App may not be fully automotive-configured${NC}"
    fi
    
    # Try to launch the app
    adb shell am start -n com.aicarbot.app/.MainActivity 2>/dev/null
    sleep 3
    
    if adb shell ps | grep -q com.aicarbot.app; then
        echo -e "${GREEN}✅ App launched successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  App launch status unclear${NC}"
    fi
}

test_audio_system() {
    echo -e "\n${YELLOW}🔊 Testing Audio System...${NC}"
    
    # Check audio permissions
    AUDIO_PERM=$(adb shell dumpsys package com.aicarbot.app | grep -i "android.permission.RECORD_AUDIO")
    if echo "$AUDIO_PERM" | grep -q "granted=true"; then
        echo -e "${GREEN}✅ Audio recording permission granted${NC}"
    else
        echo -e "${RED}❌ Audio recording permission not granted${NC}"
    fi
    
    # Test audio input availability
    if adb shell getprop | grep -q "audio"; then
        echo -e "${GREEN}✅ Audio system available${NC}"
    else
        echo -e "${YELLOW}⚠️  Audio system status unknown${NC}"
    fi
}

# Main test sequence
echo -e "${BLUE}Starting comprehensive CarBot tests...${NC}"

# Check if emulator is running
if ! adb devices | grep -q emulator; then
    echo -e "${RED}❌ No automotive emulator found!${NC}"
    echo -e "${BLUE}Please run ./setup-automotive-emulator.sh first${NC}"
    exit 1
fi

# Run all tests
test_backend
test_wake_word
test_voice_command
test_ai_features
test_automotive_app
test_audio_system

echo -e "\n${GREEN}🎯 CarBot Automotive Testing Summary${NC}"
echo -e "${BLUE}=====================================${NC}"

# Show recent logs
echo -e "\n${YELLOW}Recent CarBot logs:${NC}"
adb logcat -d | grep -i carbot | tail -10

echo -e "\n${YELLOW}🚗 Ready for Car Testing!${NC}"
echo -e "${BLUE}Try these voice commands in the emulator:${NC}"
echo "• 'Hello My Car' (wake word)"
echo "• 'OK My Car' (alternative wake word)"
echo "• 'Write a poem about cars' (AI creativity - always works)"
echo "• 'Tell me about the latest tech news' (web search - always works)"
echo "• 'What's Elon Musk's latest tweet?' (needs Twitter API key)"
echo "• 'What's the weather?' (needs weather API key)"

echo -e "\n${GREEN}CarBot is ready to be smarter than Google Assistant! 🚀${NC}"