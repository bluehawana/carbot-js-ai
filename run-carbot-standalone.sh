#!/bin/bash

# CarBot Standalone Launcher
# Runs CarBot AI without any Android dependencies

echo "🚗 CarBot Standalone Mode"
echo "========================"
echo ""
echo "This will run CarBot as a standalone voice assistant"
echo "No Android app or emulator required!"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Environment setup
setup_environment() {
    echo -e "${YELLOW}Setting up environment...${NC}"
    
    # Ensure key environment variables are set for standalone mode
    export ENABLE_STARTUP_GREETING="true"
    export GREETING_MESSAGE="Hello! I'm your CarBot AI assistant. Say 'Hello My Car' to activate me."
    export VOICE_ASSISTANT_NAME="CarBot"
    export AI_PROVIDER="groq"
    export AUDIO_QUALITY="medium"
    export WAKE_WORD_SENSITIVITY="medium"
    
    echo -e "${GREEN}✅ Environment configured for standalone mode${NC}"
}

# Check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        echo "Please install Node.js: https://nodejs.org/"
        exit 1
    fi
    
    # Check npm packages
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing npm packages...${NC}"
        npm install
    fi
    
    # Check audio system
    if command -v say &> /dev/null; then
        echo -e "${GREEN}✅ macOS audio system (say) available${NC}"
    elif command -v espeak &> /dev/null; then
        echo -e "${GREEN}✅ Linux audio system (espeak) available${NC}"
    else
        echo -e "${YELLOW}⚠️  Limited audio system detected${NC}"
    fi
    
    echo -e "${GREEN}✅ Dependencies check complete${NC}"
}

# Display usage instructions
show_usage() {
    echo -e "\n${BLUE}=== How to Use CarBot Standalone ===${NC}"
    echo ""
    echo "1. Voice Activation:"
    echo "   • Say: 'Hello My Car'"
    echo "   • Then speak your command"
    echo ""
    echo "2. Manual API Testing:"
    echo "   • Open browser: http://localhost:3000/test-wake-word"
    echo "   • Or use test script: ./test-standalone-voice.sh"
    echo ""
    echo "3. Example Commands:"
    echo "   • 'What time is it?'"
    echo "   • 'Tell me a joke'"
    echo "   • 'Navigate to downtown'"
    echo "   • 'Play some music'"
    echo "   • 'Set temperature to 22 degrees'"
    echo ""
    echo -e "${GREEN}The AI will respond with VOICE - you'll hear it speak!${NC}"
    echo ""
}

# Start CarBot
start_carbot() {
    echo -e "${YELLOW}Starting CarBot in standalone mode...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    
    # Start the application
    node src/index.js
}

# Main execution
main() {
    echo "Starting CarBot Standalone Mode..."
    echo "Current directory: $(pwd)"
    echo ""
    
    setup_environment
    check_dependencies
    show_usage
    
    echo -e "${YELLOW}Press Enter to start CarBot...${NC}"
    read
    
    start_carbot
}

# Check if we're in the right directory
if [ ! -f "src/index.js" ]; then
    echo -e "${RED}❌ Error: Must be run from CarBot project directory${NC}"
    echo "Please cd to: /Users/bluehawana/Projects/carbot-js-ai-androidauto"
    exit 1
fi

main "$@"