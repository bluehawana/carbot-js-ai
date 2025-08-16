const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class WhisperSTTService {
    constructor(options = {}) {
        this.pythonPath = options.pythonPath || path.join(__dirname, '../../venv/bin/python');
        this.sttScript = path.join(__dirname, 'whisper_stt.py');
        this.isInitialized = false;
        this.processingQueue = [];
        this.isProcessing = false;
    }

    async initialize() {
        try {
            console.log('🎤 Initializing Whisper STT Service...');
            
            // Check if Python environment and model exist
            await this.validateEnvironment();
            
            // Pre-load the model by running a quick test
            await this.warmupModel();
            
            this.isInitialized = true;
            console.log('✅ Whisper STT Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Whisper STT Service:', error);
            throw error;
        }
    }

    async validateEnvironment() {
        // Check Python executable
        try {
            await fs.access(this.pythonPath);
        } catch (error) {
            throw new Error(`Python executable not found at: ${this.pythonPath}`);
        }

        // Check STT script
        try {
            await fs.access(this.sttScript);
        } catch (error) {
            console.log('STT script not found, will create it...');
            await this.createSTTScript();
        }
    }

    async createSTTScript() {
        const sttScriptContent = `#!/usr/bin/env python3
import sys
import json
import whisper
import os

def main():
    if len(sys.argv) != 2:
        print("Usage: python whisper_stt.py <audio_file>", file=sys.stderr)
        sys.exit(1)
    
    audio_file = sys.argv[1]
    
    try:
        model = whisper.load_model("base")
        result = model.transcribe(audio_file)
        
        # Output as JSON
        response = {
            "success": True,
            "transcription": result["text"],
            "confidence": 0.95  # Placeholder confidence score
        }
        print(json.dumps(response))
        
    except Exception as e:
        response = {
            "success": False,
            "error": str(e),
            "transcription": ""
        }
        print(json.dumps(response))
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

        await fs.writeFile(this.sttScript, sttScriptContent);
        console.log('✅ Created Whisper STT script');
    }

    async warmupModel() {
        // Create a short silent audio file for warmup
        const warmupAudioPath = path.join(__dirname, '../../temp/warmup.wav');
        await fs.mkdir(path.dirname(warmupAudioPath), { recursive: true });
        
        // Simple warmup - actual implementation would create a short audio file
        console.log('🔥 Warming up Whisper model...');
        // This would be implemented with actual audio generation
    }

    async transcribeAudio(audioFilePath) {
        if (!this.isInitialized) {
            throw new Error('STT Service not initialized');
        }

        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(this.pythonPath, [
                this.sttScript,
                audioFilePath
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.log('STT Debug:', data.toString());
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output.trim());
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse STT output: ${output}`));
                    }
                } else {
                    reject(new Error(`STT process failed: ${errorOutput}`));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start STT process: ${error.message}`));
            });
        });
    }

    async transcribeBuffer(audioBuffer, format = 'wav') {
        // Save buffer to temporary file
        const tempFilePath = path.join(__dirname, '../../temp', `audio_${Date.now()}.${format}`);
        await fs.mkdir(path.dirname(tempFilePath), { recursive: true });
        await fs.writeFile(tempFilePath, audioBuffer);

        try {
            const result = await this.transcribeAudio(tempFilePath);
            return result;
        } finally {
            // Clean up temporary file
            try {
                await fs.unlink(tempFilePath);
            } catch (error) {
                console.warn('Failed to clean up temp file:', error);
            }
        }
    }

    async processVoiceCommand(audioData) {
        try {
            const transcriptionResult = await this.transcribeBuffer(audioData);
            
            if (transcriptionResult.success) {
                return {
                    success: true,
                    text: transcriptionResult.transcription,
                    confidence: transcriptionResult.confidence
                };
            } else {
                throw new Error(transcriptionResult.error);
            }
        } catch (error) {
            console.error('Voice command processing error:', error);
            return {
                success: false,
                text: '',
                error: error.message
            };
        }
    }
}

module.exports = WhisperSTTService;
