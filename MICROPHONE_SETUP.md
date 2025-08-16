# 🎤 CarBot Microphone Setup Guide

## Problem
Terminal applications on macOS cannot access the microphone directly. The "Hello My Car" wake word detection requires microphone permissions that Terminal doesn't have.

## Solutions

### ✅ Option 1: Run from Android Studio (RECOMMENDED)

Since Android Studio already has microphone access, you can run CarBot from within it:

1. **Open Android Studio**
2. **Open Terminal in Android Studio** (View → Tool Windows → Terminal)
3. **Navigate to project directory:**
   ```bash
   cd /Users/bluehawana/Projects/carbot-js-ai-androidauto
   ```
4. **Run CarBot with microphone access:**
   ```bash
   npm run start:mic
   ```
   OR
   ```bash
   node run-with-mic.js
   ```

### ✅ Option 2: Browser Interface (CURRENT SOLUTION)

Use the web interface to trigger wake word manually:

1. **Start CarBot** (from any terminal):
   ```bash
   npm start
   ```

2. **Open Browser** and go to:
   ```
   http://localhost:3000/test-wake-word
   ```

3. **Click "Trigger Hello My Car"** button to activate wake word

### ✅ Option 3: API Command (DEVELOPER)

Use curl to trigger wake word programmatically:

```bash
curl -X POST http://localhost:3000/api/wake-word
```

### ✅ Option 4: VS Code (Alternative)

If VS Code has microphone permissions:

1. Open VS Code
2. Open integrated terminal (Terminal → New Terminal)
3. Run: `npm run start:mic`

### ✅ Option 5: Auto Demo Mode

CarBot automatically triggers wake word every 45 seconds for testing:
- Just start CarBot and wait
- No interaction needed

## Real Microphone Access (Future)

For production use with real voice detection, consider:

1. **Electron App**: Package as Electron application
2. **Native macOS App**: Create proper macOS bundle with entitlements
3. **Docker with Audio**: Run in container with audio device access
4. **External Device**: Use dedicated hardware with microphone

## Testing Wake Word Detection

Once you have microphone access working:

1. Say **"Hello My Car"** clearly
2. Wait for CarBot to respond with listening confirmation
3. Then say your command, like:
   - "What's the weather like?"
   - "Navigate to the nearest gas station"
   - "Play some music"
   - "Set temperature to 72 degrees"

## Troubleshooting

### ❌ Still getting "Frame length mismatch" errors?
- This means microphone access is still blocked
- Try running from an app that definitely has microphone permissions
- Check System Preferences → Security & Privacy → Microphone

### ❌ Wake word model not found?
- Ensure you have the wake word files in the `models/` directory
- Check that `Hello-My-Car_en_mac_v3_0_0.ppn` exists

### ❌ API key errors?
- Set your environment variables in `.env` file
- Make sure `PICOVOICE_ACCESS_KEY` and `GROQ_API_KEY` are set

## Environment Variables

Create a `.env` file with:

```env
PICOVOICE_ACCESS_KEY=your_picovoice_key_here
GROQ_API_KEY=your_groq_api_key_here
AI_PROVIDER=groq
PORT=3000
```

## Current Status

✅ **Working Now**: Browser trigger, API trigger, auto-demo  
🔄 **Needs Testing**: Android Studio microphone access  
📋 **Future**: Native app with full microphone integration