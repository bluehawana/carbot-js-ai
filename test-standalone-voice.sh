#!/bin/bash

# Standalone CarBot Voice Test - No Android Required
# Tests the complete voice pipeline using only the API

echo "🚗 CarBot Standalone Voice Test"
echo "==============================="
echo "This tests CarBot without any Android app/emulator"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

CARBOT_HOST="localhost"
CARBOT_PORT="3000"

# Check if CarBot is running
check_carbot() {
    echo -e "${YELLOW}Checking if CarBot is running...${NC}"
    if curl -s "http://$CARBOT_HOST:$CARBOT_PORT/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ CarBot is running on port $CARBOT_PORT${NC}"
        return 0
    else
        echo -e "${RED}❌ CarBot is not running${NC}"
        echo "Please start CarBot first:"
        echo "  cd /Users/bluehawana/Projects/carbot-js-ai-androidauto"
        echo "  npm start"
        exit 1
    fi
}

# Test standalone wake word trigger
test_wake_word() {
    echo -e "\n${BLUE}Testing wake word activation (standalone)...${NC}"
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"source": "manual", "mode": "standalone"}' \
        "http://$CARBOT_HOST:$CARBOT_PORT/api/wake-word")
    
    echo "Response: $response"
    echo -e "${GREEN}✅ Wake word triggered - check CarBot console for activity${NC}"
}

# Test standalone voice commands  
test_voice_commands() {
    echo -e "\n${BLUE}Testing voice commands (standalone)...${NC}"
    
    commands=(
        "Hello CarBot, how are you?"
        "What time is it?"
        "Tell me a joke"
        "Navigate to downtown"
        "Play some music"
        "Set temperature to 22 degrees"
    )
    
    for cmd in "${commands[@]}"; do
        echo -e "\n${YELLOW}Testing: \"$cmd\"${NC}"
        
        response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "{\"command\": \"$cmd\", \"expectResponse\": true, \"source\": \"standalone\"}" \
            "http://$CARBOT_HOST:$CARBOT_PORT/api/voice-command")
        
        echo "API Response: $(echo $response | jq -r '.message // .status // .' 2>/dev/null || echo $response)"
        echo -e "${GREEN}✅ Command sent - listen for voice response!${NC}"
        
        # Wait between commands
        sleep 4
    done
}

# Test browser interface (optional)
test_browser_interface() {
    echo -e "\n${BLUE}Browser interface available at:${NC}"
    echo "http://$CARBOT_HOST:$CARBOT_PORT/test-wake-word"
    echo ""
    echo "You can open this in your browser to:"
    echo "- Trigger wake word manually"
    echo "- Send voice commands"
    echo "- Monitor real-time status"
}

# Monitor instructions
show_monitoring_tips() {
    echo -e "\n${YELLOW}=== Monitoring Tips ===${NC}"
    echo "Watch your CarBot console for these messages:"
    echo ""
    echo -e "${GREEN}Expected flow:${NC}"
    echo "1. 🎯 Wake word triggered"
    echo "2. 🎤 Processing voice command: [your command]"
    echo "3. 🤖 Assistant response: [AI response]"
    echo "4. 🔊 Speaking: [response text]"
    echo "5. 🔊 Audio content generated, now playing..."
    echo "6. ✅ Speech playback completed"
    echo ""
    echo -e "${BLUE}You should HEAR the AI responses through your speakers!${NC}"
}

# Main execution
main() {
    echo "Starting standalone voice tests..."
    echo "Time: $(date)"
    echo ""
    
    check_carbot
    show_monitoring_tips
    test_browser_interface
    
    echo -e "\n${YELLOW}Press Enter to start voice tests...${NC}"
    read
    
    test_wake_word
    sleep 2
    
    test_voice_commands
    
    echo -e "\n${GREEN}=== Test Complete ===${NC}"
    echo "Your CarBot should be speaking responses!"
    echo ""
    echo "If you don't hear audio:"
    echo "1. Check your system volume"
    echo "2. Verify CarBot console shows TTS messages"
    echo "3. Try: say 'Hello My Car' and then speak a command"
}

main "$@"