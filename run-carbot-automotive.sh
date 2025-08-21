#!/bin/bash

echo "🚗 CarBot Android Automotive OS - Complete Setup & Launch"
echo "========================================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for user input
wait_for_user() {
    echo -e "${YELLOW}$1${NC}"
    read -p "Press Enter to continue..."
    echo ""
}

echo -e "${BLUE}This script will:${NC}"
echo "1. Set up Android Automotive OS emulator"
echo "2. Configure CarBot for automotive"
echo "3. Build and install the APK"
echo "4. Test all functionality"
echo "5. Launch CarBot in the automotive emulator"
echo ""

wait_for_user "Ready to start? Make sure you have Android Studio installed."

# Step 1: Prerequisites check
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

if ! command_exists "node"; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command_exists "npm"; then
    echo -e "${RED}❌ npm not found. Please install Node.js with npm${NC}"
    exit 1
fi

if ! command_exists "avdmanager"; then
    echo -e "${RED}❌ Android SDK not found. Please install Android Studio and configure SDK${NC}"
    echo -e "${BLUE}Add to your shell profile:${NC}"
    echo "export ANDROID_HOME=\$HOME/Library/Android/sdk"
    echo "export PATH=\$PATH:\$ANDROID_HOME/emulator:\$ANDROID_HOME/tools:\$ANDROID_HOME/platform-tools"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites found${NC}"

# Step 2: Backend setup
echo -e "\n${YELLOW}Step 2: Setting up backend...${NC}"

if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "Creating environment file..."
    cp .env.example .env 2>/dev/null || echo "# Add your API keys here
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
PICOVOICE_ACCESS_KEY=your-picovoice-key" > .env
    
    echo -e "${YELLOW}⚠️  IMPORTANT: Add your API keys to .env file!${NC}"
    echo "• GROQ_API_KEY (free at https://console.groq.com/)"
    echo "• OPENAI_API_KEY (optional, for advanced features)"
    
    wait_for_user "Please edit .env file with your API keys, then continue."
fi

# Start backend
echo "Starting CarBot backend..."
npm start &
BACKEND_PID=$!

echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
sleep 3

# Step 3: Automotive emulator setup
echo -e "\n${YELLOW}Step 3: Setting up Android Automotive emulator...${NC}"
./setup-automotive-emulator.sh

wait_for_user "Emulator should be running. Continue when you see the automotive interface."

# Step 4: Build APK
echo -e "\n${YELLOW}Step 4: Building automotive APK...${NC}"
./build-automotive-apk.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Step 5: Install on emulator
echo -e "\n${YELLOW}Step 5: Installing CarBot on automotive emulator...${NC}"
./install-carbot-automotive.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Installation failed. Please check the errors above.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Step 6: Run tests
echo -e "\n${YELLOW}Step 6: Testing CarBot functionality...${NC}"
./test-carbot-automotive.sh

# Step 7: Interactive demo
echo -e "\n${GREEN}🎉 CarBot is ready in your automotive emulator!${NC}"
echo -e "\n${BLUE}🚗 How to use CarBot:${NC}"
echo "1. Look for 'AI CarBot' in the emulator's app launcher"
echo "2. Tap to open the app"
echo "3. Say 'Hello My Car' to activate voice"
echo "4. Or tap the microphone button"
echo ""
echo -e "${YELLOW}🎤 Try these voice commands:${NC}"
echo "• 'Write me a haiku about driving' (AI creativity)"
echo "• 'Explain quantum computing simply' (AI knowledge)"
echo "• 'Tell me about the latest tech news' (web search)"
echo "• 'What's the weather like?' (requires weather API key)"
echo "• 'What's Elon Musk's latest tweet?' (requires Twitter API key)"
echo "• 'Navigate to the nearest coffee shop' (car integration)"
echo ""
echo -e "${BLUE}🔧 Debugging commands:${NC}"
echo "• View logs: adb logcat | grep -i carbot"
echo "• Restart app: adb shell am force-stop com.aicarbot.app"
echo "• Backend health: curl http://localhost:3000/api/health"
echo ""

echo -e "${GREEN}CarBot is now smarter than Google Assistant in your car! 🚀${NC}"
echo -e "${BLUE}Backend running at: http://localhost:3000${NC}"
echo -e "${BLUE}Backend PID: $BACKEND_PID${NC}"

# Keep script running to maintain backend
echo -e "\n${YELLOW}Press Ctrl+C to stop backend and exit.${NC}"

# Trap Ctrl+C to cleanup
trap "echo -e '\n${YELLOW}Stopping backend...${NC}'; kill $BACKEND_PID 2>/dev/null; exit 0" INT

# Keep backend running
wait $BACKEND_PID