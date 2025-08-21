#!/bin/bash

echo "📱 Installing CarBot on Android Automotive Emulator"
echo "=================================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${YELLOW}Step 1: Checking emulator status...${NC}"

# Check if emulator is running
if adb devices | grep -q emulator; then
    echo -e "${GREEN}✅ Automotive emulator detected${NC}"
else
    echo -e "${RED}❌ No emulator found. Please run ./setup-automotive-emulator.sh first${NC}"
    exit 1
fi

# Wait for emulator to be fully ready
echo -e "${YELLOW}Waiting for emulator to be ready...${NC}"
adb wait-for-device

# Verify it's an automotive emulator
EMULATOR_TYPE=$(adb shell getprop ro.build.characteristics)
if [[ "$EMULATOR_TYPE" == *"automotive"* ]]; then
    echo -e "${GREEN}✅ Confirmed Android Automotive OS emulator${NC}"
else
    echo -e "${YELLOW}⚠️  This may not be an Automotive emulator (characteristics: $EMULATOR_TYPE)${NC}"
fi

echo -e "\n${YELLOW}Step 2: Checking backend connectivity...${NC}"

# Test backend connection from emulator
if adb shell curl -s http://10.0.2.2:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend accessible from emulator${NC}"
else
    echo -e "${RED}❌ Backend not accessible. Make sure backend is running with: npm start${NC}"
    echo -e "${BLUE}Backend should be accessible at http://10.0.2.2:3000 from emulator${NC}"
fi

echo -e "\n${YELLOW}Step 3: Uninstalling previous version...${NC}"
adb uninstall com.aicarbot.app 2>/dev/null
echo -e "${GREEN}✅ Previous version removed${NC}"

echo -e "\n${YELLOW}Step 4: Installing CarBot APK...${NC}"

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "$APK_PATH" ]; then
    echo -e "${RED}❌ APK not found at $APK_PATH${NC}"
    echo -e "${BLUE}Please run ./build-automotive-apk.sh first${NC}"
    exit 1
fi

adb install "$APK_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CarBot installed successfully!${NC}"
else
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 5: Configuring automotive permissions...${NC}"

# Grant necessary permissions for automotive environment
adb shell pm grant com.aicarbot.app android.permission.RECORD_AUDIO
adb shell pm grant com.aicarbot.app android.permission.INTERNET
adb shell pm grant com.aicarbot.app android.permission.ACCESS_NETWORK_STATE
adb shell pm grant com.aicarbot.app android.permission.WAKE_LOCK
adb shell pm grant com.aicarbot.app android.permission.FOREGROUND_SERVICE

echo -e "${GREEN}✅ Permissions granted${NC}"

echo -e "\n${YELLOW}Step 6: Launching CarBot...${NC}"

# Launch the car app
adb shell am start -n com.aicarbot.app/com.aicarbot.app.car.AiCarBotService

# Also try launching as main activity
adb shell am start -n com.aicarbot.app/.MainActivity 2>/dev/null

echo -e "\n${YELLOW}Step 7: Checking app status...${NC}"

# Check if app is running
if adb shell ps | grep -q com.aicarbot.app; then
    echo -e "${GREEN}✅ CarBot is running on Automotive OS!${NC}"
else
    echo -e "${YELLOW}⚠️  App may not be running. Checking logs...${NC}"
    adb logcat -d | grep -i carbot | tail -10
fi

echo -e "\n${GREEN}🎉 CarBot Installation Complete!${NC}"
echo -e "\n${BLUE}How to use CarBot on Automotive emulator:${NC}"
echo "1. Look for CarBot in the car's app launcher"
echo "2. Say 'Hello My Car' to activate wake word"
echo "3. Or tap the microphone button"
echo "4. Ask questions like:"
echo "   • 'What's Elon Musk's latest tweet?'"
echo "   • 'Tell me the latest tech news'"
echo "   • 'What's the weather?'"
echo -e "\n${YELLOW}Debugging:${NC}"
echo "• View logs: adb logcat | grep -i carbot"
echo "• Check network: adb shell curl http://10.0.2.2:3000/api/health"
echo "• Restart app: adb shell am force-stop com.aicarbot.app && adb shell am start -n com.aicarbot.app/.MainActivity"