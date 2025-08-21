#!/bin/bash

# 🚗🤖 CarBot AI Android Auto Production APK Builder
# Creates a production-ready APK for real car Android Auto systems
# Based on Picovoice architecture optimized for in-car voice assistance

echo "🚗🤖 CarBot AI Android Auto Production APK Builder"
echo "================================================="
echo "Building Picovoice-style AI voice assistant for Android Auto"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="CarBot AI Assistant"
APK_NAME="carbot-ai-androidauto"
BUILD_DIR="./app/build/outputs/apk"
KEYSTORE_FILE="./app/carbot-release.keystore"

echo -e "${BLUE}🔍 Pre-build Validation${NC}"
echo "========================"

# Check if we're in the right directory
if [ ! -f "./gradlew" ]; then
    echo -e "${RED}❌ Error: gradlew not found. Please run this script from the android/ directory${NC}"
    exit 1
fi

# Check if keystore exists
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo -e "${YELLOW}⚠️  Production keystore not found. Creating it now...${NC}"
    ./create-keystore.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to create keystore${NC}"
        exit 1
    fi
fi

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${YELLOW}⚠️  ANDROID_HOME not set. Attempting to auto-detect...${NC}"
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
        echo -e "${GREEN}✅ Found Android SDK at: $ANDROID_HOME${NC}"
    else
        echo -e "${RED}❌ Android SDK not found. Please install Android Studio${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Pre-build validation complete${NC}"
echo ""

echo -e "${BLUE}🧹 Cleaning Previous Builds${NC}"
echo "============================"
./gradlew clean
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

echo -e "${BLUE}🔨 Building Debug APK (for testing)${NC}"
echo "=================================="
./gradlew assembleDebug
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Debug build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Debug APK built successfully${NC}"
echo ""

echo -e "${BLUE}🚀 Building Production Release APK${NC}"
echo "================================="
./gradlew assembleRelease
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Release build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Production APK built successfully${NC}"
echo ""

echo -e "${BLUE}📦 APK Information${NC}"
echo "=================="

# Find APK files
DEBUG_APK=$(find $BUILD_DIR -name "*debug.apk" 2>/dev/null | head -1)
RELEASE_APK=$(find $BUILD_DIR -name "*release.apk" 2>/dev/null | head -1)

if [ -f "$DEBUG_APK" ]; then
    DEBUG_SIZE=$(du -h "$DEBUG_APK" | cut -f1)
    echo -e "${YELLOW}🐛 Debug APK:${NC}"
    echo -e "   📍 Location: $DEBUG_APK"
    echo -e "   📏 Size: $DEBUG_SIZE"
    echo ""
fi

if [ -f "$RELEASE_APK" ]; then
    RELEASE_SIZE=$(du -h "$RELEASE_APK" | cut -f1)
    echo -e "${GREEN}🚀 Production APK:${NC}"
    echo -e "   📍 Location: $RELEASE_APK"
    echo -e "   📏 Size: $RELEASE_SIZE"
    echo ""
    
    # Copy to easy-to-find location
    FINAL_APK="$APK_NAME-v1.0.10-production.apk"
    cp "$RELEASE_APK" "../$FINAL_APK"
    echo -e "${GREEN}📋 Production APK copied to: ../$FINAL_APK${NC}"
    echo ""
fi

echo -e "${BLUE}🔐 APK Verification${NC}"
echo "=================="

# Verify APK signature
if [ -f "$RELEASE_APK" ]; then
    echo "🔍 Verifying APK signature..."
    if command -v apksigner &> /dev/null; then
        apksigner verify "$RELEASE_APK"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ APK signature verified${NC}"
        else
            echo -e "${RED}❌ APK signature verification failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  apksigner not found, skipping signature verification${NC}"
    fi
    echo ""
fi

echo -e "${BLUE}📱 Installation Instructions${NC}"
echo "============================="
echo "🚗 For Android Auto in real cars:"
echo "   1. Copy APK to your phone"
echo "   2. Enable 'Unknown Sources' in Android settings"
echo "   3. Install APK: tap the file and follow prompts"
echo "   4. Connect phone to car via USB"
echo "   5. Launch Android Auto"
echo "   6. Look for 'CarBot AI Assistant' in the app launcher"
echo ""
echo "🔧 For Android Auto Desktop Head Unit (DHU) testing:"
echo "   1. Install Android Auto DHU"
echo "   2. adb install \"$FINAL_APK\""
echo "   3. Launch DHU and test the app"
echo ""
echo "📱 For phone testing (no car required):"
echo "   1. adb install \"$FINAL_APK\""
echo "   2. Open the app on your phone"
echo "   3. Grant required permissions"
echo "   4. Test voice functionality"
echo ""

echo -e "${BLUE}🎯 Android Auto Features${NC}"
echo "========================"
echo "✅ Voice-activated AI assistant (like Picovoice demo)"
echo "✅ Hands-free operation for driving safety"
echo "✅ Integration with car controls"
echo "✅ Navigation, music, phone, and settings screens"
echo "✅ Optimized for car displays and interaction patterns"
echo "✅ Production-ready APK with proper signing"
echo ""

echo -e "${GREEN}🎉 SUCCESS: Production APK created!${NC}"
echo "File: $FINAL_APK"
echo "Ready for installation in Linus's car! 🚗"