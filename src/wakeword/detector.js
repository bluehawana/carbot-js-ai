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
        try {
            // Create custom wake word model for "hi ecarx"
            const keywordPaths = [
                path.join(__dirname, '../../models/hi-ecarx_en_linux_v3_0_0.ppn')
            ];

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
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            return false;
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

        console.log('Started listening for wake word: "hi ecarx"');

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
                    console.log('Wake word detected: "hi ecarx"');
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
        
        // Simple audio-based wake word detection
        const recorder = require('node-record-lpcm16');
        const fs = require('fs');
        
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

        return true;
    }

    processAudioBuffer(buffer) {
        // Simple energy-based detection
        const energy = this.calculateEnergy(buffer);
        
        if (energy > 1000) { // Threshold for voice activity
            console.log('Voice activity detected - checking for wake word');
            
            // In a real implementation, you would use speech recognition here
            // For now, we'll simulate wake word detection
            setTimeout(() => {
                if (this.callbacks.onWakeWord) {
                    this.callbacks.onWakeWord();
                }
            }, 100);
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