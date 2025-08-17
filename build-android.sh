#!/bin/bash

# 🚗 CarBot Android Auto Build Script
# Builds the Android Auto MediaBrowserService integration

echo "🤖 Building CarBot Android Auto Integration"
echo "═══════════════════════════════════════════"

# Check if Android SDK is available
if ! command -v android &> /dev/null; then
    echo "❌ Android SDK not found. Please install Android Studio first."
    echo "   Download from: https://developer.android.com/studio"
    exit 1
fi

# Check if Kotlin compiler is available
if ! command -v kotlinc &> /dev/null; then
    echo "❌ Kotlin compiler not found. Installing via Homebrew..."
    brew install kotlin
fi

echo "✅ Dependencies verified"

# Create Android project structure
echo "📁 Creating Android project structure..."
mkdir -p src/android/app/src/main/java/com/carbot/android
mkdir -p src/android/app/src/main/res/xml
mkdir -p src/android/app/src/main/res/values

# Copy source files to proper Android structure
echo "📋 Organizing Android source files..."
cp src/android/CarBotService.kt src/android/app/src/main/java/com/carbot/android/
cp src/android/MainActivity.kt src/android/app/src/main/java/com/carbot/android/
cp src/android/AndroidManifest.xml src/android/app/src/main/
cp src/android/res/xml/automotive_app_desc.xml src/android/app/src/main/res/xml/

# Create build.gradle files
echo "🔧 Creating build configuration..."

cat > src/android/app/build.gradle << 'EOF'
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace 'com.carbot.android'
    compileSdk 34

    defaultConfig {
        applicationId "com.carbot.android"
        minSdk 23
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = '1.8'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.media:media:1.7.0'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'ai.picovoice:porcupine-android:3.0.2'
}
EOF

cat > src/android/build.gradle << 'EOF'
buildscript {
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22'
    }
}

plugins {
    id 'com.android.application' version '8.2.2' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.22' apply false
}
EOF

cat > src/android/settings.gradle << 'EOF'
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "CarBot"
include ':app'
EOF

# Create strings.xml
cat > src/android/app/src/main/res/values/strings.xml << 'EOF'
<resources>
    <string name="app_name">CarBot Voice Assistant</string>
</resources>
EOF

echo "🎯 Android Auto integration files created!"
echo ""
echo "📱 To build the Android Auto app:"
echo "   1. Open Android Studio"
echo "   2. Import project from: src/android/"
echo "   3. Connect Android Auto device or emulator"
echo "   4. Build and install"
echo ""
echo "🚗 For testing without Android Auto:"
echo "   1. Install APK on any Android device"
echo "   2. Grant microphone permissions"
echo "   3. Say \"Hello My Car\" - popups will appear"
echo ""
echo "🔧 Backend integration:"
echo "   - Ensure CarBot backend is running on accessible IP"
echo "   - Update CARBOT_API_BASE in CarBotService.kt if needed"
echo "   - Default: http://localhost:3000"