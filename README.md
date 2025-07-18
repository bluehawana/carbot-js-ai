# ECARX Bot - Voice Assistant for Google Auto

A customized chatbot with wake word "hi ecarx" designed for Google Auto platform integration.

## Features

- Wake word detection ("hi ecarx")
- Speech recognition and text-to-speech
- Natural language conversation
- Car-specific features (navigation, music control)
- Google Auto platform integration

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