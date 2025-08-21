#!/bin/bash

# Comprehensive CarBot Voice Interaction Test Suite
# Tests the complete voice pipeline from input to audio output

echo "🚗 CarBot Voice Interaction Test Suite"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
CARBOT_HOST="localhost"
CARBOT_PORT="3000"
WAIT_TIME=3

# Function to test API endpoint
test_api_endpoint() {
    local endpoint=$1
    local data=$2
    local description=$3
    
    echo -e "${BLUE}Testing: $description${NC}"
    
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "http://$CARBOT_HOST:$CARBOT_PORT$endpoint" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1 | cut -d: -f2)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ SUCCESS${NC}: $description"
        echo "   Response: $(echo $response_body | jq -r '.message // .status // .' 2>/dev/null || echo $response_body)"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}: $description (HTTP $http_code)"
        echo "   Response: $response_body"
        return 1
    fi
}

# Function to check if CarBot is running
check_carbot_status() {
    echo -e "${YELLOW}Checking CarBot server status...${NC}"
    
    if curl -s "http://$CARBOT_HOST:$CARBOT_PORT/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ CarBot server is running${NC}"
        return 0
    else
        echo -e "${RED}❌ CarBot server is not running${NC}"
        echo "Please start CarBot with: npm start"
        exit 1
    fi
}

# Function to test wake word activation
test_wake_word() {
    echo -e "\n${YELLOW}=== Wake Word Activation Tests ===${NC}"
    
    test_api_endpoint "/api/wake-word" \
        '{"source": "manual", "mode": "api"}' \
        "Manual wake word trigger"
    
    sleep $WAIT_TIME
}

# Function to test voice commands
test_voice_commands() {
    echo -e "\n${YELLOW}=== Voice Command Tests ===${NC}"
    
    # Test basic greeting
    test_api_endpoint "/api/voice-command" \
        '{"command": "Hello CarBot", "expectResponse": true}' \
        "Basic greeting command"
    
    sleep $WAIT_TIME
    
    # Test navigation command
    test_api_endpoint "/api/voice-command" \
        '{"command": "Navigate to downtown", "expectResponse": true}' \
        "Navigation command"
    
    sleep $WAIT_TIME
    
    # Test music command
    test_api_endpoint "/api/voice-command" \
        '{"command": "Play some music", "expectResponse": true}' \
        "Music control command"
    
    sleep $WAIT_TIME
    
    # Test phone command
    test_api_endpoint "/api/voice-command" \
        '{"command": "Call John", "expectResponse": true}' \
        "Phone call command"
    
    sleep $WAIT_TIME
    
    # Test climate command
    test_api_endpoint "/api/voice-command" \
        '{"command": "Set temperature to 22 degrees", "expectResponse": true}' \
        "Climate control command"
    
    sleep $WAIT_TIME
    
    # Test general question
    test_api_endpoint "/api/voice-command" \
        '{"command": "What time is it?", "expectResponse": true}' \
        "General information query"
    
    sleep $WAIT_TIME
}

# Function to test system health
test_system_health() {
    echo -e "\n${YELLOW}=== System Health Tests ===${NC}"
    
    test_api_endpoint "/health" \
        '{}' \
        "System health check"
    
    # Test TTS service specifically
    test_api_endpoint "/api/voice-command" \
        '{"command": "Test speech synthesis", "expectResponse": true, "priority": "urgent"}' \
        "TTS service test"
    
    sleep $WAIT_TIME
}

# Function to test error handling
test_error_handling() {
    echo -e "\n${YELLOW}=== Error Handling Tests ===${NC}"
    
    # Test empty command
    test_api_endpoint "/api/voice-command" \
        '{"command": "", "expectResponse": true}' \
        "Empty command handling"
    
    sleep $WAIT_TIME
    
    # Test malformed request
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"invalid": "json"' \
        "http://$CARBOT_HOST:$CARBOT_PORT/api/voice-command" >/dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        echo -e "${GREEN}✅ SUCCESS${NC}: Malformed request properly rejected"
    else
        echo -e "${YELLOW}⚠️  WARNING${NC}: Malformed request was accepted"
    fi
}

# Function to check audio output capabilities
test_audio_capabilities() {
    echo -e "\n${YELLOW}=== Audio System Tests ===${NC}"
    
    # Check if system has audio output
    if command -v say >/dev/null 2>&1; then
        echo -e "${GREEN}✅ macOS TTS (say) available${NC}"
    elif command -v espeak >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Linux TTS (espeak) available${NC}"
    elif command -v powershell >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Windows TTS (PowerShell) available${NC}"
    else
        echo -e "${RED}❌ No system TTS found${NC}"
    fi
    
    # Check audio players
    if command -v afplay >/dev/null 2>&1; then
        echo -e "${GREEN}✅ macOS audio player (afplay) available${NC}"
    elif command -v paplay >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Linux audio player (paplay) available${NC}"
    elif command -v aplay >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Linux audio player (aplay) available${NC}"
    else
        echo -e "${YELLOW}⚠️  Limited audio playback capabilities${NC}"
    fi
}

# Function to monitor server logs
monitor_server_logs() {
    echo -e "\n${YELLOW}=== Monitoring Server Response ===${NC}"
    echo "Watch the CarBot server console for:"
    echo "  🔊 Speaking: [message]"
    echo "  🔊 Audio content generated, now playing..."
    echo "  ✅ Speech playback completed"
    echo ""
}

# Main test execution
main() {
    echo "Starting comprehensive voice interaction tests..."
    echo "Time: $(date)"
    echo ""
    
    # Pre-flight checks
    check_carbot_status
    test_audio_capabilities
    
    # Core functionality tests
    monitor_server_logs
    test_wake_word
    test_voice_commands
    test_system_health
    test_error_handling
    
    echo -e "\n${YELLOW}=== Test Summary ===${NC}"
    echo "All test commands have been sent."
    echo "Check the CarBot server console for detailed response logs."
    echo ""
    echo -e "${BLUE}Expected successful flow:${NC}"
    echo "1. Wake word detected"
    echo "2. Voice command processed"
    echo "3. AI response generated"
    echo "4. Text-to-speech synthesis"
    echo "5. Audio playback to speakers"
    echo ""
    echo -e "${GREEN}If you hear audio responses, the voice system is working correctly!${NC}"
}

# Run the test suite
main "$@"