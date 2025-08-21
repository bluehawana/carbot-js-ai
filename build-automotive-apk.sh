#!/bin/bash

echo "🔧 Building CarBot for Android Automotive OS"
echo "============================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get machine IP for backend connection
MACHINE_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
echo -e "${BLUE}Machine IP: $MACHINE_IP${NC}"

echo -e "\n${YELLOW}Step 1: Updating backend URL for emulator...${NC}"

# Update API client for emulator (10.0.2.2 maps to host machine)
EMULATOR_URL="http://10.0.2.2:3000"
sed -i.bak "s|http://[0-9.]*:3000|$EMULATOR_URL|g" android/app/src/main/java/com/aicarbot/app/car/CarBotApiClient.java
echo -e "${GREEN}✅ Backend URL updated to: $EMULATOR_URL${NC}"

echo -e "\n${YELLOW}Step 2: Verifying Android Automotive configuration...${NC}"

# Check if manifest is properly configured for Automotive
if grep -q "android.hardware.type.automotive" android/app/src/main/AndroidManifest.xml; then
    echo -e "${GREEN}✅ Automotive feature declared${NC}"
else
    echo -e "${YELLOW}⚠️  Adding Automotive feature declaration...${NC}"
    # Add automotive feature before </manifest>
    sed -i.bak '/<\/manifest>/i\    <uses-feature android:name="android.hardware.type.automotive" android:required="true" />' android/app/src/main/AndroidManifest.xml
fi

# Check for car app service
if grep -q "android.car.app" android/app/src/main/AndroidManifest.xml; then
    echo -e "${GREEN}✅ Car app service configured${NC}"
else
    echo -e "${RED}❌ Car app service not found in manifest${NC}"
fi

echo -e "\n${YELLOW}Step 3: Cleaning previous builds...${NC}"
cd android
./gradlew clean

echo -e "\n${YELLOW}Step 4: Building Automotive APK...${NC}"
./gradlew assembleDebug

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Automotive APK built successfully!${NC}"
    
    APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    
    echo -e "${BLUE}APK Location: $APK_PATH${NC}"
    echo -e "${BLUE}APK Size: $APK_SIZE${NC}"
    
    # Verify APK is for automotive
    echo -e "\n${YELLOW}Step 5: Verifying APK configuration...${NC}"
    
    if aapt dump badging "$APK_PATH" | grep -q "android.hardware.type.automotive"; then
        echo -e "${GREEN}✅ APK configured for Automotive OS${NC}"
    else
        echo -e "${RED}❌ APK not configured for Automotive OS${NC}"
    fi
    
    if aapt dump badging "$APK_PATH" | grep -q "car.app"; then
        echo -e "${GREEN}✅ Car app service detected${NC}"
    else
        echo -e "${YELLOW}⚠️  Car app service not detected${NC}"
    fi
    
    echo -e "\n${GREEN}🎉 Ready to install on Automotive emulator!${NC}"
    echo -e "${BLUE}Next: Run ./install-carbot-automotive.sh${NC}"
    
else
    echo -e "\n${RED}❌ Build failed!${NC}"
    echo -e "${BLUE}Check the logs above for errors.${NC}"
    exit 1
fi

cd ..