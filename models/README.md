# Wake Word Models

This directory contains wake word models for the CarBot.

## Required Files

- `hicar_en_linux_v3_0_0.ppn` - Custom wake word model for "hicar"

## Getting the Model

1. Get your Picovoice access key from https://console.picovoice.ai/
2. Create a custom wake word model for "hicar" 
3. Download the `.ppn` file and place it in this directory

## Fallback Detection

Until the Picovoice model is available, the bot uses a simple energy-based fallback detection.