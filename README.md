# CarBot AI - Advanced Voice Assistant for Android Auto

An intelligent AI voice assistant with real-time data searching capabilities, designed for Android Auto platform integration. This advanced voice bot provides superior conversational AI with live internet access, making it more capable than traditional voice assistants.

## Features

- Advanced wake word detection ("hicar")
- Real-time web search and data retrieval
- Intelligent speech recognition and natural text-to-speech
- Context-aware conversations with memory
- Car-optimized interface and controls
- Live traffic, weather, and location data
- Android Auto platform integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure your API keys in `.env`

4. Run the development server:
```bash
npm run dev
```

## Installation on Google Auto

Instructions for installing on Google Auto platform will be added once the app is built and tested.

## API Requirements

- Target API level: Android 14 (API level 34) or higher
- Compatible with Android Auto and Android Automotive OS
- Requires Google Cloud Speech API
- Requires Picovoice for wake word detection