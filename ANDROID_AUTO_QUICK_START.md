# CarBot Android Auto Quick Start Guide 🚗

## Goal: Get CarBot Working in Your Car NOW!

### Prerequisites
1. Android Auto compatible car or head unit
2. Android phone with Android Auto app
3. USB cable for wired connection (or wireless Android Auto setup)
4. Node.js 18+ on your development machine
5. Android Studio (for building APK)

### Step 1: Backend Setup (5 minutes)
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env

# 3. Add your API keys to .env
GROQ_API_KEY=your-groq-key-here  # Get free at https://console.groq.com/
OPENAI_API_KEY=your-openai-key-here  # For advanced features

# 4. Start the backend
npm start
```

### Step 2: Build Android APK (10 minutes)
```bash
# 1. Get your machine's IP address
./get-mac-ip.sh  # Note this IP!

# 2. Update backend URL in Android app
# Edit android/app/src/main/java/com/aicarbot/app/car/CarBotApiClient.java
# Replace BASE_URL with: http://YOUR_IP:3000

# 3. Build the APK
cd android
./gradlew assembleDebug

# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 3: Install on Phone (2 minutes)
```bash
# Connect your phone via USB (enable USB debugging)
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 4: Test in Car (5 minutes)
1. Connect phone to car via USB
2. Android Auto should launch automatically
3. Look for "AI CarBot" in the app launcher
4. Tap to open
5. Say "Hello My Car" or tap the mic button

### Quick Test Commands

**Test wake word in car:**
- "Hello My Car"
- "Hey Car Bot"
- "OK My Car"

**Test AI features (that Google Assistant can't do):**
- "What's Elon Musk's latest tweet?"
- "Tell me about Trump's recent announcement"
- "What's trending on Twitter right now?"
- "Explain quantum computing simply"
- "Write me a haiku about driving"

### Troubleshooting

**CarBot not showing in Android Auto:**
```bash
# Check if app is installed
adb shell pm list packages | grep aicarbot

# Check Android Auto developer settings
# Settings > Apps > Android Auto > Advanced > Developer settings > Unknown sources
```

**Wake word not working:**
```bash
# Test backend wake word endpoint
curl -X POST http://localhost:3000/api/wake-word

# Check logs
adb logcat | grep -i carbot
```

**Can't connect to backend:**
```bash
# Ensure phone and computer on same network
# Check firewall isn't blocking port 3000
# Try using ngrok for public URL:
npx ngrok http 3000
```

### Production Build (Optional)
For a signed APK that works on any car:
```bash
cd android
./build-production-apk.sh
```

### That's it! 🎉
Your car is now smarter than Google Assistant! Ask it anything, especially real-time info that Google can't provide.

## Why CarBot is Better Than Google Assistant:
- ✅ Real-time information (news, social media, stock prices)
- ✅ No restrictions on content
- ✅ Custom wake words
- ✅ AI-powered responses (GPT-4, Claude, etc.)
- ✅ Extensible with your own features
- ✅ Privacy-focused (runs on your backend)