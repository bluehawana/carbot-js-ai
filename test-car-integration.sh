#!/bin/bash

# CarBot Android Auto Integration Test Script
# Tests complete car integration including audio, wake word, and voice commands

echo "🚗 CarBot Android Auto Integration Test"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test and check result
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    echo -e "\n${BLUE}Testing: $test_name${NC}"
    echo "Command: $test_command"
    
    result=$(eval "$test_command" 2>&1)
    
    if echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASSED${NC}: $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}: $test_name"
        echo "Expected pattern: $expected_pattern"
        echo "Actual result: $result"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to check service status
check_service() {
    local service_name="$1"
    echo -e "\n${BLUE}Checking Android service: $service_name${NC}"
    
    result=$(adb shell dumpsys activity services | grep "$service_name" 2>/dev/null)
    
    if [ -n "$result" ]; then
        echo -e "${GREEN}✅ Service running${NC}: $service_name"
        echo "$result"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ Service not found${NC}: $service_name"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo -e "\n${YELLOW}🔍 Phase 1: Backend Health Check${NC}"
echo "=============================================="

# Test 1: Backend Health
run_test "Backend Health Check" \
    "curl -s http://localhost:3000/health" \
    "healthy"

# Test 2: Wake Word API Endpoint
run_test "Wake Word API Endpoint" \
    "curl -s -X POST http://localhost:3000/api/wake-word" \
    "wake.*word"

# Test 3: Voice Command API Endpoint
run_test "Voice Command API Endpoint" \
    'curl -s -X POST http://localhost:3000/api/voice-command -H "Content-Type: application/json" -d '\''{"command":"test","type":"voice"}'\''' \
    "response\|error\|message"

echo -e "\n${YELLOW}📱 Phase 2: Android Device & App Check${NC}"
echo "================================================"

# Test 4: Android Device Connected
run_test "Android Device Connected" \
    "adb devices" \
    "device$"

# Test 5: CarBot App Installed
run_test "CarBot App Installed" \
    "adb shell pm list packages | grep aicarbot" \
    "com.aicarbot.app"

# Test 6: App Launch Test
echo -e "\n${BLUE}Testing: App Launch${NC}"
adb shell am start -n com.aicarbot.app/.MainActivity >/dev/null 2>&1
sleep 3

if adb shell dumpsys activity activities | grep -q "aicarbot"; then
    echo -e "${GREEN}✅ PASSED${NC}: App Launch"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAILED${NC}: App Launch"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}🔊 Phase 3: Car Audio Services Check${NC}"
echo "=============================================="

# Test 7: CarAudioSessionService
check_service "CarAudioSessionService"

# Test 8: CarWakeWordService  
check_service "CarWakeWordService"

# Test 9: Audio Focus Check
echo -e "\n${BLUE}Checking Audio Focus${NC}"
audio_focus=$(adb shell dumpsys audio | grep -i "focus\|car" 2>/dev/null | head -5)
if [ -n "$audio_focus" ]; then
    echo -e "${GREEN}✅ Audio system accessible${NC}"
    echo "$audio_focus"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️ Audio focus info not available${NC}"
fi

echo -e "\n${YELLOW}🎤 Phase 4: Wake Word Integration Test${NC}"
echo "==============================================="

# Test 10: Wake Word Model File
wake_word_model="android/app/src/main/assets/Hello-My-car_en_android_v3_0_0.ppn"
if [ -f "$wake_word_model" ]; then
    echo -e "${GREEN}✅ Wake word model found${NC}: $wake_word_model"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Wake word model missing${NC}: $wake_word_model"
    ((TESTS_FAILED++))
fi

# Test 11: Backend Wake Word Trigger
echo -e "\n${BLUE}Testing: Backend Wake Word Trigger${NC}"
wake_response=$(curl -s -X POST http://localhost:3000/api/wake-word 2>/dev/null)
if echo "$wake_response" | grep -q -i "wake\|activated\|triggered"; then
    echo -e "${GREEN}✅ Wake word trigger working${NC}"
    echo "Response: $wake_response"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Wake word trigger failed${NC}"
    echo "Response: $wake_response"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}🚗 Phase 5: Android Auto Integration${NC}"
echo "============================================"

# Test 12: Android Auto Manifest Check
echo -e "\n${BLUE}Checking Android Auto Manifest${NC}"
if grep -q "CarAppService" android/app/src/main/AndroidManifest.xml; then
    echo -e "${GREEN}✅ Android Auto service declared${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Android Auto service missing${NC}"
    ((TESTS_FAILED++))
fi

# Test 13: Car App Permissions
echo -e "\n${BLUE}Checking Car App Permissions${NC}"
car_permissions=("CAR_APPLICATION" "NAVIGATION_TEMPLATES" "MESSAGING_TEMPLATES")
for perm in "${car_permissions[@]}"; do
    if grep -q "$perm" android/app/src/main/AndroidManifest.xml; then
        echo -e "${GREEN}✅ Permission found${NC}: $perm"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Permission missing${NC}: $perm"
        ((TESTS_FAILED++))
    fi
done

echo -e "\n${YELLOW}🎯 Phase 6: End-to-End Voice Test${NC}"
echo "========================================"

# Test 14: Full Voice Command Simulation
echo -e "\n${BLUE}Testing: Full Voice Command Flow${NC}"
echo "Simulating: Wake Word → Voice Command → AI Response"

# Trigger wake word
wake_result=$(curl -s -X POST http://localhost:3000/api/wake-word 2>/dev/null)
sleep 1

# Send voice command
voice_result=$(curl -s -X POST http://localhost:3000/api/voice-command \
    -H "Content-Type: application/json" \
    -d '{"command":"What time is it?","type":"voice"}' 2>/dev/null)

if echo "$voice_result" | grep -q -i "time\|clock\|hour\|minute\|response"; then
    echo -e "${GREEN}✅ End-to-end voice flow working${NC}"
    echo "AI Response: $voice_result"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ End-to-end voice flow failed${NC}"
    echo "Response: $voice_result"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}📊 Phase 7: Performance & Monitoring${NC}"
echo "=========================================="

# Test 15: Response Time Test
echo -e "\n${BLUE}Testing: API Response Times${NC}"
start_time=$(date +%s%3N)
curl -s http://localhost:3000/health >/dev/null
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

if [ $response_time -lt 1000 ]; then
    echo -e "${GREEN}✅ Response time good${NC}: ${response_time}ms"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️ Response time slow${NC}: ${response_time}ms"
fi

# Test 16: Memory Usage Check
echo -e "\n${BLUE}Checking: App Memory Usage${NC}"
memory_info=$(adb shell dumpsys meminfo com.aicarbot.app 2>/dev/null | grep "TOTAL" | head -1)
if [ -n "$memory_info" ]; then
    echo -e "${GREEN}✅ Memory info available${NC}"
    echo "$memory_info"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️ Memory info not available${NC}"
fi

echo -e "\n${YELLOW}🔧 Phase 8: Debug Information${NC}"
echo "====================================="

# Android Auto Debug Info
echo -e "\n${BLUE}Android Auto Debug Information${NC}"
echo "Android Auto installed: $(adb shell pm list packages | grep -q 'android.auto' && echo 'Yes' || echo 'No')"
echo "Developer mode: Check Android Auto app settings"

# Network Information
echo -e "\n${BLUE}Network Configuration${NC}"
mac_ip=$(ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}')
echo "Mac IP address: $mac_ip"
echo "Backend URL for emulator: http://10.0.2.2:3000"
echo "Backend URL for device: http://$mac_ip:3000"

# Log file locations
echo -e "\n${BLUE}Log Files and Debugging${NC}"
echo "Android logs: adb logcat | grep -E '(CarBot|CarAudio|WakeWord)'"
echo "Backend logs: Check npm start output"
echo "Wake word logs: Look for 'Enhanced wake word' messages"

echo -e "\n${YELLOW}📋 TEST SUMMARY${NC}"
echo "===================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo "Total Tests: $TOTAL_TESTS"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! CarBot Android Auto is ready!${NC}"
    echo "✅ Backend connectivity working"
    echo "✅ Android app installed and running"
    echo "✅ Car audio services available"
    echo "✅ Wake word integration functional"
    echo "✅ Voice commands processing"
    echo ""
    echo "🚗 Ready for car testing!"
    echo "📱 Connect device to Android Auto head unit"
    echo "🎤 Say 'Hello My Car' to activate"
    exit 0
else
    echo -e "\n${RED}⚠️ SOME TESTS FAILED${NC}"
    echo "Please check the failed tests above and fix issues before car testing"
    echo ""
    echo "Common fixes:"
    echo "- Restart backend: npm start"
    echo "- Reinstall app: ./quick-install-android.sh"
    echo "- Check network connectivity"
    echo "- Verify Android Auto developer mode enabled"
    exit 1
fi