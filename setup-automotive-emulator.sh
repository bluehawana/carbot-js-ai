#!/bin/bash

echo "🚗 Android Automotive OS Emulator Setup"
echo "======================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${YELLOW}Step 1: Checking Android SDK...${NC}"

# Check if Android SDK is available
if ! command -v avdmanager &> /dev/null; then
    echo -e "${RED}❌ Android SDK not found. Please install Android Studio and set up SDK.${NC}"
    echo -e "${BLUE}Add to your ~/.zshrc or ~/.bashrc:${NC}"
    echo -e "export ANDROID_HOME=\$HOME/Library/Android/sdk"
    echo -e "export PATH=\$PATH:\$ANDROID_HOME/emulator:\$ANDROID_HOME/tools:\$ANDROID_HOME/platform-tools"
    exit 1
fi

echo -e "${GREEN}✅ Android SDK found${NC}"

echo -e "\n${YELLOW}Step 2: Installing Android Automotive System Images...${NC}"

# Install required SDK packages for Automotive
sdkmanager --install "system-images;android-33;android-automotive;x86_64"
sdkmanager --install "system-images;android-34;android-automotive;x86_64" 
sdkmanager --install "platforms;android-33"
sdkmanager --install "platforms;android-34"

echo -e "\n${YELLOW}Step 3: Creating Automotive AVD...${NC}"

# Delete existing AVD if it exists
avdmanager delete avd -n CarBot_Automotive 2>/dev/null

# Create new Automotive AVD
echo "no" | avdmanager create avd \
    -n CarBot_Automotive \
    -k "system-images;android-33;android-automotive;x86_64" \
    -d "automotive_1024p_landscape"

echo -e "\n${YELLOW}Step 4: Configuring AVD for CarBot...${NC}"

# Configure AVD with optimal settings for CarBot
AVD_CONFIG="$HOME/.android/avd/CarBot_Automotive.avd/config.ini"

if [ -f "$AVD_CONFIG" ]; then
    # Add CarBot-specific configurations
    echo "hw.camera.front=yes" >> "$AVD_CONFIG"
    echo "hw.camera.back=yes" >> "$AVD_CONFIG"
    echo "hw.audioInput=yes" >> "$AVD_CONFIG"
    echo "hw.audioOutput=yes" >> "$AVD_CONFIG"
    echo "hw.gps=yes" >> "$AVD_CONFIG"
    echo "hw.sensors.orientation=yes" >> "$AVD_CONFIG"
    echo "hw.sensors.proximity=yes" >> "$AVD_CONFIG"
    echo "vm.heapSize=256" >> "$AVD_CONFIG"
    echo "runtime.network.latency=none" >> "$AVD_CONFIG"
    echo "runtime.network.speed=full" >> "$AVD_CONFIG"
    echo -e "${GREEN}✅ AVD configured for CarBot${NC}"
fi

echo -e "\n${YELLOW}Step 5: Starting Automotive Emulator...${NC}"
echo -e "${BLUE}This may take a few minutes on first boot...${NC}"

# Start the emulator with optimal settings
emulator -avd CarBot_Automotive \
    -netdelay none \
    -netspeed full \
    -camera-front webcam0 \
    -camera-back none \
    -gpu swiftshader_indirect \
    -no-snapshot-save \
    -wipe-data &

EMULATOR_PID=$!

echo -e "\n${YELLOW}Waiting for emulator to boot...${NC}"

# Wait for emulator to be ready
adb wait-for-device

# Wait for system to be fully booted
while [ "`adb shell getprop sys.boot_completed`" != "1" ]; do
    echo "Waiting for system boot..."
    sleep 5
done

echo -e "${GREEN}✅ Android Automotive emulator is ready!${NC}"

echo -e "\n${YELLOW}Step 6: Enabling developer options...${NC}"

# Enable developer options and USB debugging
adb shell settings put global development_settings_enabled 1
adb shell settings put secure adb_enabled 1
adb shell settings put system accelerometer_rotation 0

echo -e "\n${GREEN}🎉 Setup Complete!${NC}"
echo -e "\n${BLUE}Your Android Automotive emulator is now running with:${NC}"
echo "• Audio input/output enabled"
echo "• Camera support"
echo "• GPS enabled"
echo "• Developer options active"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Run ./build-automotive-apk.sh to build the APK"
echo "2. Run ./install-carbot-automotive.sh to install CarBot"
echo "3. Test with ./test-carbot-automotive.sh"
echo -e "\n${BLUE}Emulator PID: $EMULATOR_PID${NC}"
echo -e "${BLUE}To stop: kill $EMULATOR_PID${NC}"