# CarBot Real Voice Recording & Speech Recognition

This document describes the **real microphone recording and speech recognition** features implemented in the CarBot Android APK.

## 🎤 Core Voice Features

### 1. Real Microphone Access
- **Actual audio recording** from device microphone
- **Car-optimized audio settings** for road noise environments
- **Audio focus management** for proper car audio integration
- **Optimized for automotive microphones** and hands-free systems

### 2. Android Built-in Speech Recognition
- **On-device speech-to-text** using Android's SpeechRecognizer API
- **No internet required** for basic recognition
- **Offline capable** with fallback modes
- **Car environment optimizations** (longer timeout for road noise)

### 3. Text-to-Speech Responses
- **Android TTS engine** for natural voice responses
- **Car audio integration** with proper volume and audio focus
- **Completion callbacks** for conversation flow management
- **Optimized speech rate** for clarity while driving

### 4. Wake Word Detection
- **"Hello My Car" activation** using Picovoice engine
- **Road noise filtering** and car environment adaptation
- **Manual activation fallback** when wake word fails
- **Cooldown periods** to prevent multiple activations

## 📱 Implementation Details

### StandaloneVoiceService.java
**Location**: `/android/app/src/main/java/com/aicarbot/app/voice/StandaloneVoiceService.java`

**Key Features**:
```java
// Real microphone recording setup
speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
recognizerIntent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);

// Car audio optimization
recognizerIntent.putExtra(EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000);
recognizerIntent.putExtra(EXTRA_AUDIO_SOURCE, MediaRecorder.AudioSource.VOICE_RECOGNITION);

// Text-to-speech with car audio focus
textToSpeech.speak(response, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
```

**Audio Focus Management**:
- Requests `AUDIOFOCUS_GAIN_TRANSIENT` for voice input
- Uses `USAGE_ASSISTANT` for proper car audio routing
- Releases focus after speech completion

### OnDeviceAIEngine.java
**Location**: `/android/app/src/main/java/com/aicarbot/app/ai/OnDeviceAIEngine.java`

**Supported Commands**:
- **Navigation**: "Navigate to downtown", "Take me to the airport"
- **Weather**: "What's the weather like?", "Is it raining?"
- **Music**: "Play some music", "Next track", "Pause music"
- **Phone**: "Call John", "Text Mary hello"
- **Car Status**: "What's my fuel level?", "Check battery"
- **Climate**: "Set temperature to 72", "Make it cooler"

## 🚗 Car Environment Optimizations

### Audio Processing
- **Longer silence timeouts** for road noise environments
- **Voice recognition audio source** optimization
- **Partial results enabled** for better user feedback
- **Car microphone integration** support

### Wake Word Detection
- **Picovoice "Hello My Car" model** with car-specific training
- **Road noise level monitoring** and adaptation
- **Car audio session integration** for proper microphone access
- **Fallback to manual activation** when environment is too noisy

## 🔧 Testing & Usage

### Run the Test Script
```bash
cd android
./test-voice-recording.sh
```

### Manual Testing Steps
1. **Install APK**: `adb install -r app/build/outputs/apk/debug/app-debug.apk`
2. **Grant Permissions**: Microphone, Location, Phone access
3. **Launch App**: CarBot MainActivity will show voice controls
4. **Test Voice Commands**:
   - Tap "🎤 Start Voice Command"
   - Speak clearly: "What's the weather like?"
   - Listen to CarBot's response
   - Try wake word: "Hello My Car"

### Viewing Live Logs
```bash
adb logcat -s StandaloneVoiceService CarBot_MainActivity OnDeviceAIEngine
```

## 📋 Required Permissions

The app requests these permissions for voice functionality:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.CAPTURE_AUDIO_OUTPUT" />
<uses-feature android:name="android.hardware.microphone" android:required="false" />
```

## 🎯 Voice Recognition Flow

1. **User Activation**: 
   - Wake word "Hello My Car" OR manual button tap
   - Audio focus is requested from car audio system

2. **Voice Input**:
   - Microphone starts recording real audio
   - Speech recognizer processes audio on-device
   - Partial results provide real-time feedback

3. **Command Processing**:
   - OnDeviceAIEngine processes speech-to-text result
   - Natural language parsing extracts intent and parameters
   - Appropriate response is generated

4. **Voice Output**:
   - Text-to-speech converts response to audio
   - Car audio focus ensures proper routing
   - Audio focus is released after completion

## 🔍 Key Files Modified/Created

1. **StandaloneVoiceService.java** - Main voice recording and TTS service
2. **MainActivity.java** - UI integration and voice service management
3. **OnDeviceAIEngine.java** - Command processing and response generation
4. **CarWakeWordService.java** - Wake word detection with Picovoice
5. **AndroidManifest.xml** - Permissions and service declarations
6. **build.gradle** - Dependencies for speech recognition and TTS

## ✅ Verification Checklist

- ✓ Real microphone recording (not simulated)
- ✓ Android built-in speech recognition
- ✓ On-device text-to-speech
- ✓ Car audio focus management
- ✓ Wake word detection ("Hello My Car")
- ✓ Road noise optimizations
- ✓ No backend dependencies required
- ✓ Proper permission handling
- ✓ Error handling and fallbacks
- ✓ Car environment audio settings

## 🚨 Important Notes

- **This uses REAL device microphone** - not simulation!
- **Works entirely on-device** - no internet required for basic functionality
- **Optimized for car environments** with road noise handling
- **Production-ready implementation** with proper error handling
- **Android Auto compatible** with car audio integration