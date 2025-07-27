const Porcupine = require('@picovoice/porcupine-node');
const { PvRecorder } = require('@picovoice/pvrecorder-node');
const path = require('path');

class WakeWordDetector {
    constructor(accessKey, sensitivity = 0.5) {
        this.accessKey = accessKey;
        this.sensitivity = sensitivity;
        this.porcupine = null;
        this.recorder = null;
        this.isListening = false;
        this.callbacks = {
            onWakeWord: null,
            onError: null
        };
    }

    async initialize() {
        // Check if we have access key and model file
        if (!this.accessKey) {
            console.log('No Picovoice access key provided, using fallback detection');
            return this.initializeFallback();
        }

        const modelPath = path.join(__dirname, '../../models/hej-car_en_linux_v3_0_0.ppn');
        const fs = require('fs');
        
        if (!fs.existsSync(modelPath)) {
            console.log('Wake word model not found, using fallback detection');
            return this.initializeFallback();
        }

        try {
            // Create custom wake word model for "Hej Car"
            const keywordPaths = [modelPath];

            this.porcupine = new Porcupine(
                this.accessKey,
                keywordPaths,
                [this.sensitivity]
            );

            // Initialize audio recorder
            this.recorder = new PvRecorder(
                this.porcupine.frameLength,
                -1 // Use default audio device
            );

            console.log('Wake word detector initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize wake word detector:', error);
            console.log('Falling back to simple detection');
            return this.initializeFallback();
        }
    }

    startListening() {
        if (this.isListening) {
            console.log('Already listening for wake word');
            return;
        }

        if (!this.porcupine || !this.recorder) {
            console.error('Wake word detector not initialized');
            return;
        }

        this.isListening = true;
        this.recorder.start();

        console.log('Started listening for wake word: "Hej Car"');

        // Audio processing loop
        this.processAudio();
    }

    processAudio() {
        const processFrame = () => {
            if (!this.isListening) return;

            try {
                const frame = this.recorder.read();
                const keywordIndex = this.porcupine.process(frame);

                if (keywordIndex >= 0) {
                    console.log('Wake word detected: "Hej Car"');
                    if (this.callbacks.onWakeWord) {
                        this.callbacks.onWakeWord();
                    }
                }

                // Continue processing
                setImmediate(processFrame);
            } catch (error) {
                console.error('Error processing audio frame:', error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
            }
        };

        processFrame();
    }

    stopListening() {
        if (!this.isListening) {
            console.log('Not currently listening');
            return;
        }

        this.isListening = false;
        
        if (this.recorder) {
            this.recorder.stop();
        }

        console.log('Stopped listening for wake word');
    }

    onWakeWord(callback) {
        this.callbacks.onWakeWord = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    destroy() {
        this.stopListening();
        
        if (this.porcupine) {
            this.porcupine.release();
            this.porcupine = null;
        }
        
        if (this.recorder) {
            this.recorder.delete();
            this.recorder = null;
        }
    }

    // Fallback wake word detection using simple audio analysis
    async initializeFallback() {
        console.log('Initializing fallback wake word detection...');
        console.log('Using simple energy-based detection for voice activity');
        
        try {
            // Simple audio-based wake word detection
            const recorder = require('node-record-lpcm16');
            
            this.audioStream = recorder.record({
                sampleRate: 16000,
                channels: 1,
                audioType: 'raw',
                silence: '2.0',
                verbose: false
            });

            this.audioStream.stream().on('data', (data) => {
                if (this.isListening) {
                    this.processAudioBuffer(data);
                }
            });

            this.audioStream.stream().on('error', (error) => {
                console.error('Audio stream error:', error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
            });

            console.log('Fallback detection initialized - speak to activate');
            return true;
        } catch (error) {
            console.error('Failed to initialize fallback detection:', error);
            return false;
        }
    }

    processAudioBuffer(buffer) {
        // Simple energy-based detection
        const energy = this.calculateEnergy(buffer);
        
        if (energy > 5000) { // Higher threshold to reduce false positives
            console.log(`Voice activity detected (energy: ${energy.toFixed(0)}) - triggering wake word`);
            
            // Throttle wake word triggers to prevent spam
            const now = Date.now();
            if (!this.lastTrigger || (now - this.lastTrigger) > 3000) {
                this.lastTrigger = now;
                
                if (this.callbacks.onWakeWord) {
                    this.callbacks.onWakeWord();
                }
            }
        }
    }

    calculateEnergy(buffer) {
        let energy = 0;
        for (let i = 0; i < buffer.length; i += 2) {
            const sample = buffer.readInt16LE(i);
            energy += sample * sample;
        }
        return energy / (buffer.length / 2);
    }
}

module.exports = WakeWordDetector;