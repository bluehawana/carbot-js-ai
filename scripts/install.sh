#!/bin/bash

# CarBot Installation Script
# For Google Auto Platform

set -e

echo "🚗 CarBot Installation Script"
echo "================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm is available"

# Create project directory if it doesn't exist
if [ ! -d "carbot" ]; then
    echo "📁 Creating project directory..."
    mkdir -p carbot
    cd carbot
else
    echo "📁 Using existing project directory..."
    cd carbot
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p recordings
mkdir -p audio-output
mkdir -p models
mkdir -p logs

# Set up environment file
if [ ! -f ".env" ]; then
    echo "🔧 Creating environment file..."
    cp .env.example .env
    echo "📝 Please edit .env file with your API keys"
else
    echo "✅ Environment file already exists"
fi

# Make scripts executable
chmod +x scripts/*.sh

# Check for required system dependencies
echo "🔍 Checking system dependencies..."

# Check for audio system
if ! command -v aplay &> /dev/null && ! command -v afplay &> /dev/null; then
    echo "⚠️  Audio system not detected. Some features may not work."
fi

# Check for Android SDK (optional)
if command -v android &> /dev/null; then
    echo "✅ Android SDK found"
else
    echo "⚠️  Android SDK not found. Install Android SDK for full development support."
fi

echo ""
echo "🎉 Installation completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys:"
echo "   - GOOGLE_CLOUD_PROJECT_ID"
echo "   - GOOGLE_CLOUD_KEY_FILE"
echo "   - OPENAI_API_KEY"
echo "   - PICOVOICE_ACCESS_KEY"
echo ""
echo "2. Start the bot:"
echo "   npm start"
echo ""
echo "3. For development:"
echo "   npm run dev"
echo ""
echo "4. For Android Auto deployment:"
echo "   ./scripts/deploy-android.sh"
echo ""