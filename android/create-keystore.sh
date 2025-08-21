#!/bin/bash

# 🔐 CarBot Android Auto Keystore Creation Script
# Creates a production keystore for APK signing

echo "🔐 Creating CarBot Android Auto Production Keystore"
echo "================================================="

KEYSTORE_PATH="./app/carbot-release.keystore"
KEY_ALIAS="carbot-release"
VALIDITY_DAYS=25000  # ~68 years

# Check if keystore already exists
if [ -f "$KEYSTORE_PATH" ]; then
    echo "⚠️  Keystore already exists at: $KEYSTORE_PATH"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Keystore creation cancelled"
        exit 1
    fi
    rm "$KEYSTORE_PATH"
fi

echo "📝 Please provide keystore information:"
echo "   (Use secure passwords and real organization info for production)"
echo

# Generate keystore
keytool -genkey -v \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity $VALIDITY_DAYS \
    -dname "CN=CarBot AI Assistant, OU=Development, O=CarBot Technologies, L=San Francisco, ST=California, C=US" \
    -storepass "carbot2024secure" \
    -keypass "carbot2024secure"

if [ $? -eq 0 ]; then
    echo "✅ Keystore created successfully!"
    echo "📍 Location: $KEYSTORE_PATH"
    echo "🔑 Alias: $KEY_ALIAS"
    echo ""
    echo "🔒 IMPORTANT SECURITY NOTES:"
    echo "   • Store keystore file securely - you cannot recreate it!"
    echo "   • Change default passwords for production release"
    echo "   • Back up keystore to secure location"
    echo "   • Never commit keystore to version control"
    echo ""
    echo "📱 Build commands:"
    echo "   Debug:   ./gradlew assembleDebug"
    echo "   Release: ./gradlew assembleRelease"
else
    echo "❌ Failed to create keystore"
    exit 1
fi