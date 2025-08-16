const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class LocalSTTService {
    constructor(options = {}) {
        this.modelPath = options.modelPath || path.join(__dirname, '../../models/parakeet');
        this.pythonPath = options.pythonPath || path.join(__dirname, '../../venv/bin/python');
        this.sttScript = path.join(__dirname, 'parakeet_stt.py');
        this.isInitialized = false;
        this.processingQueue = [];
        this.isProcessing = false;
    }

    async initialize() {
        try {
            console.log('🎤 Initializing Local STT Service with Parakeet...');
            
            // Check if Python environment and model exist
            await this.validateEnvironment();
            
            // Pre-load the model by running a quick test
            await this.warmupModel();
            
            this.isInitialized = true;
            console.log('✅ Local STT Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Local STT Service:', error);
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

        // Check model directory
        try {
            await fs.access(this.modelPath);
        } catch (error) {
            throw new Error(`Model directory not found at: ${this.modelPath}`);
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
import torch
import torchaudio
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
import warnings
warnings.filterwarnings("ignore")

class ParakeetSTT:
    def __init__(self, model_path):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_path = model_path
        self.model = None
        self.processor = None
        self.load_model()
    
    def load_model(self):
        try:
            print(f"Loading Parakeet model from {self.model_path}...", file=sys.stderr)
            # Load the model and processor
            self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
                self.model_path,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                low_cpu_mem_usage=True,
                use_safetensors=True
            )
            self.processor = AutoProcessor.from_pretrained(self.model_path)
            
            self.model.to(self.device)
            print("Model loaded successfully!", file=sys.stderr)
            
        except Exception as e:
            print(f"Error loading model: {e}", file=sys.stderr)
            raise
    
    def transcribe_audio(self, audio_path):
        try:
            # Load audio file
            audio_input, sample_rate = torchaudio.load(audio_path)
            
            # Resample if necessary (Parakeet typically expects 16kHz)
            if sample_rate != 16000:
                resampler = torchaudio.transforms.Resample(sample_rate, 16000)
                audio_input = resampler(audio_input)
            
            # Convert to mono if stereo
            if audio_input.shape[0] > 1:
                audio_input = torch.mean(audio_input, dim=0, keepdim=True)
            
            # Process audio
            input_features = self.processor(
                audio_input.squeeze().numpy(), 
                sampling_rate=16000, 
                return_tensors="pt"
            ).input_features
            
            input_features = input_features.to(self.device)
            
            # Generate transcription
            with torch.no_grad():
                predicted_ids = self.model.generate(input_features)
                transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
            
            return transcription.strip()
            
        except Exception as e:
            print(f"Error transcribing audio: {e}", file=sys.stderr)
            return ""

def main():
    if len(sys.argv) != 3:
        print("Usage: python parakeet_stt.py <model_path> <audio_file>", file=sys.stderr)
        sys.exit(1)
    
    model_path = sys.argv[1]
    audio_file = sys.argv[2]
    
    try:
        stt = ParakeetSTT(model_path)
        transcription = stt.transcribe_audio(audio_file)
        
        # Output as JSON
        result = {
            "success": True,
            "transcription": transcription,
            "confidence": 0.95  # Placeholder confidence score
        }
        print(json.dumps(result))
        
    except Exception as e:
        result = {
            "success": False,
            "error": str(e),
            "transcription": ""
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

        await fs.writeFile(this.sttScript, sttScriptContent);
        console.log('✅ Created STT script');
    }

    async warmupModel() {
        // Create a short silent audio file for warmup
        const warmupAudioPath = path.join(__dirname, '../../temp/warmup.wav');
        await fs.mkdir(path.dirname(warmupAudioPath), { recursive: true });
        
        // Simple warmup - actual implementation would create a short audio file
        console.log('🔥 Warming up Parakeet model...');
        // This would be implemented with actual audio generation
    }

    async transcribeAudio(audioFilePath) {
        if (!this.isInitialized) {
            throw new Error('STT Service not initialized');
        }

        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(this.pythonPath, [
                this.sttScript,
                this.modelPath,
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

module.exports = LocalSTTService;