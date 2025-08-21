#!/bin/bash

echo "🚗 CarBot Android Auto Deployment Script"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "\n${YELLOW}Step 1: Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v adb &> /dev/null; then
    echo -e "${RED}❌ ADB not found. Please install Android SDK${NC}"
    exit 1
fi

# Step 2: Get machine IP
echo -e "\n${YELLOW}Step 2: Getting machine IP address...${NC}"
MACHINE_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
echo -e "${GREEN}✅ Machine IP: $MACHINE_IP${NC}"

# Step 3: Update backend URL
echo -e "\n${YELLOW}Step 3: Updating backend URL in Android app...${NC}"
sed -i.bak "s|http://[0-9.]*:3000|http://$MACHINE_IP:3000|g" android/app/src/main/java/com/aicarbot/app/car/CarBotApiClient.java
echo -e "${GREEN}✅ Backend URL updated to: http://$MACHINE_IP:3000${NC}"

# Step 4: Check if backend is running
echo -e "\n${YELLOW}Step 4: Checking backend status...${NC}"
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not running. Starting it now...${NC}"
    npm start &
    BACKEND_PID=$!
    sleep 5
fi

# Step 5: Build APK
echo -e "\n${YELLOW}Step 5: Building Android APK...${NC}"
cd android
./gradlew clean assembleDebug
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ APK built successfully${NC}"
else
    echo -e "${RED}❌ APK build failed${NC}"
    exit 1
fi
cd ..

# Step 6: Install on device
echo -e "\n${YELLOW}Step 6: Installing on Android device...${NC}"
adb devices | grep -q device
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ No Android device connected. Please connect your phone with USB debugging enabled.${NC}"
    exit 1
fi

adb uninstall com.aicarbot.app 2>/dev/null
adb install android/app/build/outputs/apk/debug/app-debug.apk
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CarBot installed successfully${NC}"
else
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi

# Step 7: Quick test
echo -e "\n${YELLOW}Step 7: Running quick test...${NC}"
echo "Testing wake word endpoint..."
curl -s -X POST http://localhost:3000/api/wake-word | grep -q "success"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Wake word endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  Wake word endpoint not responding${NC}"
fi

# Step 8: Launch Android Auto
echo -e "\n${YELLOW}Step 8: Launching Android Auto...${NC}"
adb shell am start -a android.intent.action.MAIN -n com.google.android.projection.gearhead/.vanagon.VanaGonMainActivity 2>/dev/null
echo -e "${GREEN}✅ Android Auto launched${NC}"

# Final instructions
echo -e "\n${GREEN}🎉 CarBot is ready for your car!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Connect your phone to your car via USB"
echo "2. Open Android Auto on your car's display"
echo "3. Find 'AI CarBot' in the app launcher"
echo "4. Say 'Hello My Car' to activate"
echo -e "\n${YELLOW}Test these AI commands:${NC}"
echo "- 'What's Elon Musk's latest tweet?'"
echo "- 'Tell me the latest tech news'"
echo "- 'What's the weather like?'"
echo "- 'Play some music' (if integrated)"
echo -e "\n${GREEN}Backend running at: http://$MACHINE_IP:3000${NC}"
echo -e "${GREEN}Logs: adb logcat | grep -i carbot${NC}"